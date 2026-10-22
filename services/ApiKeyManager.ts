
import { GoogleGenAI } from "@google/genai";
import { getApiUrl } from './api.ts';
import { isLocalServerEnabled } from '../utils/config';
import { getAllFromStore, addToStore, deleteFromStore } from './db.ts';
import { STORES } from '../constants/storeNames.ts';
import { useAppStore } from '../hooks/useAppStore';

const ACTIVE_KEY_ID_STORAGE = 'manual_active_key_id';
const ACTIVE_MODEL_STORAGE = 'manual_active_model';
const SPEED_OPT_STORAGE = 'transcription_speed_opt_mode'; // 'optimized' | 'classic'
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
      quotaInfo: 'উচ্চ কোটা লিমিট (১৫ RPM / ১৫০০ RPD)'
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
      quotaInfo: 'উচ্চ কোটা লিমিট (১৫ RPM / ১৫০০ RPD)'
    }
  },
  {
    id: 'gemini-3.1-flash-lite-preview',
    label: 'Gemini 3.1 Flash Lite',
    badge: 'Ultra Light',
    category: 'fast',
    categoryLabelBn: '⚡ দ্রুতগতির',
    categoryLabelEn: 'Fast',
    speedBadgeBn: 'অতি দ্রুত',
    thinkingBehavior: 'none',
    infoBn: {
      howItWorks: 'মিনিমাল প্রসেসিংয়ে দ্রুত ট্রান্সক্রিপশন এবং প্রতিটি বক্তার সংলাপ আলাদা লাইনে সাজাতে বিশেষভাবে নির্দেশিত।',
      speedAndTime: 'অতি দ্রুত ও মেমোরি সাশ্রয়ী।',
      bestFor: 'স্পষ্ট কণ্ঠস্বরের অডিও ও দ্রুত লাইন-বাই-লাইন টাইমস্ট্যাম্প পাওয়ার জন্য।',
      quotaInfo: 'উচ্চ কোটা লিমিট (১৫ RPM / ১৫০০ RPD)'
    }
  },

  // 2. BALANCED CATEGORY
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    badge: 'Default & Best',
    category: 'balanced',
    categoryLabelBn: '⚖️ ব্যালেন্সড',
    categoryLabelEn: 'Balanced',
    speedBadgeBn: 'দ্রুত ও নিখুঁত',
    thinkingBehavior: 'minimal',
    infoBn: {
      howItWorks: 'অপ্রয়োজনীয় থিংকিং বন্ধ রেখে দ্রুতগতিতে নিখুঁত বাংলা বানান, বিরামচিহ্ন এবং একাধিক বক্তা (Speaker 1, Speaker 2 বা বক্তার নাম) শনাক্ত করে।',
      speedAndTime: 'দ্রুত ও স্থিতিশীল (অপ্টিমাইজড মোডে ৩০%–৪৫% দ্রুত কাজ করে)।',
      bestFor: 'প্রতিদিনের সব ধরনের অডিও, ইউটিউব ভিডিও এবং টিভি টকশো ট্রান্সক্রিপশনের জন্য সবচেয়ে নির্ভরযোগ্য ডিফল্ট মডেল।',
      quotaInfo: 'উচ্চ কোটা লিমিট (১৫ RPM / ১৫০০ RPD)'
    }
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    badge: 'Latest Flash',
    category: 'balanced',
    categoryLabelBn: '⚖️ ব্যালেন্সড',
    categoryLabelEn: 'Balanced',
    speedBadgeBn: 'দ্রুত ও আধুনিক',
    thinkingBehavior: 'minimal',
    infoBn: {
      howItWorks: 'সর্বশেষ প্রজন্মের ফ্ল্যাশ ইঞ্জিন। ব্যাকগ্রাউন্ড মিউজিক, ইন্ট্রো জিংগেল ও শোরগোলের মধ্যেও মানুষের কণ্ঠস্বর নিখুঁতভাবে আলাদা করতে পারে।',
      speedAndTime: 'দ্রুত (লো-থিংকিং অপ্টিমাইজড)।',
      bestFor: 'টিভি টকশো, নিউজ ব্রডকাস্ট এবং ইংরেজি-বাংলা মিশ্রিত কথোপকথনের সাবলীল বাংলা অনুবাদের জন্য।',
      quotaInfo: 'উচ্চ কোটা লিমিট (১৫ RPM / ১৫০০ RPD)'
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
      quotaInfo: 'উচ্চ কোটা লিমিট (১৫ RPM / ১৫০০ RPD)'
    }
  },
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash Preview',
    badge: 'Preview',
    category: 'balanced',
    categoryLabelBn: '⚖️ ব্যালেন্সড',
    categoryLabelEn: 'Balanced',
    speedBadgeBn: 'দ্রুত',
    thinkingBehavior: 'minimal',
    infoBn: {
      howItWorks: 'Gemini 3 সিরিজের ফ্ল্যাশ মডেল যা দ্রুত অডিও টোকেন প্রসেস করে এবং রিপিটেশন বা লুপিং এড়িয়ে চলে।',
      speedAndTime: 'দ্রুত (মিনিমাল থিংকিং)।',
      bestFor: 'দীর্ঘ বক্তৃতা ও ধারাবাহিক কথোপকথন ট্রান্সক্রিপশনের জন্য।',
      quotaInfo: 'উচ্চ কোটা লিমিট (১৫ RPM / ১৫০০ RPD)'
    }
  },

  // 3. THINKING / SLOW CATEGORY
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    badge: 'Deep Thinking',
    category: 'thinking',
    categoryLabelBn: '🧠 থিংকিং/স্লো',
    categoryLabelEn: 'Thinking / Slow',
    speedBadgeBn: 'ধীরগতি (গভীর বিশ্লেষণ)',
    thinkingBehavior: 'deep',
    infoBn: {
      howItWorks: 'আউটপুট লেখার আগে ভেতরে ভেতরে গভীরভাবে চিন্তা (Deep Reasoning) করে এবং জটিল বাক্য ও প্রেক্ষাপট মিলিয়ে দেখে।',
      speedAndTime: 'ধীরগতি (চিন্তা করার জন্য সাধারণ মডেলের চেয়ে ২০–৪৫ সেকেন্ড বেশি সময় নেয়)।',
      bestFor: 'অত্যন্ত অস্পষ্ট অডিও, জটিল আঞ্চলিক ভাষা, গভীর বিশ্লেষণমূলক রিপোর্ট বা যখন সর্বোচ্চ নির্ভুলতা প্রয়োজন।',
      quotaInfo: 'সীমিত ফ্রি কোটা (২ RPM / ৫০ RPD) — বড় ব্যাচে রেট লিমিট হতে পারে'
    }
  },
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
      quotaInfo: 'সীমিত ফ্রি কোটা (২ RPM / ৫০ RPD)'
    }
  }
];

