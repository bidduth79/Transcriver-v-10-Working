import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { SpeakerChips, listSpeakers } from './SpeakerChips';

afterEach(cleanup);

const transcript = [
  '[00:00] **Speaker 1:** শুরু।',
  '[00:20] **রহিম উদ্দিন:** উত্তর।',
  '[00:40] **Speaker 1:** আবার।',
  'ভাগ হওয়া অংশ, যেখানে **জোর দেওয়া শব্দ** আছে।',
  '[01:00] **Speaker 1:** শেষ।',
].join('\n');

describe('SpeakerChips', () => {
  it('lists the speakers of the paragraphs, the most frequent first', () => {
    expect(listSpeakers(transcript)).toEqual([{ name: 'Speaker 1', count: 3 }, { name: 'রহিম উদ্দিন', count: 1 }]);
    expect(listSpeakers('শুধু লেখা, কোনো বক্তা নেই।')).toEqual([]);
  });

  it('renames a speaker everywhere from one click, and marks unnamed speakers', () => {
    const onRename = vi.fn();
    const { getByText } = render(<SpeakerChips transcript={transcript} isDark={false} appLang="bn" onRename={onRename} />);
    const unnamed = getByText('Speaker 1').closest('button')!;
    expect(unnamed.className).toContain('amber');
    expect(getByText('রহিম উদ্দিন').closest('button')!.className).not.toContain('amber');
    fireEvent.click(unnamed);
    expect(onRename).toHaveBeenCalledWith('Speaker 1');
  });

  it('shows nothing when no paragraph names a speaker', () => {
    const { container } = render(<SpeakerChips transcript="লেখা" isDark appLang="en" onRename={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });
});
