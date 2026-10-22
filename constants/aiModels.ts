export const DEFAULT_MODEL = 'gemini-2.5-flash';

export type ModelCategory = 'fast' | 'balanced' | 'thinking';

export interface AIModelInfoBn {
  howItWorks: string;
  speedAndTime: string;
  bestFor: string;
  quotaInfo: string;
}

export interface AIModelDefinition {
  id: string;
  label: string;
  badge?: string;
  category: ModelCategory;
  categoryLabelBn: string;
  categoryLabelEn: string;
  speedBadgeBn: string;
  thinkingBehavior: 'none' | 'minimal' | 'deep';
  infoBn: AIModelInfoBn;
}

export const MODEL_CATEGORY_GROUPS: {
  id: ModelCategory;
  titleBn: string;
  titleEn: string;
  subtitleBn: string;
  accentClass: string;
  badgeClass: string;
}[] = [
  {
    id: 'fast',
    titleBn: '⚡ দ্রুতগতির ও নন-থিংকিং (Super Fast)',
    titleEn: '⚡ Super Fast & Non-Thinking',
    subtitleBn: 'চিন্তা করার সময় ব্যয় না করে সরাসরি ও সবচেয়ে দ্রুত ট্রান্সক্রাইব করে',
    accentClass: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  },
  {
    id: 'balanced',
    titleBn: '⚖️ ব্যালেন্সড ও স্মার্ট ফ্ল্যাশ (Fast + Smart)',
    titleEn: '⚖️ Balanced & Smart Flash',
    subtitleBn: 'দ্রুত গতি, নিখুঁত বাংলা বানান ও একাধিক বক্তা শনাক্তকরণের সেরা সমন্বয়',
    accentClass: 'text-indigo-400',
    badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
  },
  {
    id: 'thinking',
    titleBn: '🧠 ডিপ থিংকিং ও স্লো প্রো (Deep Thinking / Slow)',
    titleEn: '🧠 Deep Thinking & High Accuracy',
    subtitleBn: 'গভীরভাবে চিন্তা করে আউটপুট দেয় (সময় বেশি লাগে, জটিল বিশ্লেষণের জন্য)',
    accentClass: 'text-amber-400',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  }
];
