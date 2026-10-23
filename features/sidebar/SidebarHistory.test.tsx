import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, act } from '@testing-library/react';

const m = vi.hoisted(() => ({ scrollToIndex: vi.fn() }));

// Render every row so the full markup can be compared (jsdom has no layout for real virtualization)
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: any) => ({
    getTotalSize: () => opts.count * 100,
    getVirtualItems: () => Array.from({ length: opts.count }, (_, i) => ({ index: i, key: opts.getItemKey(i), start: i * 100 })),
    scrollToIndex: m.scrollToIndex,
  }),
}));
// Shown only when Firebase is configured; stubbed so markup does not depend on the machine's .env
vi.mock('./components/LoadOlderHistoryButton', () => ({ LoadOlderHistoryButton: () => React.createElement('div', { 'data-c': 'LoadOlderHistoryButton' }) }));
vi.mock('./HistoryItemCard', () => ({
  HistoryItemCard: ({ item, isDuplicate, activeHistoryId }: any) =>
    <div data-card={item.id} data-dup={String(isDuplicate)} data-active={String(activeHistoryId === item.id)}>{item.fileName}</div>,
}));

import { SidebarHistory } from './SidebarHistory';

const t = new Proxy({}, { get: (_, k) => `t.${String(k)}` }) as any;
const items = [
  { id: 'a', fileName: 'news_clip#1.mp3', date: '2026-10-20T10:00:00.000Z', transcript: 'hello world' },
  { id: 'b', fileName: 'talk.mp3', date: '2026-10-20T08:00:00.000Z', transcript: 'বাংলা কথা' },
  { id: 'c', fileName: 'talk.mp3', date: '2026-10-21T09:00:00.000Z', transcript: 'other text' },
];
const grouped = { '10/20/2026': [items[0], items[1]], '10/21/2026': [items[2]] };

const makeProps = (over: any = {}) => ({
  t, history: items, fullHistory: items, isLoadingHistory: false, setIsHistoryFullscreen: vi.fn(),
  groupedHistory: grouped, cardBg: 'card-bg', cardBorder: 'card-border', activeHistoryId: null,
  loadHistoryItem: vi.fn(), onDeleteHistoryItem: vi.fn(), isDark: true, activeColors: { primary: 'bg-x' },
  appLang: 'en', getSensitiveMatches: vi.fn(), bottomRef: vi.fn(), isHistoryLoading: false,
  historyLimit: 50, setHistoryLimit: vi.fn(), scrollContainerEl: null, showFavoritesOnly: false,
  setShowFavoritesOnly: vi.fn(), toggleFavorite: vi.fn(), backupHistory: vi.fn(), restoreHistory: vi.fn(),
  histSentimentFilter: 'All', setHistSentimentFilter: vi.fn(), totalHistoryCount: 3, ...over,
});

const setup = (over: any = {}) => {
  const props = makeProps(over);
  const utils = render(<SidebarHistory {...props} />);
  const btn = (title: string) => utils.container.querySelector(`button[title="${title}"]`) as HTMLElement;
  return { ...utils, props, btn };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T12:00:00'));
});
afterEach(() => vi.useRealTimers());

