import type { SpeakerBgbMention } from '../types/speaker';

const BGB_KEYWORDS = [
  'বিজিবি', 'বর্ডার গার্ড', 'বর্ডার গার্ড বাংলাদেশ', 'bgb', 'border guard',
  'সীমান্ত', 'সীমান্তে', 'সীমান্তবর্তী', 'সীমান্ত হত্যা', 'ফেলানী',
  'বিডিআর', 'পিলখানা', 'বিএসএফ', 'bsf', 'চোরাচালান', 'অনুপ্রবেশ'
];

const LOWER_BGB_KEYWORDS = BGB_KEYWORDS.map(kw => kw.toLowerCase());
const POSITIVE_WORDS = ['সাহসী', 'বীরত্ব', 'ধন্যবাদ', 'প্রশংসা', 'পাহারায়', 'নিরাপত্তা', 'সতর্ক', 'শক্তিশালী', 'গর্ব'];
const CRITICAL_WORDS = ['ব্যর্থ', 'অসহায়', 'হত্যা', 'গুলি', 'দুর্নীতি', 'নিষ্ক্রিয়', 'দায়িত্বজ্ঞানহীন', 'অভিযোগ', 'বর্বরোচিত', 'অন্যায়'];

const SPEAKER_BOLD_REGEX = /^(\[[0-9০-৯]{1,2}:[0-9০-৯]{2}(?::[0-9০-৯]{2})?\])?\s*\*\*([^*]+)\*\*:\s*(.*)$/;
const SPEAKER_PLAIN_REGEX = /^(\[[0-9০-৯]{1,2}:[0-9০-৯]{2}(?::[0-9০-৯]{2})?\])?\s*([A-Za-z0-9\u0980-\u09FF\s._-]+):\s*(.*)$/;

export interface SpeakerScanRecord { id: string; fileName: string; date: string; transcript: string }

// Finds the target speaker's lines and BGB-related mentions in one transcript
export const scanTranscriptForSpeaker = (rec: SpeakerScanRecord, normTarget: string) => {
  const mentions: SpeakerBgbMention[] = [];
  const lines = rec.transcript.split('\n');
  let speakerFoundInThisFile = false;
  const speakersInThisFile = new Set<string>();

  lines.forEach((line) => {
    // Regex to capture timestamp and speaker: [00:15] **Speaker Name:** or **Speaker Name:** or Speaker Name:
    const speakerMatch = line.match(SPEAKER_BOLD_REGEX) || line.match(SPEAKER_PLAIN_REGEX);

    if (speakerMatch) {
      const timestamp = speakerMatch[1] ? speakerMatch[1].replace(/[\[\]]/g, '') : '';
      const detectedSpeaker = speakerMatch[2].trim();
      const speechText = speakerMatch[3] ? speakerMatch[3].trim() : '';

      const normDetected = detectedSpeaker.toLowerCase();
      speakersInThisFile.add(detectedSpeaker);

      // Check if this dialogue belongs to the target speaker
      if (normDetected === normTarget || normDetected.includes(normTarget) || normTarget.includes(normDetected)) {
        speakerFoundInThisFile = true;

        // Check if speechText contains BGB keywords
        const lowerSpeech = speechText.toLowerCase();
        const hasBgbKeyword = LOWER_BGB_KEYWORDS.some(kw => lowerSpeech.includes(kw));

        if (hasBgbKeyword && speechText.length > 5) {
          // Sentiment estimation
          let sentiment: 'supportive' | 'neutral' | 'critical' = 'neutral';

          const hasPos = POSITIVE_WORDS.some(w => speechText.includes(w));
          const hasCrit = CRITICAL_WORDS.some(w => speechText.includes(w));

          if (hasCrit && !hasPos) sentiment = 'critical';
          else if (hasPos && !hasCrit) sentiment = 'supportive';

          mentions.push({
            historyId: rec.id,
            fileName: rec.fileName,
            date: rec.date,
            timestamp: timestamp || undefined,
            quote: speechText,
            context: line,
            sentiment
          });
        }
      }
    } else {
      // Line without direct speaker header, but if target speaker was found or transcript is raw
      const lowerLine = line.toLowerCase();
      if ((lowerLine.includes(normTarget)) && LOWER_BGB_KEYWORDS.some(kw => lowerLine.includes(kw))) {
        mentions.push({
          historyId: rec.id,
          fileName: rec.fileName,
          date: rec.date,
          quote: line.trim(),
          context: line.trim(),
          sentiment: 'neutral'
        });
      }
    }
  });

  return { speakerFoundInThisFile, speakersInThisFile, mentions };
};
