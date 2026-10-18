import fs from 'node:fs';
import path from 'node:path';
import type { Warning } from '../canonical/types.js';
import { warning } from '../canonical/warnings.js';
import { detectFormat } from '../pipeline/detector.js';
import { FORMAT_REGISTRY } from '../pipeline/registry.js';

const SUPPORTED_EXTENSIONS = new Set(
  FORMAT_REGISTRY.flatMap((f) => f.extensions.map((ext) => ext.toLowerCase()))
);

/**
 * Reads up to `maxBytes` from head of file for format sniffing.
 */
async function readFileHead(filePath: string, maxBytes = 65536): Promise<Uint8Array> {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const stat = await handle.stat();
    const length = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(length);
    if (length > 0) {
      await handle.read(buffer, 0, length, 0);
    }
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } finally {
    await handle.close();
  }
}

/**
 * Checks whether a file path or its contents match a supported presentation format.
 */
async function isSupportedPresentationFile(filePath: string): Promise<boolean> {
  const ext = path.extname(filePath).toLowerCase();
  if (SUPPORTED_EXTENSIONS.has(ext)) {
    return true;
  }

  try {
    const headBytes = await readFileHead(filePath);
    return detectFormat(path.basename(filePath), headBytes) !== undefined;
  } catch {
    return false;
  }
}

/**
 * Recursively scans directory for supported presentation files,
 * tracking real paths of visited directories to avoid cyclic symlinks.
 */
async function scanDirectory(
  dirPath: string,
  recursive: boolean,
  visitedDirs: Set<string>,
  seenRealPaths: Set<string>,
  discoveredFiles: string[]
): Promise<void> {
  let realDir: string;
  try {
    realDir = await fs.promises.realpath(dirPath);
  } catch {
    return;
  }

  if (visitedDirs.has(realDir)) {
    return;
  }
  visitedDirs.add(realDir);

  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (recursive) {
        await scanDirectory(fullPath, recursive, visitedDirs, seenRealPaths, discoveredFiles);
      }
    } else if (entry.isSymbolicLink()) {
      try {
        const stat = await fs.promises.stat(fullPath);
        if (stat.isDirectory()) {
          if (recursive) {
            await scanDirectory(fullPath, recursive, visitedDirs, seenRealPaths, discoveredFiles);
          }
        } else if (stat.isFile()) {
          if (await isSupportedPresentationFile(fullPath)) {
            const realFile = await fs.promises.realpath(fullPath);
            if (!seenRealPaths.has(realFile)) {
              seenRealPaths.add(realFile);
              discoveredFiles.push(realFile);
            }
          }
        }
      } catch {
        // Skip inaccessible symlink targets
      }
    } else if (entry.isFile()) {
      if (await isSupportedPresentationFile(fullPath)) {
        try {
          const realFile = await fs.promises.realpath(fullPath);
          if (!seenRealPaths.has(realFile)) {
            seenRealPaths.add(realFile);
            discoveredFiles.push(realFile);
          }
        } catch {
          // Skip unresolvable files
        }
      }
    }
  }
}

/**
 * Scans provided file and directory paths, resolving supported presentation files,
 * recursing into directories when requested, avoiding cycles, deduplicating paths,
 * and sorting deterministically.
 */
export async function scanBatchInputs(
  inputs: string[],
  options?: { recursive?: boolean }
): Promise<{ files: string[]; warnings: Warning[] }> {
  const warnings: Warning[] = [];
  const discoveredFiles: string[] = [];
  const seenRealPaths = new Set<string>();
  const visitedDirs = new Set<string>();
  const recursive = options?.recursive ?? false;

  for (const input of inputs) {
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(input);
    } catch {
      warnings.push(
        warning('BATCH_INPUT_NOT_FOUND', 'warn', `Input path does not exist: ${input}`, {
          path: input,
        })
      );
      continue;
    }

    if (stat.isDirectory()) {
      await scanDirectory(input, recursive, visitedDirs, seenRealPaths, discoveredFiles);
    } else if (stat.isFile()) {
      const isSupported = await isSupportedPresentationFile(input);
      if (!isSupported) {
        warnings.push(
          warning('BATCH_UNSUPPORTED_FILE', 'warn', `Unsupported file format: ${input}`, {
            path: input,
          })
        );
        continue;
      }

      try {
        const realFile = await fs.promises.realpath(input);
        if (!seenRealPaths.has(realFile)) {
          seenRealPaths.add(realFile);
          discoveredFiles.push(realFile);
        }
      } catch {
        // Skip unresolvable file
      }
    } else {
      warnings.push(
        warning('BATCH_UNSUPPORTED_FILE', 'warn', `Unsupported file format: ${input}`, {
          path: input,
        })
      );
    }
  }

  discoveredFiles.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  return {
    files: discoveredFiles,
    warnings,
  };
}
