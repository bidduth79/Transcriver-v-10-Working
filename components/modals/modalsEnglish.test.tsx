import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useThemeStore } from '../../hooks/useThemeStore';
import type { ActiveColors } from '../../hooks/useAppTheme';
import type { SpeakerProfile } from '../../types/speaker';
import { SpeakerSidebarTabs } from './speaker/SpeakerSidebarTabs';
import { SpeakerProfileTab } from './SpeakerProfileTab';
import { SpeakerArchiveTab } from './SpeakerArchiveTab';
import { SpeakerNotesTab } from './SpeakerNotesTab';
import { SpeakerResearchTab } from './SpeakerResearchTab';
import { ReportGenerateView } from './report/ReportGenerateView';
import { ReportHistoryView } from './report/ReportHistoryView';
import { ReportModalHeader } from './report/ReportModalHeader';
import { SummaryModalHeader } from './summary/SummaryModalHeader';

const BENGALI = /[ঀ-৿]/;
const colors = { primary: 'bg-p', text: 't', border: 'b' } as unknown as ActiveColors;
const profile = {
  name: 'Speaker', description: 'About', bgbViews: 'Views',
  customNote: { roleOrDesignation: 'Analyst', notes: 'Note', tags: ['tag'], updatedAt: 'today' },
} as unknown as SpeakerProfile;
const dbStats = { totalAppearances: 4, bgbMentionCount: 2, overallStance: 'critical', mentions: [], coSpeakers: [{ name: 'Other', count: 2 }] } as never;
const noop = vi.fn();

beforeEach(() => useThemeStore.setState({ appLang: 'en' }));
afterEach(() => { cleanup(); useThemeStore.setState({ appLang: 'bn' }); });

describe('modal parts in English', () => {
  it.each([
    ['speaker tabs', <SpeakerSidebarTabs activeTab="profile" setActiveTab={noop} profile={profile} isDark />],
    ['speaker profile', <SpeakerProfileTab profile={profile} dbStats={dbStats} isDark />],
    ['speaker archive', <SpeakerArchiveTab dbStats={dbStats} isDark mentions={[]} parseTimestampToSeconds={() => null} />],
    ['speaker notes', <SpeakerNotesTab profile={profile} isEditingNote={false} setIsEditingNote={noop} noteRole="" setNoteRole={noop} noteTags={[]} handleRemoveTag={noop} newTagInput="" setNewTagInput={noop} handleAddTag={noop} noteText="" setNoteText={noop} handleSaveNote={noop} isDark={false} />],
    ['speaker research', <SpeakerResearchTab searchGoogleUrl="#" searchGoogleNewsUrl="#" searchYouTubeUrl="#" searchFacebookUrl="#" profile={profile} isDark />],
    ['report prompt', <ReportGenerateView report="" loading={false} searchTerm="term" isDark activeColors={colors} onGenerate={noop} onCopy={noop} onDownload={noop} />],
    ['report loading', <ReportGenerateView report="" loading searchTerm="term" isDark activeColors={colors} onGenerate={noop} onCopy={noop} onDownload={noop} />],
    ['report history', <ReportHistoryView reportHistory={[]} selectedReport={null} setSelectedReport={noop} isDark activeColors={colors} onDelete={noop} onCopy={noop} onDownload={noop} />],
    ['report header', <ReportModalHeader activeColors={colors} viewMode="generate" historyCount={3} onSelectView={noop} setIsMinimized={noop} isMaximized={false} setIsMaximized={noop} onClose={noop} closeLabel="Close" />],
    ['summary header', <SummaryModalHeader activeColors={colors} viewMode="current" onSelectView={noop} onMinimize={noop} onToggleMaximize={noop} onClose={noop} closeLabel="Close" />],
  ])('%s shows no Bengali text', (_name, element) => {
    const { container } = render(element);
    const titles = Array.from(container.querySelectorAll('[title],[placeholder]')).map(el => `${el.getAttribute('title') ?? ''}${el.getAttribute('placeholder') ?? ''}`);
    expect(container.textContent).not.toMatch(BENGALI);
    expect(titles.join(' ')).not.toMatch(BENGALI);
  });

  it('still shows the Bengali text in Bengali', () => {
    useThemeStore.setState({ appLang: 'bn' });
    const { container } = render(<SummaryModalHeader activeColors={colors} viewMode="current" onSelectView={noop} onMinimize={noop} onToggleMaximize={noop} onClose={noop} closeLabel="x" />);
    expect(container.textContent).toMatch(BENGALI);
  });
});
