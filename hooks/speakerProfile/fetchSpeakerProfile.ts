import type { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { SpeakerProfile } from '../../types/speaker';
import { fetchWikiSummary, fetchWikiImageByTitle, searchWikiImage, searchCommonsImage } from '../speakerProfileUtils';
import { DEFAULT_MODEL } from '../../constants/aiModels';
import { messageOf } from '../../utils/errorMessage';

const LITE_MODEL = 'gemini-3.5-flash-lite';

// Tries Google Search grounding, then plain generation, then the lite model
export const generateProfileResponse = async (ai: GoogleGenAI, prompt: string, preferredModel: string | undefined) => {
  let modelToUse = preferredModel || DEFAULT_MODEL;

  let response: GenerateContentResponse;
  try {
    // First try with Google Search grounding tool
    response = await ai.models.generateContent({
      model: modelToUse,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
  } catch (searchErr) {
    console.warn("Google Search grounding not available or permission denied, falling back to standard AI generation:", searchErr);
    try {
      // Second try: standard model generation without tools
      response = await ai.models.generateContent({
        model: modelToUse,
        contents: prompt
      });
    } catch (genErr) {
      console.warn(`Primary model generation failed, trying fallback model ${LITE_MODEL}:`, genErr);
      // Third try: fast fallback model
      response = await ai.models.generateContent({
        model: LITE_MODEL,
        contents: prompt
      });
      modelToUse = LITE_MODEL;
    }
  }
  return { response, modelToUse };
};

// Accepts raw JSON, a ```json fenced block, or the first {...} found in the text
export const parseProfileJson = (text: string): SpeakerProfile | null => {
  let parsedProfile: SpeakerProfile | null = null;
  try {
    parsedProfile = JSON.parse(text);
  } catch (e) {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i) || text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsedProfile = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch (err) {}
    }
  }
  return parsedProfile;
};

// Fill in a missing photo (Wikipedia → Wikimedia Commons) and Bengali/English Wikipedia summaries
export const enrichProfileFromWiki = async (parsedProfile: SpeakerProfile, name: string) => {
  let fetchedImageUrl = parsedProfile.imageUrl || '';
  // Try to find an image if we don't have one
  if (!fetchedImageUrl || fetchedImageUrl.trim() === '') {
    if (parsedProfile.wikipediaTitle && parsedProfile.wikipediaLang) {
      fetchedImageUrl = await fetchWikiImageByTitle(parsedProfile.wikipediaTitle, parsedProfile.wikipediaLang) || '';
    }
    if (!fetchedImageUrl) {
      fetchedImageUrl = await searchWikiImage(name, 'en') || '';
    }
    if (!fetchedImageUrl) {
      fetchedImageUrl = await searchWikiImage(name, 'bn') || '';
    }
    if (!fetchedImageUrl) {
      fetchedImageUrl = await searchCommonsImage(name) || '';
    }
  }

  parsedProfile.imageUrl = fetchedImageUrl;

  // Dual language Wikipedia Deep Fetch
  let wikiBnSummary = null;
  let wikiEnSummary = null;
  if (parsedProfile.wikipediaTitle) {
    if (parsedProfile.wikipediaLang === 'bn') {
      wikiBnSummary = await fetchWikiSummary(parsedProfile.wikipediaTitle, 'bn');
    } else {
      wikiEnSummary = await fetchWikiSummary(parsedProfile.wikipediaTitle, 'en');
    }
  }
  if (!wikiBnSummary) wikiBnSummary = await fetchWikiSummary(name, 'bn');
  if (!wikiEnSummary) wikiEnSummary = await fetchWikiSummary(name, 'en');

  parsedProfile.wikiSummaryBn = wikiBnSummary || undefined;
  parsedProfile.wikiSummaryEn = wikiEnSummary || undefined;
};

export const getSpeakerProfileErrorMessage = (err: unknown) => {
  const rawMsg = messageOf(err) || '';
  let displayError = 'স্পীকারের প্রোফাইল লোড করা সম্ভব হয়নি। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।';
  
  if (rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('403')) {
    displayError = 'API Key-তে অনুসন্ধান চালানোর অনুমতি নেই। অনুগ্রহ করে Settings থেকে একটি সক্রিয় API Key প্রদান করুন।';
  } else if (rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('429')) {
    displayError = 'API কোটা সাময়িকভাবে শেষ হয়ে গেছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।';
  } else if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('400')) {
    displayError = 'প্রদত্ত API Key টি সঠিক নয়। Settings থেকে সঠিক কি কনফিগার করুন।';
  } else if (rawMsg) {
    displayError = rawMsg;
  }
  return displayError;
};
