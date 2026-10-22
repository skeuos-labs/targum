import { describe, it, expect } from 'vitest';
import type { Warning } from '@show-converter/engine';
import { summarizeWarnings } from '../src/lib/warningSummary';

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
