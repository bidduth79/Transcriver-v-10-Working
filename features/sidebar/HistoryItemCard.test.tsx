import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

const m = vi.hoisted(() => ({ pressing: { value: false }, hookCalls: 0, handlers: {} as Record<string, any> }));
vi.mock('./hooks/useHistoryItemCard', () => ({
  useHistoryItemCard: () => {
    m.hookCalls++;
    const h = { handleStart: vi.fn(), handleMove: vi.fn(), handleEnd: vi.fn(), handleClick: vi.fn(), handleTouchEnd: vi.fn() };
    m.handlers = h;
    return { isPressing: m.pressing.value, ...h, formatProcessingTime: (t: string) => `fmt(${t})` };
  },
}));

import { HistoryItemCard } from './HistoryItemCard';

const base = { id: 'a', fileName: 'news_clip#1  final.mp3', date: '2026-10-22T08:05:00Z', duration: '3:00', timeTaken: '12s', transcript: 'T' };
const colors = { text: 'text-p' };
const setup = (over: any = {}, matches: string[] = []) => {
  const props = {
    item: base, activeHistoryId: null, loadHistoryItem: vi.fn(), onDeleteHistoryItem: vi.fn(), isDark: true, activeColors: colors,
    appLang: 'en', getSensitiveMatches: () => matches, isDuplicate: false, toggleFavorite: vi.fn(), ...over,
  };
  return { ...render(<HistoryItemCard {...props} />), props };
};

beforeEach(() => { vi.clearAllMocks(); m.pressing.value = false; m.hookCalls = 0; });

describe('HistoryItemCard markup', () => {
  it.each([
    ['default dark', {}, []],
    ['default light bn, favorite, opened, positive', { isDark: false, appLang: 'bn', item: { ...base, isFavorite: true, hasBeenOpened: true, bgbRemark: 'Positive' } }, []],
    ['active dark, opened, negative', { activeHistoryId: 'a', item: { ...base, hasBeenOpened: true, bgbRemark: 'Negative' } }, ['x']],
    ['active light', { activeHistoryId: 'a', isDark: false }, []],
    ['duplicate dark + light neutral', { isDuplicate: true, item: { ...base, bgbRemark: 'Neutral' } }, []],
    ['duplicate light', { isDuplicate: true, isDark: false }, []],
    ['sensitive one match', {}, ['মাদক']],
    ['duplicate and sensitive (duplicate color wins)', { isDuplicate: true }, ['মাদক']],
    ['sensitive many matches light', { isDark: false }, ['মাদক', 'অস্ত্র', 'সীমান্ত']],
    ['pressing dark bn', { pressing: true, appLang: 'bn', isDuplicate: true }, ['মাদক']],
    ['pressing light', { pressing: true, isDark: false, activeHistoryId: 'a' }, []],
  ])('%s', (_n, over: any, matches) => {
    m.pressing.value = !!over.pressing;
    expect(setup(over, matches).container.innerHTML).toMatchSnapshot();
  });
});

describe('HistoryItemCard behavior', () => {
  it('wires press/hold handlers on the card', () => {
    const { container } = setup();
    const card = container.firstElementChild as HTMLElement;
    fireEvent.mouseDown(card); fireEvent.mouseMove(card); fireEvent.mouseUp(card); fireEvent.mouseLeave(card); fireEvent.click(card);
    fireEvent.touchStart(card); fireEvent.touchMove(card); fireEvent.touchCancel(card); fireEvent.touchEnd(card);
    const h = m.handlers;
    expect([h.handleStart, h.handleMove, h.handleEnd, h.handleClick, h.handleTouchEnd].map(f => f.mock.calls.length)).toEqual([2, 2, 3, 1, 1]);
  });

  it('toggles favorite without triggering the card', () => {
    const { container, props } = setup();
    const star = container.querySelector('button') as HTMLElement;
    fireEvent.mouseDown(star); fireEvent.click(star);
    expect(props.toggleFavorite).toHaveBeenCalledWith('a');
    expect(m.handlers.handleStart).not.toHaveBeenCalled();
    expect(m.handlers.handleClick).not.toHaveBeenCalled();
  });

  it('opens the item at a clicked keyword', () => {
    const { container, props } = setup({}, ['মাদক', 'অস্ত্র']);
    const spans = Array.from(container.querySelectorAll('span.bg-red-600')) as HTMLElement[];
    fireEvent.click(spans[0]);
    expect(props.loadHistoryItem).toHaveBeenLastCalledWith(base, 'মাদক');
    fireEvent.click(spans.at(-1)!);
    expect(props.loadHistoryItem).toHaveBeenLastCalledWith(base, 'অস্ত্র');
    expect(m.handlers.handleClick).not.toHaveBeenCalled();
  });

  it('only re-renders when relevant props change', () => {
    const { rerender, props } = setup();
    // Props accumulate so each step changes exactly one prop
    let cur: any = { ...props };
    const r = (over: any) => { cur = { ...cur, ...over }; rerender(<HistoryItemCard {...cur} />); };
    const calls = () => m.hookCalls;
    const start = calls();
    r({ activeHistoryId: 'other' }); r({ loadHistoryItem: vi.fn() }); r({ toggleFavorite: vi.fn() });
    expect(calls()).toBe(start);
    r({ activeHistoryId: 'a' }); expect(calls()).toBe(start + 1);
    r({ isDuplicate: true }); r({ isDark: false }); r({ appLang: 'bn' }); r({ getSensitiveMatches: () => [] }); r({ activeColors: { text: 'y' } }); r({ item: { ...base } });
    expect(calls()).toBe(start + 7);
  });
});
