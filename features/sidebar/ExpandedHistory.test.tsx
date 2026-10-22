import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

const m = vi.hoisted(() => ({ loading: { value: false }, matches: {} as Record<string, string[]>, bottomRef: vi.fn() }));
// Hook stub with real hover state; sensitive matches and lazy-loading flag come from the test
vi.mock('./hooks/useExpandedHistory', async () => {
  const { useState } = await import('react');
  return {
    useExpandedHistory: () => {
      const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
      return {
        hoveredCardId, setHoveredCardId, isHistoryLoading: m.loading.value, bottomRef: m.bottomRef,
        getSensitiveMatches: (id: string) => m.matches[id] || [], formatProcessingTime: (t: string) => `fmt:${t}`,
      };
    },
  };
});

import { ExpandedHistory } from './ExpandedHistory';

const colors = { primary: 'bg-p', text: 'text-p', ring: 'ring-p', soft: 'bg-soft', border: 'border-p' };
const t = { history: 'ইতিহাস', itemsLogged: 'items', searchHist: 'Search…', close: 'Close', historyLabelDate: 'Date' };
const items = [
  { id: 'a', fileName: 'alpha.mp3', extension: 'mp3', date: '2026-10-20T10:00:00Z', duration: '1:00', timeTaken: '5s', transcript: 'সীমান্তে মাদক আর অস্ত্র, আবার মাদক।', bgbRemark: 'Negative' },
  { id: 'b', fileName: 'beta.wav', date: '2026-10-21T10:00:00Z', duration: '2:00', timeTaken: '7s', bgbRemark: 'Positive' },
  { id: 'c', fileName: 'gamma.ogg', extension: 'ogg', date: '2026-10-22T10:00:00Z', duration: '3:00', timeTaken: '9s', transcript: 'plain', bgbRemark: 'Neutral' },
];

const setup = (over: any = {}) => {
  const props: any = {
    t, isDark: true, setIsHistoryFullscreen: vi.fn(), histSearch: '', setHistSearch: vi.fn(), histDateFilter: '', setHistDateFilter: vi.fn(),
    histSentimentFilter: 'All', setHistSentimentFilter: vi.fn(), filteredHistory: items, historyLimit: 10, setHistoryLimit: vi.fn(),
    loadHistoryItem: vi.fn(), activeColors: colors, ...over,
  };
  return { ...render(<ExpandedHistory {...props} />), props };
};
const card = (c: HTMLElement, i: number) => c.querySelectorAll('.grid > div')[i] as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  m.loading.value = false;
  m.matches = { a: ['মাদক', 'অস্ত্র', 'সীমান্ত'] };
});

describe('ExpandedHistory markup', () => {
  it('renders cards (dark) with sensitive pills and remarks', () => {
    expect(setup().container.innerHTML).toMatchSnapshot();
  });
  it('renders light theme with search text, filters and lazy-loading indicator', () => {
    m.loading.value = true;
    expect(setup({ isDark: false, histSearch: 'x', histDateFilter: '2026-10-20', histSentimentFilter: 'Negative', historyLimit: 2 }).container.innerHTML).toMatchSnapshot();
  });
  it('renders the empty state', () => {
    expect(setup({ filteredHistory: [] }).container.innerHTML).toMatchSnapshot();
  });
  it('renders hover previews with and without highlights', () => {
    const { container } = setup({ t: { ...t, history: 'History' } });
    fireEvent.mouseEnter(card(container, 0));
    expect(container.innerHTML).toMatchSnapshot('sensitive preview');
    fireEvent.mouseLeave(card(container, 0));
    fireEvent.mouseEnter(card(container, 1));
    expect(card(container, 1).textContent).toContain('No transcript content...');
  });
});

describe('ExpandedHistory behavior', () => {
  it('opens items from card, pills, highlights and preview button', () => {
    const { container, props, getByTitle } = setup();
    fireEvent.click(card(container, 2).firstElementChild!);
    expect(props.loadHistoryItem).toHaveBeenLastCalledWith(items[2]);
    fireEvent.click(Array.from(card(container, 0).querySelectorAll('.bg-red-600'))[1]);
    expect(props.loadHistoryItem).toHaveBeenLastCalledWith(items[0], 'অস্ত্র');
    expect(card(container, 0).textContent).toContain('+1');
    fireEvent.mouseEnter(card(container, 0));
    const marks = card(container, 0).querySelectorAll('mark');
    expect(Array.from(marks).map(x => x.textContent)).toEqual(['সীমান্ত', 'মাদক', 'অস্ত্র', 'মাদক']);
    const calls = props.loadHistoryItem.mock.calls.length;
    fireEvent.click(marks[1]);
    expect(props.loadHistoryItem).toHaveBeenLastCalledWith(items[0], 'মাদক');
    fireEvent.click(getByTitle('Open File'));
    expect(props.loadHistoryItem).toHaveBeenCalledTimes(calls + 2);
    expect(props.loadHistoryItem).toHaveBeenLastCalledWith(items[0]);
  });

  it('wires search, filters and close', () => {
    const { container, props, getByText } = setup({ histSearch: 'abc' });
    fireEvent.change(container.querySelector('input[type="text"]')!, { target: { value: 'new' } });
    expect(props.setHistSearch).toHaveBeenCalledWith('new');
    fireEvent.click(container.querySelector('header input[type="text"] + button')!);
    expect(props.setHistSearch).toHaveBeenLastCalledWith('');
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: '2026-10-21' } });
    expect(props.setHistDateFilter).toHaveBeenCalledWith('2026-10-21');
    fireEvent.change(container.querySelector('select')!, { target: { value: 'Neutral' } });
    expect(props.setHistSentimentFilter).toHaveBeenCalledWith('Neutral');
    fireEvent.click(getByText('Close'));
    expect(props.setIsHistoryFullscreen).toHaveBeenCalledWith(false);
    act(() => {});
    expect(m.bottomRef).toHaveBeenCalled();
  });
});
