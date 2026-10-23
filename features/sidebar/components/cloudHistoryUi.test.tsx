import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

const m = vi.hoisted(() => ({
  configured: true, older: vi.fn(), days: vi.fn(), toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock('../../../services/firebase', () => ({ get isFirebaseConfigured() { return m.configured; } }));
vi.mock('../../../services/firebaseSync/historyRangePull', () => ({ fetchOlderHistoryFromCloud: m.older, fetchHistoryDaysFromCloud: m.days }));
vi.mock('sonner', () => ({ toast: m.toast }));

import { LoadOlderHistoryButton } from './LoadOlderHistoryButton';
import { HistoryDatePicker } from './HistoryDatePicker';
import { translations } from '../../../translations';

const t = translations.en;
const history = [{ id: 'a', date: '2026-10-12T00:00:00.000Z' }, { id: 'b', date: '2026-10-10T08:00:00.000Z' }];
const click = async (el: Element) => { await act(async () => { fireEvent.click(el); }); };

beforeEach(() => { vi.clearAllMocks(); m.configured = true; });

describe('LoadOlderHistoryButton', () => {
  it('asks for the week before the oldest item and reports the result', async () => {
    m.older.mockResolvedValueOnce(4).mockResolvedValueOnce(0).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('x'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getByText } = render(<LoadOlderHistoryButton t={t} isDark appLang="en" history={history} />);
    for (let i = 0; i < 4; i++) await click(getByText(t.loadOlderFromCloud));
    expect(m.older).toHaveBeenCalledWith('2026-10-10T08:00:00.000Z');
    expect(m.toast.success).toHaveBeenCalledWith('4 older items added');
    expect(m.toast.info).toHaveBeenCalledWith(t.noOlderCloudData);
    expect(m.toast.error).toHaveBeenCalledTimes(2);
  });

  it('is hidden when Firebase is not configured', () => {
    m.configured = false;
    expect(render(<LoadOlderHistoryButton t={t} isDark={false} appLang="bn" history={[]} />).container.innerHTML).toBe('');
  });
});

describe('HistoryDatePicker', () => {
  const setup = (hasData: boolean) => {
    const list: any = {
      viewDate: new Date(2026, 9, 1), setViewDate: vi.fn(), isLoadingDate: false, setIsLoadingDate: vi.fn(), setIsDatePickerOpen: vi.fn(),
      calendarDays: [{ day: 5, isCurrentMonth: true, date: new Date(2026, 9, 5), dateStr: '10/5/2026' }],
      availableDateStrings: new Set(hasData ? ['10/5/2026'] : []), flatItems: [{ type: 'header', group: '10/5/2026' }],
      rowVirtualizer: { scrollToIndex: vi.fn() }, scrollToGroupWhenListed: vi.fn(),
    };
    const utils = render(<HistoryDatePicker t={t} list={list} isDark appLang="en" />);
    return { list, day: utils.getByText('5') };
  };

  it('brings a past day with no local data from the cloud and scrolls to it once listed', async () => {
    m.days.mockResolvedValue(3);
    const { list, day } = setup(false);
    await click(day);
    expect(m.days).toHaveBeenCalledWith(new Date(2026, 9, 5));
    expect(list.scrollToGroupWhenListed).toHaveBeenCalledWith('10/5/2026');
    expect(list.setIsLoadingDate.mock.calls).toEqual([[true], [false]]);
  });

  it('only scrolls (no cloud read) for a day already stored locally', async () => {
    vi.useFakeTimers();
    const { list, day } = setup(true);
    await click(day);
    act(() => { vi.advanceTimersByTime(50); });
    expect(m.days).not.toHaveBeenCalled();
    expect(list.rowVirtualizer.scrollToIndex).toHaveBeenCalledWith(0, { align: 'start' });
    vi.useRealTimers();
  });
});
