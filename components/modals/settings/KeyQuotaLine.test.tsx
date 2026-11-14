import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { KeyQuotaLine } from './KeyQuotaLine';
import { noteKeyRejection } from '../../../services/apiKeys/keyRejection';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('KeyQuotaLine', () => {
  it('says why Gemini refuses a key, and nothing for a key that works', () => {
    noteKeyRejection('AHeQ', Object.assign(new Error('API key not valid'), { status: 401 }));
    noteKeyRejection('0yPg', Object.assign(new Error('The Gemini API free tier is not available for this project'), { status: 403 }));
    expect(render(<KeyQuotaLine tail="AHeQ" appLang="bn" />).container.textContent).toContain('Gemini বলছে এই key বৈধ নয়');
    expect(render(<KeyQuotaLine tail="0yPg" appLang="en" />).container.textContent).toContain('no free tier');
    expect(render(<KeyQuotaLine tail="Dva0" appLang="en" />).container.textContent).toBe('0 request(s) today');
  });

  it('shows the last test of the key', () => {
    localStorage.setItem('key_check_results', JSON.stringify({ Dva0: { tail: 'Dva0', status: 'ok', model: 'gemini-3.5-flash', at: Date.UTC(2026, 10, 14, 6, 5) } }));
    expect(render(<KeyQuotaLine tail="Dva0" appLang="en" />).container.textContent).toMatch(/✓ works \(Gemini 3\.5 Flash, tested .+\)/);
  });
});
