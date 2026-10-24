import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('../../components/common/DownloadMenu', () => ({ DownloadMenu: () => null }));
vi.mock('./hooks/useTranscriptToolbar', () => ({ useTranscriptToolbar: () => ({ handleDelete: vi.fn() }) }));

import { TranscriptToolbar } from './TranscriptToolbar';

const setup = (appLang: 'bn' | 'en') => {
  const props = {
    t: { outputTranscript: 'Output' }, status: 'completed', appLang, handleSummaryClick: vi.fn(), setIsReportOpen: vi.fn(),
    isDisabled: false, activeColors: {}, searchTerm: '', handleSearchChange: vi.fn(), handleKeyDown: vi.fn(), clearSearch: vi.fn(),
    transcriptSearchInputRef: { current: null }, matchCount: 0, currentMatchIndex: 0, fontSize: 16, setFontSize: vi.fn(),
    transformTranscript: vi.fn(), transformingType: null, setIsAnalysisOpen: vi.fn(), transcript: 'text', fileMeta: null,
    addToast: vi.fn(), setTranscript: vi.fn(), setStatus: vi.fn(), setActiveHistoryId: vi.fn(), sensitiveMatches: [],
  };
  // Only the fields the toolbar reads; the rest of the translations and colours are not needed here
  return { ...render(<TranscriptToolbar {...props as unknown as React.ComponentProps<typeof TranscriptToolbar>} />), props };
};

describe('TranscriptToolbar', () => {
  it('opens the full transcript preview (analysis) view', () => {
    const { container, props } = setup('en');
    fireEvent.click(container.querySelector('button[title="Full Transcript Preview"]')!);
    expect(props.setIsAnalysisOpen).toHaveBeenCalledWith(true);
    expect(props.setIsReportOpen).not.toHaveBeenCalled();
    expect(props.handleSummaryClick).not.toHaveBeenCalled();
  });

  it('keeps the summary and report buttons as before', () => {
    const { container, props } = setup('en');
    fireEvent.click(container.querySelector('button[title="Report"]')!);
    expect(props.setIsReportOpen).toHaveBeenCalledWith(true);
    fireEvent.click(container.querySelector('button[title="Search Analysis"]')!);
    expect(props.handleSummaryClick).toHaveBeenCalled();
  });
});