describe('SidebarHistory markup', () => {
  it('renders grouped list (dark)', () => {
    expect(setup().container.innerHTML).toMatchSnapshot();
  });
  it('renders grouped list (light, sentiment active, favorites on)', () => {
    const { container } = setup({ isDark: false, histSentimentFilter: 'Negative', showFavoritesOnly: true, totalHistoryCount: undefined });
    expect(container.innerHTML).toMatchSnapshot();
  });
  it('renders loading skeleton', () => {
    expect(setup({ history: [], isLoadingHistory: true, isHistoryLoading: true }).container.innerHTML).toMatchSnapshot();
  });
  it('renders empty state', () => {
    expect(setup({ history: [] }).container.innerHTML).toMatchSnapshot();
  });
  it.each([['en', true], ['bn', false]])('renders date picker (%s, dark=%s)', (appLang, isDark) => {
    const { container, btn } = setup({ appLang, isDark });
    fireEvent.click(btn('t.filterByDate'));
    expect(container.innerHTML).toMatchSnapshot();
  });
  it('renders sentiment picker', () => {
    const { container, btn } = setup({ histSentimentFilter: 'Positive' });
    fireEvent.click(btn('t.sentimentFilter'));
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe('SidebarHistory behavior', () => {
  it('filters by file name or transcript after debounce', async () => {
    const { container, btn } = setup();
    fireEvent.click(btn('t.search'));
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'news clip' } });
    await waitFor(() => expect(container.querySelectorAll('[data-card]')).toHaveLength(1));
    fireEvent.change(input, { target: { value: 'বাংলা' } });
    await waitFor(() => expect(container.querySelector('[data-card]')?.getAttribute('data-card')).toBe('b'));
    expect(container.innerHTML).toMatchSnapshot();
    fireEvent.change(input, { target: { value: 'zzz' } });
    await waitFor(() => expect(container.textContent).toContain('t.noResultsFound'));
  });

  it('marks duplicate file names', () => {
    const { container } = setup();
    expect(container.querySelector('[data-card="a"]')?.getAttribute('data-dup')).toBe('false');
    expect(container.querySelector('[data-card="b"]')?.getAttribute('data-dup')).toBe('true');
  });

  it('wires toolbar buttons to props', () => {
    const { container, btn, props } = setup();
    fireEvent.click(btn('t.showFavoritesOnly'));
    expect(props.setShowFavoritesOnly).toHaveBeenCalledWith(true);
    fireEvent.click(btn('t.backup'));
    expect(props.backupHistory).toHaveBeenCalled();
    fireEvent.click(btn('t.expand'));
    expect(props.setIsHistoryFullscreen).toHaveBeenCalledWith(true);
    const file = new File(['{}'], 'b.json');
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    expect(props.restoreHistory).toHaveBeenCalledWith(file);
  });

  it('selects sentiment and closes picker', () => {
    const { container, btn, props, getByText } = setup();
    fireEvent.click(btn('t.sentimentFilter'));
    fireEvent.click(getByText('Positive'));
    expect(props.setHistSentimentFilter).toHaveBeenCalledWith('Positive');
    expect(container.textContent).not.toContain('Neutral');
  });

  it('closes pickers on outside click and toggles between them', () => {
    const { container, btn } = setup();
    fireEvent.click(btn('t.filterByDate'));
    expect(container.textContent).toContain('October 2026');
    fireEvent.click(btn('t.sentimentFilter'));
    expect(container.textContent).not.toContain('October 2026');
    expect(container.textContent).toContain('Neutral');
    fireEvent.click(document.body);
    expect(container.textContent).not.toContain('Neutral');
  });

  it('navigates calendar months and jumps to a date group', async () => {
    const { container, btn, getByText } = setup();
    fireEvent.click(btn('t.filterByDate'));
    const [prev, next] = Array.from(container.querySelectorAll('.flex.gap-0\\.5 button')) as HTMLElement[];
    fireEvent.click(prev);
    expect(container.textContent).toContain('September 2026');
    fireEvent.click(next);
    expect(container.textContent).toContain('October 2026');
    const day20 = Array.from(container.querySelectorAll('.grid button')).find(b => b.textContent === '20' && b.getAttribute('title')) as HTMLElement;
    expect(day20.getAttribute('title')).toBe('t.hasHistory');
    fireEvent.click(day20);
    await waitFor(() => expect(m.scrollToIndex).toHaveBeenCalledWith(0, { align: 'start' }));
    await waitFor(() => expect(container.textContent).not.toContain('October 2026'));
    expect(getByText('10/21/2026')).toBeTruthy();
  });

  it('scrolls smoothly to a newly active item', async () => {
    const { rerender, props } = setup();
    await act(async () => { rerender(<SidebarHistory {...props} activeHistoryId="c" />); });
    await waitFor(() => expect(m.scrollToIndex).toHaveBeenCalledWith(4, { align: 'auto', behavior: 'smooth' }));
  });
});