export const getModelDefinition = (modelId: string): AIModelDefinition => {
  return (
    AVAILABLE_MODELS.find(m => m.id === modelId) ||
    AVAILABLE_MODELS.find(m => m.id === DEFAULT_MODEL)!
  );
};

export const isSpeedOptimizationEnabled = (): boolean => {
  return localStorage.getItem(SPEED_OPT_STORAGE) !== 'classic';
};

export const setSpeedOptimizationEnabled = (enabled: boolean) => {
  localStorage.setItem(SPEED_OPT_STORAGE, enabled ? 'optimized' : 'classic');
  useAppStore.getState().triggerActiveApiKeyChanged();
};

export const resetModelToClassicDefault = () => {
  localStorage.setItem(ACTIVE_MODEL_STORAGE, DEFAULT_MODEL);
  localStorage.setItem(SPEED_OPT_STORAGE, 'classic');
  useAppStore.getState().triggerActiveApiKeyChanged();
};

export const setActiveModel = (modelId: string) => {
  localStorage.setItem(ACTIVE_MODEL_STORAGE, modelId);
  useAppStore.getState().triggerActiveApiKeyChanged();
};

export const getActiveModel = () => {
  return localStorage.getItem(ACTIVE_MODEL_STORAGE) || DEFAULT_MODEL;
};

