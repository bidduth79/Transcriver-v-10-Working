// Bengali-profile prompt for Gemini; the transcript excerpt helps disambiguate the speaker
export const buildSpeakerProfilePrompt = (name: string, transcriptContext: string) => {
  const safeContext = transcriptContext.substring(0, 2000).replace(/"/g, "'");
  return `You are an expert Bangladeshi investigative researcher and biographer. Provide a structured, highly detailed profile in BENGALI language for the public figure: "${name}".
Use the following transcript context to understand their relevance if needed:
"${safeContext}"

CRITICAL LANGUAGE REQUIREMENT:
- All descriptive fields ("name", "description", "career", "bgbViews") MUST be written strictly and fluently in BENGALI (বাংলা).
- Do NOT output in English for description, career, or bgbViews.

Respond ONLY with a valid JSON object matching exactly this structure:
{
  "name": "পূর্ণ নাম (বাংলায়)",
  "imageUrl": "Direct public image URL if highly confident, otherwise empty",
  "wikipediaLang": "The language code of their Wikipedia page (e.g. 'bn' or 'en'), or empty if none",
  "wikipediaTitle": "The exact title of their Wikipedia article (in the corresponding language), or empty if none",
  "description": "২-৩ বাক্যের সংক্ষিপ্ত পরিচিতি ও জীবনী (অবশ্যই বাংলায়)",
  "career": "কর্মজীবন, পেশাগত পরিচিতি ও উল্লেখযোগ্য কার্যক্রমের বিস্তারিত বিবরণ (অবশ্যই বাংলায়)",
  "bgbViews": "বিজিবি (বর্ডার গার্ড বাংলাদেশ) বা সীমান্ত ইস্যু সম্পর্কে তাদের বক্তব্য, অবস্থান বা ইতিহাস (অবশ্যই বাংলায়)। তথ্য না থাকলে লিখুন: 'বিজিবি বা সীমান্ত বিষয়ে সুনির্দিষ্ট কোনো বক্তব্য বা তথ্য পাওয়া যায়নি।'",
  "sourceUrl": "URL to their Wikipedia page or official profile, otherwise empty",
  "socialLinks": {
    "facebook": "url or empty",
    "twitter": "url or empty",
    "linkedin": "url or empty"
  }
}
Do not include markdown blocks like \`\`\`json, just return the raw JSON object.`;
};
