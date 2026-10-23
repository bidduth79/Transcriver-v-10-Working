import type { AIModelDefinition } from './aiModels';

export const AVAILABLE_MODELS: AIModelDefinition[] = [
  // 1. FAST CATEGORY
  {
    id: 'gemini-3.5-transcribe',
    label: 'Gemini 3.5 Transcribe',
    badge: 'Audio Specialist',
    category: 'fast',
    categoryLabelBn: '⚡ দ্রুতগতির',
    categoryLabelEn: 'Fast',
    speedBadgeBn: 'অতি দ্রুত',
    thinkingBehavior: 'none',
    infoBn: {
      howItWorks: 'এটি অডিও ট্রান্সক্রিপশনের জন্য বিশেষভাবে তৈরি ডেডিকেটেড স্পিচ-টু-টেক্সট মডেল। কোনো অতিরিক্ত থিংকিং ছাড়াই সরাসরি অডিও সিগন্যাল থেকে বাংলা টেক্সট তৈরি করে।',
      speedAndTime: 'অত্যন্ত দ্রুত (সাধারণ মডেলের চেয়ে ৪০%–৫০% কম সময় নেয়)।',
      bestFor: 'ভয়েস নোট, ফোন কল, ইন্টারভিউ এবং দ্রুত সাধারণ অডিও ট্রান্সক্রাইব করার জন্য সেরা।',
      quotaInfo: 'উচ্চ কোটা লিমিট (কোটা মনিটর → সীমা বদলান)'
    }
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash Lite',
    badge: 'Fastest',
    category: 'fast',
    categoryLabelBn: '⚡ দ্রুতগতির',
    categoryLabelEn: 'Fast',
    speedBadgeBn: 'সবচেয়ে দ্রুত',
    thinkingBehavior: 'none',
    infoBn: {
      howItWorks: 'সবচেয়ে হালকা (Lightweight) ও উচ্চগতির মডেল। থিংকিং প্রসেস ছাড়াই তাৎক্ষণিক রেসপন্স দেয়।',
      speedAndTime: 'চোখের পলকে আউটপুট দেয় (সর্বনিম্ন ল্যাটেন্সি)।',
      bestFor: 'ছোট অডিও ক্লিপ, দ্রুত পরীক্ষা বা একসাথে অনেকগুলো ফাইল ব্যাচ প্রসেস করার জন্য আদর্শ।',
      quotaInfo: 'উচ্চ কোটা লিমিট (কোটা মনিটর → সীমা বদলান)'
    }
  },

  // 2. BALANCED CATEGORY
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    badge: 'Default & Latest',
    category: 'balanced',
    categoryLabelBn: '⚖️ ব্যালেন্সড',
    categoryLabelEn: 'Balanced',
    speedBadgeBn: 'দ্রুত ও আধুনিক',
    thinkingBehavior: 'minimal',
    infoBn: {
      howItWorks: 'সর্বশেষ প্রজন্মের ফ্ল্যাশ ইঞ্জিন। ব্যাকগ্রাউন্ড মিউজিক, ইন্ট্রো জিংগেল ও শোরগোলের মধ্যেও মানুষের কণ্ঠস্বর নিখুঁতভাবে আলাদা করতে পারে।',
      speedAndTime: 'দ্রুত (লো-থিংকিং অপ্টিমাইজড)।',
      bestFor: 'টিভি টকশো, নিউজ ব্রডকাস্ট এবং ইংরেজি-বাংলা মিশ্রিত কথোপকথনের সাবলীল বাংলা অনুবাদের জন্য।',
      quotaInfo: 'উচ্চ কোটা লিমিট (কোটা মনিটর → সীমা বদলান)'
    }
  },
  {
    id: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    badge: 'Balanced',
    category: 'balanced',
    categoryLabelBn: '⚖️ ব্যালেন্সড',
    categoryLabelEn: 'Balanced',
    speedBadgeBn: 'দ্রুত',
    thinkingBehavior: 'minimal',
    infoBn: {
      howItWorks: 'গতি এবং ভাষাগত নির্ভুলতার ভারসাম্য বজায় রেখে দীর্ঘ অডিও প্যারাগ্রাফ আকারে ট্রান্সক্রাইব করে।',
      speedAndTime: 'দ্রুত ও ধারাবাহিক।',
      bestFor: 'মাঝারি থেকে বড় দৈর্ঘ্যের আলোচনা, সেমিনার বা মিটিং অডিওর জন্য।',
      quotaInfo: 'উচ্চ কোটা লিমিট (কোটা মনিটর → সীমা বদলান)'
    }
  },

  // 3. THINKING / SLOW CATEGORY
  {
    id: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro Preview',
    badge: 'Max Reasoning',
    category: 'thinking',
    categoryLabelBn: '🧠 থিংকিং/স্লো',
    categoryLabelEn: 'Thinking / Slow',
    speedBadgeBn: 'ধীরগতি (সর্বোচ্চ মেধা)',
    thinkingBehavior: 'deep',
    infoBn: {
      howItWorks: 'সর্বোচ্চ স্তরের রিজনিং ও থিংকিং মডেল। জটিল কারিগরি শব্দ, বহু-ভাষিক অনুবাদ এবং সারসংক্ষেপ তৈরিতে সবচেয়ে শক্তিশালী।',
      speedAndTime: 'ধীরগতি (গভীর থিংকিংয়ের কারণে বেশি সময় নেয়)।',
      bestFor: 'জটিল তদন্ত রিপোর্ট, বিজিবি/নিরাপত্তা বিশ্লেষণ এবং বিশেষজ্ঞ পর্যায়ের ট্রান্সক্রিপশনের জন্য।',
      quotaInfo: 'সীমিত ফ্রি কোটা (কোটা মনিটর → সীমা বদলান)'
    }
  }
];
