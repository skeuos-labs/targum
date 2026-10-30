import type { Warning } from '@skeuos-labs/mizmor';

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

/** Highest severity present — drives the chip's color tone. */
export function warningChipTone(summary: WarningSummary): 'error' | 'warn' | 'info' {
  if (summary.error > 0) return 'error';
  if (summary.warn > 0) return 'warn';
  return 'info';
}

/** Severity-aware chip label, e.g. "2 warn · 1 error" or "OK". */
export function formatWarningChipLabel(warnings: Warning[]): string {
  const s = summarizeWarnings(warnings);
  if (s.total === 0) return 'OK';
  const parts: string[] = [];
  if (s.info > 0) parts.push(`${s.info} info`);
  if (s.warn > 0) parts.push(`${s.warn} warn`);
  if (s.error > 0) parts.push(`${s.error} error`);
  return parts.join(' · ');
}

