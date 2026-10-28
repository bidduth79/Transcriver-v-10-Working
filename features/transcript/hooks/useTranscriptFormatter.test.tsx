import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, render, cleanup } from '@testing-library/react';
import { useTranscriptFormatter } from './useTranscriptFormatter';

afterEach(cleanup);

// "BDR" + "-er" (বিডিআর + ের) and "weapon" written with a joined letter (অস্ত্র)
const bdr = 'বিডিআর';
const bdrEr = `${bdr}ের`;
const weapon = 'অস্ত্র';

const marksOf = (searchTerm: string, sensitive: string[], text: string) => {
  const { result } = renderHook(() => useTranscriptFormatter(searchTerm, false, 0, sensitive));
  const { container } = render(<>{result.current.formatText(text, { current: 0 })}</>);
  return { marks: [...container.querySelectorAll('mark')].map(m => m.textContent), text: container.textContent };
};

describe('useTranscriptFormatter', () => {
  it('keeps a vowel sign after a highlighted word inside the highlight', () => {
    const { marks, text } = marksOf('', [bdr], `${bdrEr} x`);
    expect(marks).toEqual([`${bdr}ে`]);
    expect(text).toBe(`${bdrEr} x`);
  });

  it('keeps a joined letter after a searched part inside the highlight', () => {
    const { marks } = marksOf('অস', [], `${weapon} x`);
    expect(marks).toEqual([weapon]);
  });

  it('still highlights plain words as before', () => {
    expect(marksOf('Dhaka', ['border'], 'dhaka near the border').marks).toEqual(['dhaka', 'border']);
  });
});
