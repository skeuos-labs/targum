import { describe, it, expect } from 'vitest';
import type { Warning } from '@show-converter/engine';
import {
  formatWarningChipLabel,
  summarizeWarnings,
  warningChipTone,
} from '../src/lib/warningSummary';

function warn(severity: Warning['severity']): Warning {
  return { code: 'TEST', severity, message: 'msg' };
}

describe('summarizeWarnings', () => {
  it('counts mixed severities and totals', () => {
    expect(
      summarizeWarnings([warn('info'), warn('warn'), warn('warn'), warn('error')])
    ).toEqual({ info: 1, warn: 2, error: 1, total: 4 });
  });

  it('returns zeros for empty input', () => {
    expect(summarizeWarnings([])).toEqual({ info: 0, warn: 0, error: 0, total: 0 });
  });
});

describe('formatWarningChipLabel', () => {
  it('returns OK for empty warnings', () => {
    expect(formatWarningChipLabel([])).toBe('OK');
  });

  it('joins severity parts with middle dots', () => {
    expect(
      formatWarningChipLabel([warn('warn'), warn('warn'), warn('error')])
    ).toBe('2 warn · 1 error');
    expect(formatWarningChipLabel([warn('info')])).toBe('1 info');
  });
});

describe('warningChipTone', () => {
  it('picks the highest severity present', () => {
    expect(warningChipTone(summarizeWarnings([warn('info'), warn('warn'), warn('error')]))).toBe(
      'error'
    );
    expect(warningChipTone(summarizeWarnings([warn('info'), warn('warn')]))).toBe('warn');
    expect(warningChipTone(summarizeWarnings([warn('info')]))).toBe('info');
    // No warnings: chip is not rendered, tone degrades to info
    expect(warningChipTone(summarizeWarnings([]))).toBe('info');
  });
});
