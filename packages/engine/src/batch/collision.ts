import fs from 'node:fs';
import path from 'node:path';
import { sanitizeFileName } from '../cli/utils.js';
import type { CollisionPolicy } from './types.js';

export interface ResolvedOutputPath {
  action: 'write' | 'skip' | 'error';
  path: string;
  error?: Error;
}

/**
 * Resolves output destination path for presentation file within batch,
 * applying collision policy ('rename' | 'skip' | 'overwrite' | 'error')
 * against disk files and previously-tracked paths within the batch.
 */
export function resolveOutputPath(
  outDir: string,
  baseName: string,
  ext: string,
  policy: CollisionPolicy = 'rename',
  trackedPaths: Set<string> = new Set()
): ResolvedOutputPath {
  const normalizedExt = ext.length === 0 || ext.startsWith('.') ? ext : `.${ext}`;
  const sanitized = sanitizeFileName(baseName);
  const targetPath = path.resolve(outDir, `${sanitized}${normalizedExt}`);

  const hasCollision = fs.existsSync(targetPath) || trackedPaths.has(targetPath);

  if (!hasCollision) {
    trackedPaths.add(targetPath);
    return { action: 'write', path: targetPath };
  }

  if (policy === 'overwrite') {
    trackedPaths.add(targetPath);
    return { action: 'write', path: targetPath };
  }

  if (policy === 'skip') {
    return { action: 'skip', path: targetPath };
  }

  if (policy === 'error') {
    return {
      action: 'error',
      path: targetPath,
      error: new Error(`File already exists: "${targetPath}"`),
    };
  }

  // policy === 'rename'
  let counter = 2;
  while (true) {
    const candidatePath = path.resolve(
      outDir,
      `${sanitized} (${counter})${normalizedExt}`
    );
    if (!fs.existsSync(candidatePath) && !trackedPaths.has(candidatePath)) {
      trackedPaths.add(candidatePath);
      return { action: 'write', path: candidatePath };
    }
    counter++;
  }
}
