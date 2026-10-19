import fs from 'node:fs';
import path from 'node:path';
import type { Warning } from '../canonical/warnings.js';

export { sanitizeFileName } from './sanitize.js';

/**
 * Checks if file `${dir}/${baseName}${ext}` exists.
 * If exists, tries `${baseName} (2)${ext}`, `${baseName} (3)${ext}`, etc., until an unused filename is found.
 * Returns the full resolved path.
 */
export function disambiguateFileName(dir: string, baseName: string, ext: string): string {
  const formattedExt = ext.startsWith('.') || ext === '' ? ext : `.${ext}`;
  let candidate = path.resolve(dir, `${baseName}${formattedExt}`);
  if (!fs.existsSync(candidate)) {
    return candidate;
  }
  let counter = 2;
  while (true) {
    candidate = path.resolve(dir, `${baseName} (${counter})${formattedExt}`);
    if (!fs.existsSync(candidate)) {
      return candidate;
    }
    counter++;
  }
}

/**
 * Returns formatted warning string, e.g. `[WARN] (VPC_TAG_UNMAPPED) Message here`.
 */
export function formatCliWarning(w: Warning): string {
  const level = (w.severity || 'warn').toUpperCase();
  return `[${level}] (${w.code}) ${w.message}`;
}
