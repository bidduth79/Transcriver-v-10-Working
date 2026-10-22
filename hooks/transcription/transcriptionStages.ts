type Lang = 'bn' | 'en';

const pick = (lang: Lang, bn: string, en: string) => (lang === 'bn' ? bn : en);

export const getDecodingStage = (lang: Lang) =>
  pick(lang, 'অডিও সিগন্যাল ডিকোড করা হচ্ছে...', 'Decoding audio signals...');

// Simulated pipeline stage label shown while waiting for the AI response
export const getProgressStage = (progress: number, lang: Lang): string => {
  if (progress < 15) return getDecodingStage(lang);
  if (progress < 30) return pick(lang, 'ভয়েস অ্যাক্টিভিটি ডিটেকশন (VAD) চলছে...', 'Running Voice Activity Detection (VAD)...');
  if (progress < 45) return pick(lang, 'নিউরাল স্পিচ রিকগনিশন মডেল ইনিশিয়ালাইজ হচ্ছে...', 'Initializing neural speech recognition models...');
  if (progress < 60) return pick(lang, 'অডিও ফিচার এক্সট্রাকশন এবং টোকেনাইজেশন চলছে...', 'Audio feature extraction and tokenization...');
  if (progress < 75) return pick(lang, 'এআই ইনফারেন্স এবং টেক্সট জেনারেশন চলছে...', 'AI inference and text generation in progress...');
  if (progress < 90) return pick(lang, 'ন্যাচারাল ল্যাঙ্গুয়েজ প্রসেসিং (NLP) প্রয়োগ করা হচ্ছে...', 'Applying Natural Language Processing (NLP)...');
  return pick(lang, 'ফাইনাল আউটপুট অপ্টিমাইজ ও ফরম্যাটিং করা হচ্ছে...', 'Optimizing and formatting final output...');
};
