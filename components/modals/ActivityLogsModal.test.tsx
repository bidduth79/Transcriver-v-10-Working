import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

const m = vi.hoisted(() => ({ logs: [] as any[], getAll: vi.fn() }));
vi.mock('../../services/db', () => ({
  STORES: { SYSTEM_ACTIVITY_LOGS: 'activity_logs' },
  getAllFromStore: m.getAll,
  deleteFromStore: vi.fn(),
}));

import { ActivityLogsModal } from './ActivityLogsModal';
import { useAppStore } from '@/hooks/useAppStore';

const log = (id: string, ts: any, category: string, status: string, message: string, details?: any) => ({ id, timestamp: ts, category, status, message, details });
const sample = [
  log('1', '2026-10-20T08:00:00Z', 'TRANSCRIPTION', 'SUCCESS', 'File Transcribed', 'File: a.mp3'),
  log('2', '2026-10-22T09:30:00Z', 'API_KEY', 'ERROR', 'Key failed', { code: 403, reason: 'denied' }),
  log('3', '2026-10-21T12:00:00Z', 'SYSTEM', 'WARNING', 'Low memory'),
  log('4', 'not-a-date', 'REPORT', 'INFO', 'Odd time'),
  null,
  log('5', undefined, 'ANALYSIS', 'SUCCESS', 'No time'),
];

const renderOpen = async (props: any = {}) => {
  let u: any;
  await act(async () => { u = render(<ActivityLogsModal isOpen onClose={vi.fn()} isDark activeColors={{ primary: 'bg-p' }} appLang="bn" {...props} />); });
  return u as ReturnType<typeof render>;
};
const messages = (c: HTMLElement) => Array.from(c.querySelectorAll('p.text-sm')).map(p => p.textContent);
const select = (c: HTMLElement, i: number, value: string) => act(async () => { fireEvent.change(c.querySelectorAll('select')[i], { target: { value } }); });
const date = (c: HTMLElement, i: number, value: string) => act(async () => { fireEvent.change(c.querySelectorAll('input[type="date"]')[i], { target: { value } }); });

beforeEach(() => {
  vi.clearAllMocks();
  m.logs = sample;
  m.getAll.mockImplementation(async () => m.logs);
});

describe('ActivityLogsModal markup', () => {
  it('renders nothing when closed', () => {
    expect(render(<ActivityLogsModal isOpen={false} onClose={vi.fn()} isDark activeColors={{}} appLang="bn" />).container.innerHTML).toBe('');
  });

  it('renders sorted logs (dark, bn)', async () => {
    const { container } = await renderOpen();
    expect(messages(container)).toEqual(['Key failed', 'Low memory', 'File Transcribed', 'Odd time', 'No time']);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('renders empty state (light, en)', async () => {
    m.logs = [];
    expect((await renderOpen({ isDark: false, appLang: 'en' })).container.innerHTML).toMatchSnapshot();
  });
});

describe('ActivityLogsModal behavior', () => {
  it('filters by category, status and date range', async () => {
    const { container } = await renderOpen();
    await select(container, 0, 'API_KEY');
    expect(messages(container)).toEqual(['Key failed']);
    await select(container, 0, 'ALL');
    await select(container, 1, 'SUCCESS');
    expect(messages(container)).toEqual(['File Transcribed', 'No time']);
    await select(container, 1, 'ALL');
    await date(container, 0, '2026-10-21');
    expect(messages(container)).toEqual(['Key failed', 'Low memory']);
    await date(container, 1, '2026-10-21');
    expect(messages(container)).toEqual(['Low memory']);
    expect(container.textContent).toContain('1 Records');
  });

  it('paginates 50 at a time and resets on filter change', async () => {
    m.logs = Array.from({ length: 120 }, (_, i) => log(String(i), new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(), i % 2 ? 'SYSTEM' : 'REPORT', 'SUCCESS', `m${i}`));
    const { container, getByText } = await renderOpen();
    expect(messages(container)).toHaveLength(50);
    await act(async () => { fireEvent.click(getByText('Load More')); });
    expect(messages(container)).toHaveLength(100);
    await act(async () => { fireEvent.click(getByText('Load More')); });
    expect(messages(container)).toHaveLength(120);
    expect(container.textContent).not.toContain('Load More');
    await select(container, 0, 'SYSTEM');
    expect(messages(container)).toHaveLength(50);
  });

  it('minimizes, restores, maximizes and closes', async () => {
    const onClose = vi.fn();
    const { container } = await renderOpen({ onClose });
    const [minBtn, maxBtn, closeBtn] = Array.from(container.querySelectorAll('header button')) as HTMLElement[];
    fireEvent.click(minBtn);
    expect(container.innerHTML).toMatchSnapshot('minimized');
    fireEvent.click(container.querySelector('.cursor-pointer.hover\\:scale-105')!);
    fireEvent.click(maxBtn);
    const box = container.querySelector('#logs-modal-container') as HTMLElement;
    expect([box.style.width, box.style.height, box.style.borderRadius]).toEqual(['100vw', '100vh', '0px']);
    expect(container.querySelector('.cursor-nwse-resize')).toBeNull();
    fireEvent.click(maxBtn);
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('resizes with a minimum of 600x500', async () => {
    const { container } = await renderOpen();
    const box = container.querySelector('#logs-modal-container') as HTMLElement;
    vi.spyOn(box, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 50 } as DOMRect);
    fireEvent.mouseDown(container.querySelector('.cursor-nwse-resize')!);
    act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: 900, clientY: 850 })); });
    expect([box.style.width, box.style.height]).toEqual(['800px', '800px']);
    act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 100 })); });
    expect([box.style.width, box.style.height]).toEqual(['600px', '500px']);
    act(() => { window.dispatchEvent(new MouseEvent('mouseup')); });
    act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1500, clientY: 1500 })); });
    expect(box.style.width).toBe('600px');
  });

  it('reloads when activity logs change in the store', async () => {
    const { container } = await renderOpen();
    m.logs = [log('9', '2026-10-22T11:00:00Z', 'SYSTEM', 'SUCCESS', 'Fresh')];
    await act(async () => { useAppStore.getState().triggerStoreUpdate('activity_logs'); });
    expect(messages(container)).toEqual(['Fresh']);
  });
});
