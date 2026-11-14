import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';

const m = vi.hoisted(() => ({ fix: vi.fn(), save: vi.fn(async () => {}), model: 'gemini-3.5-flash' }));
vi.mock('../../../hooks/transcription/punctuationFix', () => ({ fixPunctuation: m.fix }));
vi.mock('../../../hooks/history/saveHistoryTranscript', () => ({ saveHistoryTranscript: m.save }));
vi.mock('../../../services/ApiKeyManager', () => ({
  getActiveProvider: async () => ({ key: 'KEY', source: 'Main', model: m.model }),
  getActiveModel: () => m.model,
}));

import { PunctuationButton } from './PunctuationButton';

afterEach(() => { cleanup(); m.fix.mockReset(); m.save.mockClear(); m.model = 'gemini-3.5-flash'; });

const Harness = ({ addToast }: { addToast: () => void }) => {
  const [text, setText] = useState('[00:00] **A:** এক দুই');
  return (
    <>
      <PunctuationButton transcript={text} setTranscript={setText} activeHistoryId="h1" appLang="en" addToast={addToast} />
      <output>{text}</output>
    </>
  );
};

describe('PunctuationButton', () => {
  it('fixes the transcript, saves it, and can go back to the text before', async () => {
    m.fix.mockResolvedValue({ text: '[00:00] **A:** এক, দুই।', changedLines: 1, keptLines: 0, requests: 1 });
    const addToast = vi.fn();
    const { getByText, container } = render(<Harness addToast={addToast} />);
    fireEvent.click(getByText('Punctuation'));
    await waitFor(() => expect(container.querySelector('output')!.textContent).toBe('[00:00] **A:** এক, দুই।'));
    expect(m.fix).toHaveBeenCalledWith('[00:00] **A:** এক দুই', 'KEY', 'gemini-3.5-flash');
    expect(m.save).toHaveBeenCalledWith('h1', '[00:00] **A:** এক, দুই।');
    expect(addToast).toHaveBeenCalledWith('Punctuation fixed in 1 paragraph(s); 0 kept as they were because more than punctuation would have changed', 'success');

    fireEvent.click(getByText('Undo'));
    await waitFor(() => expect(container.querySelector('output')!.textContent).toBe('[00:00] **A:** এক দুই'));
    expect(m.save).toHaveBeenLastCalledWith('h1', '[00:00] **A:** এক দুই');
  });

  it('asks the default model when the transcribe model is chosen, and reports a failure', async () => {
    m.model = 'gemini-3.5-transcribe';
    m.fix.mockRejectedValue(new Error('429 quota'));
    const addToast = vi.fn();
    const { getByText } = render(<Harness addToast={addToast} />);
    fireEvent.click(getByText('Punctuation'));
    await waitFor(() => expect(addToast).toHaveBeenCalledWith('Punctuation could not be fixed: 429 quota', 'error'));
    expect(m.fix).toHaveBeenCalledWith(expect.any(String), 'KEY', 'gemini-3.8-flash');
    expect(m.save).not.toHaveBeenCalled();
  });
});
