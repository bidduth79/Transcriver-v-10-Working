import { messageOf } from '../../utils/errorMessage';

export const isKeyOrProjectBlockedError = (err: unknown): boolean => {
  const msg = (typeof err === 'string' ? err : (messageOf(err) || '')).toLowerCase();
  return (
    msg.includes('denied access') ||
    msg.includes('permission_denied') ||
    msg.includes('403') ||
    msg.includes('api_key_invalid') ||
    msg.includes('api key not valid') ||
    msg.includes('suspended') ||
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('rate limit')
  );
};

export const formatErrorMessage = (rawError: unknown, lang: 'bn' | 'en', keyInfo?: string): string => {
  let rawMsg = typeof rawError === 'string' ? rawError : (messageOf(rawError) || "Unknown error occurred");

  try {
    const parsed = JSON.parse(rawMsg);
    if (parsed?.error?.message) {
        try {
            const innerParsed = JSON.parse(parsed.error.message);
            if (innerParsed?.error?.message) {
                rawMsg = innerParsed.error.message;
            } else {
                rawMsg = parsed.error.message;
            }
        } catch(e) {
            rawMsg = parsed.error.message;
        }
    }
  } catch (e) {
    // Not a JSON string
  }

  const lowerMsg = rawMsg.toLowerCase();
  const keyTag = keyInfo ? ` [${keyInfo}]` : '';

  if (lowerMsg.includes('denied access') || lowerMsg.includes('suspended') || lowerMsg.includes('permission_denied')) {
      return lang === 'bn'
        ? `আপনার বর্তমান এপিআই কি${keyTag}-এর Google Cloud Project-টি গুগল ব্লক (Denied Access) করেছে। সমাধান: সেটিংস (Settings ⚙️ > API Key Management) থেকে পুরনো কি-টি ডিলিট করুন এবং Google AI Studio-তে "Create API key in NEW project" সিলেক্ট করে নতুন প্রজেক্টের কি যুক্ত করুন।`
        : `Your Google Cloud Project for key${keyTag} has been denied access. Please delete the old key in Settings and create a new API key in a NEW Google Cloud project.`;
  }

  if (lowerMsg.includes('api_key_invalid') || lowerMsg.includes('api key not valid')) {
      return lang === 'bn'
        ? `প্রদত্ত এপিআই কি${keyTag} সঠিক নয় বা অকার্যকর। দয়া করে সেটিংস থেকে সঠিক জেমিনি এপিআই কি যুক্ত করুন।`
        : `The API Key${keyTag} is invalid. Please check your Gemini API Key in Settings.`;
  }

  if (lowerMsg.includes('no api key') || lowerMsg.includes('api key configured') || lowerMsg.includes('api_key')) {
      return lang === 'bn'
        ? "কোনো এপিআই কি (API Key) পাওয়া যায়নি। দয়া করে সেটিংস (Settings) থেকে আপনার জেমিনি এপিআই কি যুক্ত করুন।"
        : "No API Key configured. Please add your Gemini API Key in Settings.";
  }

  if (lowerMsg.includes('503') || lowerMsg.includes('unavailable') || lowerMsg.includes('high demand') || lowerMsg.includes('overloaded')) {
      return lang === 'bn'
        ? "সার্ভারে এখন অনেক চাপ রয়েছে (High Demand)। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন অথবা ফুটার থেকে অন্য একটি ফাস্ট মডেল সিলেক্ট করুন।"
        : "The server is currently experiencing high demand. Please try again later.";
  }

  if (lowerMsg.includes('429') || lowerMsg.includes('quota') || lowerMsg.includes('rate limit')) {
      return lang === 'bn'
        ? `আপনার এপিআই কি${keyTag}-এর কোটা শেষ হয়ে গেছে অথবা লিমিট অতিক্রম করেছে। ফুটার থেকে ফাস্ট মডেল সিলেক্ট করুন অথবা সেটিংসে নতুন কি যুক্ত করুন।`
        : `Your API quota for key${keyTag} has been exceeded or rate limit reached.`;
  }

  if (lowerMsg.includes('400') || lowerMsg.includes('invalid argument') || lowerMsg.includes('bad request')) {
      return lang === 'bn'
        ? "ভুল রিকোয়েস্ট বা ফাইল সাইজ/ফরম্যাট সাপোর্ট করছে না।"
        : "Bad request. The file size or format might not be supported.";
  }

  if (lowerMsg.includes('fetch') || lowerMsg.includes('network') || lowerMsg.includes('failed to fetch')) {
      return lang === 'bn'
        ? "নেটওয়ার্ক কানেকশন সমস্যা। দয়া করে আপনার ইন্টারনেট কানেকশন চেক করুন।"
        : "Network connection issue. Please check your internet connection.";
  }

  return rawMsg.length > 300 ? rawMsg.substring(0, 300) + '...' : rawMsg;
};

