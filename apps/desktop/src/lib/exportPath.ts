import { sanitizeFileName, type CollisionPolicy } from '@show-converter/engine';
import type { PlatformAdapter } from '../platform/adapter';

export interface ResolvedOutputPath {
  action: 'write' | 'skip' | 'error';
  path: string;
  error?: Error;
}

export async function resolveAdapterOutputPath(
  adapter: PlatformAdapter,
  outDir: string,
  baseName: string,
  ext: string,
  policy: CollisionPolicy,
  trackedPaths: Set<string>
): Promise<ResolvedOutputPath> {
  const normalizedExt = ext.length === 0 || ext.startsWith('.') ? ext : `.${ext}`;
  const sanitized = sanitizeFileName(baseName) || 'presentation';
  const separator = outDir.includes('\\') ? '\\' : '/';
  const cleanDir = outDir.replace(/[/\\]+$/, '');
  const targetPath = `${cleanDir}${separator}${sanitized}${normalizedExt}`;

  const hasCollision = (await adapter.exists(targetPath)) || trackedPaths.has(targetPath);

  if (!hasCollision || policy === 'overwrite') {
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
    const candidatePath = `${cleanDir}${separator}${sanitized} (${counter})${normalizedExt}`;
    const candidateCollision =
      (await adapter.exists(candidatePath)) || trackedPaths.has(candidatePath);
    if (!candidateCollision) {
      trackedPaths.add(candidatePath);
      return { action: 'write', path: candidatePath };
    }
    counter++;
  }
}
