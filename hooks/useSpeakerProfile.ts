import { useState, useCallback } from 'react';
import { getActiveProvider, incrementTotalCalls } from '../services/ApiKeyManager';
import { SpeakerProfile, SpeakerCustomNote } from '../types/speaker';
import { scanDatabaseForSpeaker, getCustomNote, saveCustomNote } from '../services/speakerArchiveService';
import { getCachedProfile, setCachedProfile } from './speakerProfileUtils';
import { buildSpeakerProfilePrompt } from './speakerProfile/speakerProfilePrompt';
import { generateProfileResponse, parseProfileJson, enrichProfileFromWiki, getSpeakerProfileErrorMessage } from './speakerProfile/fetchSpeakerProfile';
import { createGeminiClient } from '../services/apiKeys/geminiClient';

export const useSpeakerProfile = (transcriptContext: string) => {
  const [isOpen, setIsOpen] = useState(false);
  const [speakerName, setSpeakerName] = useState('');
  const [profile, setProfile] = useState<SpeakerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const updateCustomNote = useCallback((newNote: SpeakerCustomNote) => {
    saveCustomNote(newNote);
    setProfile(prev => prev ? { ...prev, customNote: newNote } : null);
    if (speakerName) {
      const cached = getCachedProfile(speakerName);
      if (cached) {
        cached.customNote = newNote;
        setCachedProfile(speakerName, cached);
      }
    }
  }, [speakerName]);

  const openProfile = useCallback(async (name: string, ignoreCache: boolean = false) => {
    setSpeakerName(name);
    setIsOpen(true);
    setError('');

    // Load custom team notes immediately
    const existingCustomNote = getCustomNote(name);

    // 1. Scan local/cloud database archives for this speaker
    const dbStatsPromise = scanDatabaseForSpeaker(name, transcriptContext);

    // Check cache first
    if (!ignoreCache) {
      const cached = getCachedProfile(name);
      if (cached) {
        // Refresh dbStats and note in case new files arrived
        const currentStats = await dbStatsPromise;
        const refreshed = { ...cached, databaseStats: currentStats, customNote: existingCustomNote || cached.customNote };
        setProfile(refreshed);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    setProfile(null);

    try {
      const provider = await getActiveProvider();
      const apiKey = provider?.key;
      if (!apiKey) throw new Error("এপিআই কি (API Key) কনফিগার করা নেই। Settings থেকে ঠিক করুন।");

      const ai = createGeminiClient(apiKey);
      const { response, modelToUse } = await generateProfileResponse(ai, buildSpeakerProfilePrompt(name, transcriptContext), provider?.model);

      await incrementTotalCalls('Speaker Profile', modelToUse, provider.source);

      const text = response.text || '';
      const parsedProfile = parseProfileJson(text);

      if (parsedProfile) {
        await enrichProfileFromWiki(parsedProfile, name);

        // Wait for database scan
        const dbStats = await dbStatsPromise;
        parsedProfile.databaseStats = dbStats;
        parsedProfile.customNote = existingCustomNote || undefined;

        setProfile(parsedProfile);
        setCachedProfile(name, parsedProfile);
      } else {
        throw new Error("Failed to parse profile data from AI");
      }
    } catch (err) {
      setError(getSpeakerProfileErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [transcriptContext]);

  const closeProfile = useCallback(() => setIsOpen(false), []);
  const refreshProfile = useCallback(() => openProfile(speakerName, true), [openProfile, speakerName]);

  return {
    isOpen,
    speakerName,
    profile,
    isLoading,
    error,
    openProfile,
    closeProfile,
    refreshProfile,
    updateCustomNote
  };
};