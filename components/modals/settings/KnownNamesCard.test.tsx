import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';

const m = vi.hoisted(() => ({ transcripts: [] as string[] }));
vi.mock('../../../services/historyRecords', () => ({
  forEachHistoryRecord: async (visit: (item: { transcript: string }) => void) => m.transcripts.forEach(transcript => visit({ transcript })),
}));

import { KnownNamesCard } from './KnownNamesCard';
import { namesForPrompt } from '../../../services/knownNames';

beforeEach(() => { localStorage.clear(); m.transcripts = []; });
afterEach(cleanup);

describe('KnownNamesCard', () => {
  it('adds names, learns from history, and removes a wrong one', async () => {
    m.transcripts = Array.from({ length: 3 }, () => '[00:00] **সুরভী তরণী:** কথা\n[00:10] **বোর্ডার জেনারেল:** কথা');
    const addToast = vi.fn();
    const { getByText, getByPlaceholderText, getAllByLabelText } = render(<KnownNamesCard isDark={false} appLang="en" addToast={addToast} />);
    expect(getByText(/No names yet/)).toBeTruthy();

    fireEvent.change(getByPlaceholderText(/A name as it should be spelled/), { target: { value: 'ড. সাজিদুল হক, নবনীতা' } });
    fireEvent.click(getByText('ADD'));
    expect(namesForPrompt()).toEqual(['ড. সাজিদুল হক', 'নবনীতা']);

    fireEvent.click(getByText('Learn from history'));
    await waitFor(() => expect(addToast).toHaveBeenCalledWith('4 name(s) in the list now', 'success'));
    expect(getByText('বোর্ডার জেনারেল')).toBeTruthy();

    fireEvent.click(getAllByLabelText('Delete')[3]);
    expect(namesForPrompt()).toEqual(['ড. সাজিদুল হক', 'নবনীতা', 'সুরভী তরণী']);
  });
});
