import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

const m = vi.hoisted(() => ({ theme: { isDark: true, appLang: 'bn' }, props: {} as Record<string, any> }));
const { stub } = vi.hoisted(() => ({
  stub: (name: string) => (p: any) => {
    m.props[name] = p;
    const React = require('react');
    return React.createElement('div', { 'data-tab': name }, Object.keys(p).sort().join(','));
  },
}));
vi.mock('../../hooks/useAppTheme', () => ({ useAppTheme: () => m.theme }));
vi.mock('./SpeakerProfileTab', () => ({ SpeakerProfileTab: stub('profile') }));
vi.mock('./SpeakerArchiveTab', () => ({ SpeakerArchiveTab: stub('archive') }));
vi.mock('./SpeakerNotesTab', () => ({ SpeakerNotesTab: stub('notes') }));
vi.mock('./SpeakerResearchTab', () => ({ SpeakerResearchTab: stub('research') }));

import { SpeakerProfileSidebar } from './SpeakerProfileSidebar';

const profile: any = {
  name: 'রহিম উদ্দিন', description: 'বর্ণনা', bgbViews: 'মতামত',
  customNote: { roleOrDesignation: 'চেয়ারম্যান', notes: 'n', tags: ['x'] },
  databaseStats: { bgbMentionCount: 3, mentions: [{ id: 1 }] },
};
const setup = (over: any = {}) => {
  const props = { isOpen: true, onClose: vi.fn(), speakerName: 'Speaker 1', profile, isLoading: false, error: '', onRefresh: vi.fn(), onUpdateCustomNote: vi.fn(), onSeek: vi.fn(), ...over };
  return { ...render(<SpeakerProfileSidebar {...props} />), props };
};
const tabButtons = (c: HTMLElement) => Array.from(c.querySelectorAll('.pt-2.border-b button')) as HTMLElement[];

beforeEach(() => { vi.clearAllMocks(); m.theme = { isDark: true, appLang: 'bn' }; m.props = {}; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('SpeakerProfileSidebar markup', () => {
  it.each([
    ['profile tab (dark)', {}],
    ['closed', { isOpen: false }],
    ['loading (light, en)', { isLoading: true, profile: null, theme: { isDark: false, appLang: 'en' } }],
    ['loading (bn)', { isLoading: true, profile: null }],
    ['error without refresh', { error: 'কিছু ভুল হয়েছে', profile: null, onRefresh: undefined }],
    ['profile without stats/notes', { profile: { name: 'X', description: '', bgbViews: '' } }],
  ])('%s', (_n, over: any) => {
    if (over.theme) m.theme = over.theme;
    expect(setup(over).container.innerHTML).toMatchSnapshot();
  });

  it('renders every tab with its props', () => {
    const { container } = setup();
    for (const [i, name] of ['archive', 'notes', 'research'].entries()) {
      fireEvent.click(tabButtons(container)[i + 1]);
      expect(container.querySelector('[data-tab]')?.getAttribute('data-tab')).toBe(name);
    }
    expect(container.innerHTML).toMatchSnapshot('research tab');
    expect(m.props.archive).toMatchObject({ mentions: [{ id: 1 }], onSeek: expect.any(Function), isDark: true });
    expect(m.props.notes.profile).toBe(profile);
  });
});

describe('SpeakerProfileSidebar behavior', () => {
  it('copies a profile summary and briefly shows a check icon', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { container } = setup();
    const btn = container.querySelector('#copy-profile-btn') as HTMLElement;
    const before = btn.innerHTML;
    fireEvent.click(btn);
    const expected = 'রহিম উদ্দিন\n\nপরিচয়:\nবর্ণনা\n\nবিজিবি ও সীমান্ত সংক্রান্ত সার্বিক দৃষ্টিভঙ্গি:\nমতামত\n\nডাটাবেজে উল্লেখ: 3 বার';
    expect(writeText.mock.calls[0][0].normalize('NFC')).toBe(expected.normalize('NFC'));
    expect(btn.innerHTML).toContain('text-green-500');
    act(() => { vi.advanceTimersByTime(1999); });
    expect(btn.innerHTML).toContain('text-green-500');
    act(() => { vi.advanceTimersByTime(1); });
    expect(btn.innerHTML).toBe(before);
  });

  it('refreshes, closes from backdrop and button', () => {
    const { container, props } = setup();
    const buttons = container.querySelectorAll('.flex.gap-1\\.5.items-center button');
    fireEvent.click(buttons[1]);
    expect(props.onRefresh).toHaveBeenCalled();
    fireEvent.click(buttons[2]);
    fireEvent.mouseDown(container.querySelector('.fixed.inset-0')!);
    fireEvent.click(container.querySelector('.fixed.inset-0')!);
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });
});
