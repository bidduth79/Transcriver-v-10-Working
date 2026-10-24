import { forEachHistoryRecord } from './historyRecords';
import { scanTranscriptForSpeaker, type SpeakerScanRecord } from './speakerArchiveScan';
import { SpeakerBgbMention, SpeakerDatabaseStats, SpeakerCustomNote } from '../types/speaker';
import { useHistoryStore } from '../hooks/useHistoryStore';

const CUSTOM_NOTES_STORE_KEY = 'speaker_custom_dossier_notes';

export const getCustomNote = (speakerName: string): SpeakerCustomNote | null => {
  try {
    const allNotes = JSON.parse(localStorage.getItem(CUSTOM_NOTES_STORE_KEY) || '{}');
    return allNotes[speakerName.trim().toLowerCase()] || null;
  } catch (e) {
    return null;
  }
};

export const saveCustomNote = (note: SpeakerCustomNote) => {
  try {
    const allNotes = JSON.parse(localStorage.getItem(CUSTOM_NOTES_STORE_KEY) || '{}');
    allNotes[note.speakerName.trim().toLowerCase()] = note;
    localStorage.setItem(CUSTOM_NOTES_STORE_KEY, JSON.stringify(allNotes));
  } catch (e) {
    console.error('Failed to save custom note', e);
  }
};

export const scanDatabaseForSpeaker = async (
  speakerName: string,
  currentTranscript: string = ''
): Promise<SpeakerDatabaseStats> => {
  const normTarget = speakerName.trim().toLowerCase();
  
  const scan = (rec: SpeakerScanRecord) => ({ rec, result: scanTranscriptForSpeaker(rec, normTarget) });
  const scanned: ReturnType<typeof scan>[] = [];

  // Also include the current transcript if not already in history
  if (currentTranscript && currentTranscript.trim().length > 0) {
    scanned.push(scan({
      id: 'current_session',
      fileName: 'বর্তমান অডিও/ভিডিও ফাইল',
      date: new Date().toLocaleDateString('bn-BD'),
      transcript: currentTranscript
    }));
  }

  // Saved transcripts are read from IndexedDB one at a time, then ordered like the history list
  const fromHistory = new Map<string, ReturnType<typeof scan>>();
  try {
    await forEachHistoryRecord(item => {
      if (item && item.transcript) {
        const rec = {
          id: String(item.id || item.timestamp || Math.random()),
          fileName: item.fileName || item.title || 'নামবিহীন রেকর্ড',
          date: item.date || (item.timestamp ? new Date(item.timestamp as string | number).toLocaleDateString('bn-BD') : 'অজানা তারিখ'),
          transcript: item.transcript
        };
        fromHistory.set(rec.id, scan(rec));
      }
    });
  } catch (e) {
    console.warn('Could not load history items for speaker scan:', e);
  }
  useHistoryStore.getState().history.forEach(h => {
    const found = fromHistory.get(String(h.id));
    if (found) { scanned.push(found); fromHistory.delete(String(h.id)); }
  });
  scanned.push(...fromHistory.values());

  let totalAppearances = 0;
  const filesAppeared = new Set<string>();
  const coSpeakerMap = new Map<string, number>();
  const mentions: SpeakerBgbMention[] = [];

  scanned.forEach(({ rec, result: { speakerFoundInThisFile, speakersInThisFile, mentions: fileMentions } }) => {
    mentions.push(...fileMentions);
    if (speakerFoundInThisFile) {
      totalAppearances++;
      filesAppeared.add(rec.fileName);

      // Track co-speakers
      speakersInThisFile.forEach(s => {
        const sNorm = s.trim().toLowerCase();
        if (sNorm !== normTarget && !sNorm.includes(normTarget) && !normTarget.includes(sNorm)) {
          coSpeakerMap.set(s, (coSpeakerMap.get(s) || 0) + 1);
        }
      });
    }
  });

  // Calculate overall stance
  let supportiveCount = 0;
  let criticalCount = 0;
  mentions.forEach(m => {
    if (m.sentiment === 'supportive') supportiveCount++;
    if (m.sentiment === 'critical') criticalCount++;
  });

  let overallStance: 'supportive' | 'neutral' | 'critical' | 'none' = 'none';
  if (mentions.length > 0) {
    if (supportiveCount > criticalCount) overallStance = 'supportive';
    else if (criticalCount > supportiveCount) overallStance = 'critical';
    else overallStance = 'neutral';
  }

  // Format co-speakers list sorted by count
  const coSpeakers = Array.from(coSpeakerMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    totalAppearances,
    bgbMentionCount: mentions.length,
    filesAppeared: Array.from(filesAppeared),
    coSpeakers,
    mentions: mentions.slice(0, 20), // Top 20 quotes
    overallStance
  };
};
