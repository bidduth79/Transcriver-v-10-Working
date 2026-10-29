import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { FormattedTranscript } from './TranscriptViewer';
import { UNCLEAR_MARK, AD_START, AD_END } from '../../constants/instructions';

afterEach(cleanup);

// A long first paragraph is shown split, so its second half has no time of its own
const longSpeech = Array.from({ length: 12 }, (_, i) => `দীর্ঘ বক্তব্যের ${i + 1} নম্বর বাক্যটি এখানে বেশ খানিকটা লম্বা করে লেখা হয়েছে যাতে অনুচ্ছেদ বড় হয়।`).join(' ');
const text = `[01:15] **Speaker 1:** তিনি বললেন ${UNCLEAR_MARK} বাজারে গিয়েছিলেন।\n[02:40] **Speaker 2:** ${longSpeech} শেষে ${UNCLEAR_MARK} হলো।`;

describe('FormattedTranscript', () => {
  it('highlights words that could not be made out, and plays that part of the audio on click', () => {
    const onSeek = vi.fn();
    const { getAllByRole } = render(<FormattedTranscript text={text} searchTerm="" isDark={false} currentMatchIndex={0} onSeek={onSeek} />);
    const marks = getAllByRole('button').filter(b => b.textContent === UNCLEAR_MARK);
    expect(marks).toHaveLength(2);
    fireEvent.click(marks[0]);
    expect(onSeek).toHaveBeenLastCalledWith('[01:15]');
    // In the split part without a time of its own, the last time above it is used
    fireEvent.click(marks[1]);
    expect(onSeek).toHaveBeenLastCalledWith('[02:40]');
  });

  it('folds an advertisement block into one line that opens on click, and opens all while searching', () => {
    const withAd = `[15:20] **Host:** before the break
[15:32] ${AD_START}
[16:01] **Woman 1:** buy this soap
[17:10] ${AD_END}
[17:12] **Host:** welcome back`;
    const view = (searchTerm: string) => render(<FormattedTranscript text={withAd} searchTerm={searchTerm} isDark={false} currentMatchIndex={0} />);
    const { container, getByRole } = view('');
    expect(container.textContent).toContain('before the break');
    expect(container.textContent).toContain('welcome back');
    expect(container.textContent).not.toContain('buy this soap');
    const fold = getByRole('button');
    expect(fold.textContent).toContain('[15:32–17:10]');
    fireEvent.click(fold);
    expect(container.textContent).toContain('buy this soap');
    cleanup();
    expect(view('soap').container.textContent).toContain('buy this soap');
  });
});
