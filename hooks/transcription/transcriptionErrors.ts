export const isKeyOrProjectBlockedError = (err: any): boolean => {
  const msg = (typeof err === 'string' ? err : (err?.message || '')).toLowerCase();
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

export const formatErrorMessage = (rawError: any, lang: 'bn' | 'en', keyInfo?: string): string => {
  let rawMsg = typeof rawError === 'string' ? rawError : (rawError?.message || "Unknown error occurred");

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

// Throws for blocked/limited responses; otherwise returns the "no speech" placeholder text.
export const resolveEmptyTranscript = (finishReason: string | undefined, lang: 'bn' | 'en'): string => {
  if (finishReason === 'SAFETY') {
    throw new Error(lang === 'bn'
      ? 'এআই নিরাপত্তা নীতিমালার কারণে এই অডিওটির ট্রান্সক্রিপশন সম্পন্ন করা সম্ভব হয়নি।'
      : 'Transcription was blocked by AI safety policy.');
  } else if (finishReason === 'RECITATION') {
    throw new Error(lang === 'bn'
      ? 'অডিওটিতে থাকা বক্তব্য/উদ্ধৃতি কপিরাইট বা রিসিটেশন ফিল্টারে পড়েছে। অনুগ্রহ করে Settings থেকে অন্য কোনো মডেল (যেমন: Gemini 2.5 Flash বা 3.1 Lite) অথবা Normal মোড দিয়ে পুনরায় চেষ্টা করুন।'
      : 'Transcription was blocked due to copyright or recitation policies. Please select another model in Settings or try Normal mode.');
  } else if (finishReason === 'MAX_TOKENS') {
    throw new Error(lang === 'bn'
      ? 'টোকেন লিমিট পূর্ণ হয়ে গেছে। অনুগ্রহ করে অডিও ফাইলটি ছোট করে পুনরায় চেষ্টা করুন।'
      : 'Token limit reached. Please use a shorter audio clip.');
  }
  return lang === 'bn'
    ? '[কোনো কথা বা কণ্ঠস্বর সনাক্ত করা যায়নি / No audible speech detected]'
    : '[No audible speech detected in audio file]';
};
