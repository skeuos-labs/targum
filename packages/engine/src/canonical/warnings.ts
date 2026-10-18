import { z } from 'zod';

export const WarningSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(['info', 'warn', 'error']),
  message: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export type Warning = z.infer<typeof WarningSchema>;

export function warning(
  code: string,
  severity: 'info' | 'warn' | 'error',
  message: string,
  context?: Record<string, unknown>,
): Warning {
  const result: Warning = { code, severity, message };
  if (context !== undefined) {
    result.context = context;
  }
  return result;
}

export function formatWarnings(warnings: Warning[]): string {
  if (warnings.length === 0) {
    return '';
  }
  return warnings
    .map((w) => {
      const level = w.severity.toUpperCase();
      const ctx =
        w.context && Object.keys(w.context).length > 0
          ? ` (${JSON.stringify(w.context)})`
          : '';
      return `[${level}] ${w.code}: ${w.message}${ctx}`;
    })
    .join('\n');
}