// Answers refused for what the audio says: asking again brings the same
const REFUSAL_REASONS = ['SAFETY', 'RECITATION', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'];

// 'busy': the server is overloaded or gave no answer in time, worth waiting for. 'refused': never worth retrying.
export type FailureKind = 'busy' | 'refused' | 'other';

export const failureKindOf = (error: unknown): FailureKind => {
  const { reason, status } = (error ?? {}) as { reason?: string; status?: number };
  if (REFUSAL_REASONS.includes(reason ?? '')) return 'refused';
  return status === 503 || /\b503\b|UNAVAILABLE|high demand|overloaded/i.test(messageOf(error) ?? '') ? 'busy' : 'other';
};

// The error of an answer without text, carrying the reason so the batch can tell a refusal from a busy server
export const emptyTranscriptError = (reason: string | undefined, lang: 'bn' | 'en', piece?: { part: number; parts: number }): Error =>
  Object.assign(buildEmptyTranscriptError(reason, lang, piece), { reason });

/**
 * The error for an answer without text. It is never shown as "no speech": the audio has speech, so an
 * empty answer means the request failed (busy server, time limit, or a block). `piece` names the part of a
 * long recording that came back empty.
 */
const buildEmptyTranscriptError = (reason: string | undefined, lang: 'bn' | 'en', piece?: { part: number; parts: number }): Error => {
  if (reason === 'SAFETY') {
    return new Error(lang === 'bn'
      ? 'এআই নিরাপত্তা নীতিমালার কারণে এই অডিওটির ট্রান্সক্রিপশন সম্পন্ন করা সম্ভব হয়নি।'
      : 'Transcription was blocked by AI safety policy.');
  } else if (reason === 'RECITATION') {
    return new Error(lang === 'bn'
      ? 'অডিওটিতে থাকা বক্তব্য/উদ্ধৃতি কপিরাইট বা রিসিটেশন ফিল্টারে পড়েছে। অনুগ্রহ করে Settings থেকে অন্য কোনো মডেল (যেমন: Gemini 3.5 Flash বা 3.5 Flash Lite) অথবা Normal মোড দিয়ে পুনরায় চেষ্টা করুন।'
      : 'Transcription was blocked due to copyright or recitation policies. Please select another model in Settings or try Normal mode.');
  } else if (reason === 'PROHIBITED_CONTENT' || reason === 'BLOCKLIST' || reason === 'SPII') {
    return new Error(lang === 'bn'
      ? `এই অডিওটি Gemini-র কনটেন্ট নীতিতে আটকে গেছে (${reason})। সার্ভারের সমস্যা নয়, তাই আবার চেষ্টা করলে একই ফল আসবে।`
      : `Gemini refused this audio under its content policy (${reason}). The server is not at fault, so trying again will give the same result.`);
  } else if (reason === 'NOT_A_TRANSCRIPT') {
    return new Error(lang === 'bn'
      ? 'Gemini অডিওর লেখার বদলে অন্য কিছু ফেরত দিয়েছে (যেমন নিজের কাজের বর্ণনা), তাই এটা সেভ করা হয়নি। আবার চেষ্টা করুন, না হলে Settings থেকে অন্য মডেল বেছে নিন।'
      : 'Gemini answered with something other than the words of the audio (such as a description of its work), so it was not saved. Please try again, or choose another model in Settings.');
  } else if (reason === 'MAX_TOKENS') {
    return new Error(lang === 'bn'
      ? 'টোকেন লিমিট পূর্ণ হয়ে গেছে। অনুগ্রহ করে অডিও ফাইলটি ছোট করে পুনরায় চেষ্টা করুন।'
      : 'Token limit reached. Please use a shorter audio clip.');
  }
  const where = piece ? (lang === 'bn' ? ` (${piece.parts}টি অংশের ${piece.part} নম্বর অংশে)` : ` (part ${piece.part} of ${piece.parts})`) : '';
  return new Error(lang === 'bn'
    ? `Gemini কোনো লেখা ফেরত দেয়নি${where}। কারণ: ${reason || 'NO_ANSWER'}। সার্ভার ব্যস্ত থাকতে পারে, কিছুক্ষণ পর আবার চেষ্টা করুন।`
    : `Gemini returned no text${where}. Reason: ${reason || 'NO_ANSWER'}. The server may be busy; please try again shortly.`);
};
