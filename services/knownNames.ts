// Names of the people who speak in the user's programmes, so Gemini writes each one with the same spelling every
// time. Learned from the speaker names of saved transcripts, and added or removed by the user in Settings. A
// learned name is only used once it came up in several transcripts: a misheard name rarely comes back the same way.
const STORAGE = 'known_names';
export const MIN_TRANSCRIPTS = 3;
// The instructions stay short: the most frequent names first
export const MAX_PROMPT_NAMES = 60;

const GENERIC = /^(speaker|host|guest|anchor|unknown|male|female|interviewer|interviewee|voice|announcer|reporter|narrator|ad)\b/i;
// Roles and labels the saved transcripts use in place of a name ("বক্তা ১", "বর্ণনাকারী", "বিজ্ঞাপন", ...)
const GENERIC_BN = /^(বক্তা|স্পিকার|বর্ণনাকারী|বিজ্ঞাপন|সাক্ষাৎকার|সংবাদ ?পাঠক|উপস্থাপক|উপস্থাপিকা|অতিথি|সঞ্চালক|প্রতিবেদক|সাংবাদিক|ভাষ্যকার|দর্শক|শ্রোতা|কণ্ঠ|পুরুষ|মহিলা|নারী|অজ্ঞাত|অজানা|অন্য|গায়ক|গায়িকা|ঘোষক|প্রশ্নকর্তা|জনৈক|বিক্ষোভকারী|জনতা|সমবেত|কোরাস|স্লোগান|গান|সংগীত|আবৃত্তি)/;
// Example names from the app's own instructions, which models copied as a speaker's name (one of them is in 135
// saved transcripts): never a real speaker
const EXAMPLE_NAMES = /হাসিনা আক্তার|সাজিদুল হক/;
const SPEAKER = /^\s*[[(][^\])]*[\])]\s*\*\*([^*]+?)\*\*/gm;

interface KnownNames {
  counts: Record<string, number>;
  added: string[];
  removed: string[];
}

const read = (): KnownNames => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || '{}');
    return { counts: saved.counts ?? {}, added: saved.added ?? [], removed: saved.removed ?? [] };
  } catch {
    return { counts: {}, added: [], removed: [] };
  }
};

const write = (names: KnownNames) => {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(names));
  } catch {
    // Storage full or blocked: names are learned again later
  }
};

// The real names a transcript gives its speakers, each once
export const speakerNamesIn = (transcript: string) => {
  const names = new Set<string>();
  for (const match of transcript.matchAll(SPEAKER)) {
    const name = match[1].replace(/:$/, '').trim();
    // A number marks a stand-in ("Speaker 2", "বক্তা ১")
    if (name.length < 2 || name.length > 40 || /[0-9০-৯]/.test(name) || GENERIC.test(name) || GENERIC_BN.test(name.normalize('NFC')) || EXAMPLE_NAMES.test(name.normalize('NFC'))) continue;
    names.add(name);
  }
  return [...names];
};

export const learnNames = (transcript: string, names = read()) => {
  for (const name of speakerNamesIn(transcript)) names.counts[name] = (names.counts[name] ?? 0) + 1;
  write(names);
  return names;
};

// Learns again from every saved transcript, one at a time; how many names are offered afterwards
export const learnNamesFromHistory = async (forEachTranscript: (visit: (transcript: string) => void) => Promise<void>) => {
  const names = read();
  names.counts = {};
  await forEachTranscript(transcript => {
    for (const name of speakerNamesIn(transcript)) names.counts[name] = (names.counts[name] ?? 0) + 1;
  });
  write(names);
  return namesForPrompt().length;
};

// The user's own names, then the learned ones in order of how often they came up
export const knownNameList = () => {
  const { counts, added, removed } = read();
  const learned = Object.entries(counts)
    .filter(([name, count]) => count >= MIN_TRANSCRIPTS && !removed.includes(name) && !added.includes(name))
    .sort((a, b) => b[1] - a[1]);
  return [...added.map(name => ({ name, count: counts[name] ?? 0, added: true })), ...learned.map(([name, count]) => ({ name, count, added: false }))];
};

export const namesForPrompt = () => knownNameList().slice(0, MAX_PROMPT_NAMES).map(entry => entry.name);

export const addKnownName = (name: string) => {
  const names = read();
  const clean = name.trim();
  if (!clean || names.added.includes(clean)) return;
  write({ ...names, added: [...names.added, clean], removed: names.removed.filter(n => n !== clean) });
};

export const removeKnownName = (name: string) => {
  const names = read();
  write({ ...names, added: names.added.filter(n => n !== name), removed: [...new Set([...names.removed, name])] });
};
