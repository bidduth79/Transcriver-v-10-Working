import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { TranscriptSidebarTools } from './TranscriptSidebarTools';

afterEach(cleanup);

const baseProps = {
  sensitiveMatches: [] as string[],
  sensitiveWordCounts: [],
  appLang: 'en',
  isDark: false,
  searchTerm: '',
  goToNextMatch: vi.fn(),
  handleSearchChange: vi.fn(),
  isBgbAnalysisEnabled: false,
  setIsBgbAnalysisEnabled: vi.fn(),
  bgbAnalysisResult: null,
  isAnalyzing: false,
  triggerAnalysis: vi.fn(),
  transcript: '',
  onRenameSpeaker: vi.fn(),
};

describe('TranscriptSidebarTools', () => {
  it('shows nothing without sensitive words or speakers', () => {
    const { container } = render(<TranscriptSidebarTools {...baseProps} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the speakers below the BGB analysis', () => {
    const { container, getByText } = render(
      <TranscriptSidebarTools {...baseProps} sensitiveMatches={['word']} sensitiveWordCounts={[{ word: 'word', count: 1 }]} transcript="[00:00] **Speaker 1:** text" />,
    );
    const text = container.textContent ?? '';
    expect(text.indexOf('BGB Analysis')).toBeGreaterThan(-1);
    expect(text.indexOf('Speaker 1')).toBeGreaterThan(text.indexOf('BGB Analysis'));
    expect(getByText('Speaker 1')).toBeTruthy();
  });

  it('shows only the speakers when there are no sensitive words', () => {
    const { container } = render(<TranscriptSidebarTools {...baseProps} transcript="[00:00] **Speaker 1:** text" />);
    expect(container.textContent).toContain('Speaker 1');
    expect(container.textContent).not.toContain('BGB Analysis');
  });
});
