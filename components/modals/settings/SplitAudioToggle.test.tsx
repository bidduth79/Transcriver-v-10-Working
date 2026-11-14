import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SplitAudioToggle } from './SplitAudioToggle';
import { isSplittingOn } from '../../../hooks/transcription/splitPolicy';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('SplitAudioToggle', () => {
  it('is on at first, and turns splitting off and on again', () => {
    const addToast = vi.fn();
    const { getByText, getByRole } = render(<SplitAudioToggle isDark={false} appLang="bn" addToast={addToast} />);
    expect(getByText('লম্বা অডিও টুকরো করে পাঠান')).toBeTruthy();
    const button = getByRole('button');
    expect(button.textContent).toMatch(/চালু আছে/);
    fireEvent.click(button);
    expect(isSplittingOn()).toBe(false);
    expect(button.textContent).toMatch(/বন্ধ/);
    expect(addToast).toHaveBeenLastCalledWith('সব অডিও পুরোটা একবারে পাঠানো হবে', 'info');
    fireEvent.click(button);
    expect(isSplittingOn()).toBe(true);
  });
});