export interface UserApiKey {
  id: string;
  key: string;
  label: string;
  addedAt: string;
}

export interface ApiCallLog {
  id: string;
  timestamp: string;
  source: string;
  model: string;
  status: 'success' | 'error';
  latency?: number;
  tokens?: number;
}

export const getEnvApiKey = (): { key: string; source: string } | null => {
  const env = import.meta.env;
  const envKey = env ? (env.VITE_API_KEY_1 || env.VITE_GEMINI_API_KEY) : undefined;

  if (envKey && typeof envKey === 'string' && envKey.trim() !== '') {
    return {
      key: envKey.trim(),
      source: 'Environment (.env)'
    };
  }

  try {
    const pKey = (typeof process !== 'undefined' && process.env)
      ? (process.env.GEMINI_API_KEY || process.env.API_KEY)
      : undefined;
    if (pKey && typeof pKey === 'string' && pKey.trim() !== '') {
      return {
        key: pKey.trim(),
        source: 'Environment (Process)'
      };
    }
  } catch (e) {
    // Ignore
  }

  return null;
};

export const getActiveProvider = async () => {
  const activeId = localStorage.getItem(ACTIVE_KEY_ID_STORAGE);
  const currentModel = getActiveModel();

  if (activeId) {
    try {
      const allKeys = await getAllFromStore(STORES.API_KEYS);
      if (Array.isArray(allKeys)) {
          const selectedKey = allKeys.find((k: UserApiKey) => k.id === activeId);
          if (selectedKey && selectedKey.key) {
            return {
              id: selectedKey.id,
              key: selectedKey.key.trim(),
              model: currentModel, 
              source: selectedKey.label || 'Manual Selection'
            };
          } else {
            // Key not found in DB, clean up localStorage
            localStorage.removeItem(ACTIVE_KEY_ID_STORAGE);
            useAppStore.getState().triggerActiveApiKeyChanged();
          }
      }
    } catch (e) {
      console.error("Error fetching active key:", e);
    }
  }

  // Fallback to the newest available key in IndexedDB if activeId was not set
  try {
    const allKeys = await getAllFromStore(STORES.API_KEYS);
    if (Array.isArray(allKeys) && allKeys.length > 0) {
      const sorted = [...allKeys].sort((a: UserApiKey, b: UserApiKey) => new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime());
      if (sorted[0]?.key) {
        localStorage.setItem(ACTIVE_KEY_ID_STORAGE, sorted[0].id);
        return {
          id: sorted[0].id,
          key: sorted[0].key.trim(),
          model: currentModel,
          source: sorted[0].label || 'Default Key'
        };
      }
    }
  } catch (e) {
    // Ignore
  }

  const envProvider = getEnvApiKey();
  if (envProvider) {
    return {
      id: 'env',
      key: envProvider.key,
      model: currentModel,
      source: envProvider.source
    };
  }

  if (isLocalServerEnabled()) {
    try {
        const response = await fetch(getApiUrl('get_api_key.php'));
        if (response.ok) {
            const data = await response.json();
            if (data && data.key) {
                return {
                    id: 'local_server',
                    key: data.key.trim(),
                    model: currentModel,
                    source: 'Server Master Key'
                };
            }
        }
    } catch (e) {
        // Ignore
    }
  }

  return null;
};

/**
 * Returns alternative API keys (other saved keys + .env key) when the primary key fails
 * with "project has been denied access" (403) or quota exhaustion (429).
 */
