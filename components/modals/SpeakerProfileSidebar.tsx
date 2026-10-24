import React from 'react';
import { SpeakerProfile, SpeakerCustomNote } from '../../types/speaker';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useSpeakerProfileSidebarLogic } from './hooks/useSpeakerProfileSidebarLogic';
import { SpeakerProfileTab } from './SpeakerProfileTab';
import { SpeakerArchiveTab } from './SpeakerArchiveTab';
import { SpeakerNotesTab } from './SpeakerNotesTab';
import { SpeakerResearchTab } from './SpeakerResearchTab';
import { SpeakerSidebarHeader } from './speaker/SpeakerSidebarHeader';
import { SpeakerSidebarTabs } from './speaker/SpeakerSidebarTabs';
import { SpeakerSidebarStatus } from './speaker/SpeakerSidebarStatus';
import { useModalBehavior } from '../../hooks/useModalBehavior';
import { MODAL_LAYER, MODAL_BACKDROP } from '../../constants/modalLayers';

interface SpeakerProfileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  speakerName: string;
  profile: SpeakerProfile | null;
  isLoading: boolean;
  error: string;
  onRefresh?: () => void;
  onUpdateCustomNote?: (note: SpeakerCustomNote) => void;
  onSeek?: (seconds: number) => void;
}

export const SpeakerProfileSidebar: React.FC<SpeakerProfileSidebarProps> = ({
  isOpen,
  onClose,
  speakerName,
  profile,
  isLoading,
  error,
  onRefresh,
  onUpdateCustomNote,
  onSeek
}) => {
  const { isDark, appLang } = useAppTheme();
  
  const {
    activeTab, setActiveTab,
    isEditingNote, setIsEditingNote,
    noteRole, setNoteRole,
    noteText, setNoteText,
    noteTags, setNoteTags,
    newTagInput, setNewTagInput,
    handleSaveNote,
    handleAddTag,
    handleRemoveTag,
    parseTimestampToSeconds,
    searchGoogleUrl,
    searchGoogleNewsUrl,
    searchYouTubeUrl,
    searchFacebookUrl
  } = useSpeakerProfileSidebarLogic(speakerName, profile, onUpdateCustomNote);

  const { dialogProps, backdropProps } = useModalBehavior(isOpen, onClose);
  const dbStats = profile?.databaseStats;
  const mentions = dbStats?.mentions || [];

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 ${MODAL_BACKDROP} ${MODAL_LAYER.drawerBackdrop} transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        {...backdropProps}
      />
      
      {/* Sidebar */}
      <div {...dialogProps} inert={!isOpen} className={`fixed top-0 right-0 h-full w-full sm:max-w-lg shadow-2xl ${MODAL_LAYER.drawer} outline-none transform transition-transform duration-300 ease-in-out flex flex-col overflow-hidden ${isDark ? 'bg-slate-900 text-slate-100 border-l border-slate-700' : 'bg-white text-slate-800 border-l border-slate-200'} ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <SpeakerSidebarHeader
          profile={profile}
          speakerName={speakerName}
          isLoading={isLoading}
          isDark={isDark}
          appLang={appLang}
          onRefresh={onRefresh}
          onClose={onClose}
        />

        {/* Navigation Tabs */}
        <SpeakerSidebarTabs activeTab={activeTab} setActiveTab={setActiveTab} profile={profile} isDark={isDark} />

        {/* Content area */}
        <div className="flex-1 overflow-y-auto transcript-scrollbar">
          <SpeakerSidebarStatus isLoading={isLoading} error={error} isDark={isDark} />

          {!isLoading && !error && profile && (
            <div className="pb-8 animate-in fade-in duration-300">
              
              {/* TAB 1: MAIN PROFILE */}
              {activeTab === 'profile' && (
                <SpeakerProfileTab 
                  profile={profile} 
                  dbStats={dbStats} 
                  isDark={isDark} 
                />
              )}

              {/* TAB 2: DATABASE ARCHIVE & BGB HISTORY */}
              {activeTab === 'archive' && (
                <SpeakerArchiveTab 
                  dbStats={dbStats} 
                  isDark={isDark} 
                  mentions={mentions} 
                  parseTimestampToSeconds={parseTimestampToSeconds} 
                  onSeek={onSeek} 
                />
              )}

              {/* TAB 3: CUSTOM TEAM NOTES & TAGS */}
              {activeTab === 'notes' && (
                <SpeakerNotesTab 
                  profile={profile}
                  isEditingNote={isEditingNote}
                  setIsEditingNote={setIsEditingNote}
                  noteRole={noteRole}
                  setNoteRole={setNoteRole}
                  noteTags={noteTags}
                  handleRemoveTag={handleRemoveTag}
                  newTagInput={newTagInput}
                  setNewTagInput={setNewTagInput}
                  handleAddTag={handleAddTag}
                  noteText={noteText}
                  setNoteText={setNoteText}
                  handleSaveNote={handleSaveNote}
                  isDark={isDark}
                />
              )}

              {/* TAB 4: OPEN RESEARCH & DEEP SEARCH */}
              {activeTab === 'research' && (
                <SpeakerResearchTab 
                  searchGoogleUrl={searchGoogleUrl}
                  searchGoogleNewsUrl={searchGoogleNewsUrl}
                  searchYouTubeUrl={searchYouTubeUrl}
                  searchFacebookUrl={searchFacebookUrl}
                  profile={profile}
                  isDark={isDark}
                />
              )}

            </div>
          )}
        </div>
      </div>
    </>
  );
};
