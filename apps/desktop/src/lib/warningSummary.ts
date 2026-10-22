import type { Warning } from '@show-converter/engine';

export interface WarningSummary {
  info: number;
  warn: number;
  error: number;
  total: number;
}

export function summarizeWarnings(warnings: Warning[]): WarningSummary {
  const summary: WarningSummary = {
    info: 0,
    warn: 0,
    error: 0,
    total: warnings.length,
  };

  for (const warning of warnings) {
    if (warning.severity === 'info') {
      summary.info += 1;
    } else if (warning.severity === 'warn') {
      summary.warn += 1;
    } else if (warning.severity === 'error') {
      summary.error += 1;
    }
  }

  return summary;
}
