import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { BatchProcessingQueue } from './BatchProcessingQueue';

const f = (name: string, mb = 1) => ({ name, size: mb * 1024 * 1024 });
const queue = [f('done.mp3'), f('bad.mp3'), f('now.mp3'), f('dup.mp3', 2), f('dup-nosize.mp3'), f('todo.mp3'), f('sizediff.mp3', 3)];
const history = [{ fileName: 'dup.mp3', size: '2.00 MB' }, { fileName: 'dup-nosize.mp3' }, { fileName: 'sizediff.mp3', size: '9.00 MB' }, { fileName: 'done.mp3' }];
const fns = () => ({
  retryFailedFiles: vi.fn(), startBatch: vi.fn(), pauseBatch: vi.fn(), resumeBatch: vi.fn(), cancelBatch: vi.fn(),
  skipNextBatchFile: vi.fn(), removeBatchFile: vi.fn(), jumpToBatchFile: vi.fn(),
});
const setup = (over: any = {}) => {
  const props = {
    appLang: 'bn', isDark: true, cardBg: 'card', cardBorder: 'border', activeColors: { primary: 'bg-p' }, history, batchQueue: queue,
    currentBatchIndex: 2, isBatchProcessing: true, hasBatchStarted: true, isBatchPaused: false, batchCountdown: 0,
    failedFiles: [{ file: queue[1], reason: 'x' }], progress: 42.6, etaSeconds: 45, ...fns(), ...over,
  };
  return { ...render(<BatchProcessingQueue {...props} />), props };
};
const row = (c: HTMLElement, i: number) => c.querySelectorAll('.space-y-2 > div')[i] as HTMLElement;
// Title lookup that ignores Unicode composition differences in Bengali (e.g. "য়")
const byTitle = (el: Element, title: string) =>
  (Array.from(el.querySelectorAll('button[title]')).find(b => b.getAttribute('title')!.normalize('NFC') === title.normalize('NFC')) as HTMLElement) || null;

describe('BatchProcessingQueue markup', () => {
  it('renders nothing without an active batch or failures', () => {
    expect(setup({ isBatchProcessing: false, failedFiles: [] }).container.innerHTML).toBe('');
    expect(setup({ batchQueue: [] }).container.innerHTML).toBe('');
  });
  it.each([
    ['running bn, eta seconds', {}],
    ['running en light, eta minutes, countdown', { appLang: 'en', isDark: false, etaSeconds: 125, batchCountdown: 7 }],
    ['paused, eta unknown', { isBatchPaused: true, etaSeconds: null }],
    ['not started', { hasBatchStarted: false, currentBatchIndex: 0, failedFiles: [] }],
    ['finished with failures', { isBatchProcessing: false, hasBatchStarted: false, activeColors: undefined }],
  ])('%s', (_n, over) => {
    expect(setup(over).container.innerHTML).toMatchSnapshot();
  });
});

describe('BatchProcessingQueue behavior', () => {
  it('marks item states and duplicate detection by name/size', () => {
    const { container } = setup();
    const label = (i: number) => row(container, i).querySelectorAll('span.text-\\[10px\\]');
    expect(Array.from(label(0)).map(s => s.textContent)).toEqual(['সফল']);
    // A failed file is not also marked as a success
    expect(Array.from(label(1)).map(s => s.textContent)).toEqual(['ব্যর্থ']);
    expect(Array.from(label(3)).map(s => s.textContent)).toEqual(['ডুপ্লিকেট']);
    expect(Array.from(label(4)).map(s => s.textContent)).toEqual(['ডুপ্লিকেট']);
    expect(label(5)).toHaveLength(0);
    expect(label(6)).toHaveLength(0);
  });

  it('marks the same recording saved under another date as a duplicate', () => {
    const { container } = setup({
      batchQueue: [f('Talk_2026-10-28.opus', 2), f('Other_2026-10-28.opus', 2)], currentBatchIndex: 0, hasBatchStarted: false, failedFiles: [],
      history: [{ fileName: 'Talk_2026-10-27.opus', size: '2.00 MB' }],
    });
    const label = (i: number) => row(container, i).querySelectorAll('span.text-\\[10px\\]');
    expect(label(0)).toHaveLength(1);
    expect(label(1)).toHaveLength(0);
  });

  it('wires per-item buttons', () => {
    const { container, props } = setup();
    const btn = (i: number, title: string) => byTitle(row(container, i), title);
    fireEvent.click(btn(5, 'বাদ দিন')!);
    expect(props.removeBatchFile).toHaveBeenCalledWith(5);
    fireEvent.click(btn(5, 'শুরু করুন')!);
    expect(props.jumpToBatchFile).toHaveBeenCalledWith(5);
    fireEvent.click(btn(0, 'পুনরায় চেষ্টা')!);
    expect(props.jumpToBatchFile).toHaveBeenLastCalledWith(0);
    expect(btn(5, 'পুনরায় চেষ্টা')).toBeNull();
    expect(btn(3, 'পুনরায় চেষ্টা')).not.toBeNull();
    fireEvent.click(btn(2, 'পজ')!);
    expect(props.pauseBatch).toHaveBeenCalled();
    fireEvent.click(btn(2, 'থামান')!);
    expect(props.cancelBatch).toHaveBeenCalled();
    expect(btn(2, 'শুরু করুন')).toBeNull();
  });

  it('wires footer controls in each phase', () => {
    let s = setup();
    fireEvent.click(s.getByText('পজ', { selector: '.flex-wrap button' }));
    fireEvent.click(s.getByText('স্কিপ'));
    fireEvent.click(s.getByText('বাতিল'));
    expect([s.props.pauseBatch, s.props.skipNextBatchFile, s.props.cancelBatch].map(f => f.mock.calls.length)).toEqual([1, 1, 1]);
    s.unmount();
    s = setup({ isBatchPaused: true });
    fireEvent.click(s.getByText('চালু'));
    fireEvent.click(byTitle(row(s.container, 2), 'পুনরায় চালু')!);
    expect(s.props.resumeBatch).toHaveBeenCalledTimes(2);
    s.unmount();
    s = setup({ hasBatchStarted: false, failedFiles: [] });
    fireEvent.click(s.getByText('শুরু করুন', { selector: '.flex-wrap button' }));
    expect(s.props.startBatch).toHaveBeenCalled();
    s.unmount();
    s = setup({ hasBatchStarted: false, isBatchProcessing: false });
    fireEvent.click(Array.from(s.container.querySelectorAll('button')).find(b => b.textContent!.normalize('NFC') === 'ব্যর্থ ফাইল পুনরায় চেষ্টা'.normalize('NFC'))!);
    expect(s.props.retryFailedFiles).toHaveBeenCalled();
  });
});