export const getFallbackProviders = async (failedKey: string): Promise<{ id: string; key: string; source: string }[]> => {
  const fallbacks: { id: string; key: string; source: string }[] = [];
  const seenKeys = new Set<string>([failedKey.trim()]);

  try {
    const allKeys = await getAllFromStore(STORES.API_KEYS);
    if (Array.isArray(allKeys)) {
      const sorted = [...allKeys].sort((a: UserApiKey, b: UserApiKey) => new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime());
      for (const k of sorted) {
        const trimmed = (k?.key || '').trim();
        if (trimmed && !seenKeys.has(trimmed)) {
          seenKeys.add(trimmed);
          fallbacks.push({
            id: k.id,
            key: trimmed,
            source: k.label || 'Saved Key'
          });
        }
      }
    }
  } catch (e) {
    // Ignore
  }

  const envProvider = getEnvApiKey();
  if (envProvider && !seenKeys.has(envProvider.key)) {
    seenKeys.add(envProvider.key);
    fallbacks.push({
      id: 'env',
      key: envProvider.key,
      source: envProvider.source
    });
  }

  return fallbacks;
};

export const addUserApiKey = async (key: string, label: string) => {
  const newKey: UserApiKey = {
    id: Date.now().toString(),
    key: key.trim(),
    label: label.trim() || `Key ${new Date().toLocaleTimeString()}`,
    addedAt: new Date().toISOString()
  };
  
  await addToStore(STORES.API_KEYS, newKey);
  
  // Automatically activate the newly added key so the user never stays stuck on an old blocked key
  localStorage.setItem(ACTIVE_KEY_ID_STORAGE, newKey.id);
  useAppStore.getState().triggerActiveApiKeyChanged();
  
  return newKey;
};

export const getAllApiKeys = async (): Promise<UserApiKey[]> => {
  try {
      const keys = await getAllFromStore(STORES.API_KEYS);
      if (!Array.isArray(keys)) return [];
      return keys.sort((a: UserApiKey, b: UserApiKey) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  } catch (e) {
      console.error("Error getting API keys:", e);
      return [];
  }
};

export const setActiveApiKey = (id: string) => {
  localStorage.setItem(ACTIVE_KEY_ID_STORAGE, id);
  useAppStore.getState().triggerActiveApiKeyChanged();
};

export const deleteApiKey = async (id: string) => {
  await deleteFromStore(STORES.API_KEYS, id);
  if (localStorage.getItem(ACTIVE_KEY_ID_STORAGE) === id) {
    localStorage.removeItem(ACTIVE_KEY_ID_STORAGE);
    useAppStore.getState().triggerActiveApiKeyChanged();
  }
};

export const getActiveKeyId = () => {
  return localStorage.getItem(ACTIVE_KEY_ID_STORAGE);
};

export const incrementTotalCalls = async (source = 'Unknown', model = 'Unknown', keySource = 'Unknown', tokens = 0) => {
  let count = parseInt(localStorage.getItem('simple_api_count') || '0');
  count++;
  localStorage.setItem('simple_api_count', count.toString());
  logApiCall('success', model, tokens);
  return count;
};

export const getTotalCalls = async () => {
  return parseInt(localStorage.getItem('simple_api_count') || '0');
};



export const logApiCall = (status: 'success' | 'error', model: string = 'unknown', tokens: number = 0) => {
  try {
    const logsStr = localStorage.getItem('api_call_logs');
    const logs = logsStr ? JSON.parse(logsStr) : [];
    logs.push({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      model,
      status,
      tokens
    });
    // keep only last 2000
    if (logs.length > 2000) logs.shift();
    localStorage.setItem('api_call_logs', JSON.stringify(logs));
    useAppStore.getState().triggerApiCallLogged();
  } catch (e) {
    console.error("Failed to log API call:", e);
  }
};

export const getApiCallLogs = async (): Promise<ApiCallLog[]> => {
  try {
    const logsStr = localStorage.getItem('api_call_logs');
    return logsStr ? JSON.parse(logsStr) : [];
  } catch(e) {
    return [];
  }
};
