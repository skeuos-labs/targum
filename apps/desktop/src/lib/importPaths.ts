import { FORMAT_REGISTRY } from '@skeuos-labs/mizmor';

const SUPPORTED_IMPORT_EXTENSIONS = new Set(
  FORMAT_REGISTRY.filter((f) => f.canImport).flatMap((f) =>
    f.extensions.map((ext) => ext.toLowerCase())
  )
);

/** True when the path's final segment has a supported import extension. */
export function isSupportedImportPath(filePath: string): boolean {
  const filename = filePath.split(/[/\\]/).pop() || '';
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return false;
  const ext = filename.slice(dotIndex).toLowerCase();
  return SUPPORTED_IMPORT_EXTENSIONS.has(ext);
}

/**
 * Partition dropped/picked path inputs: supported file extensions become
 * file imports; anything else is attempted as a directory import.
 */
export function partitionImportPaths(paths: string[]): {
  filePaths: string[];
  dirPaths: string[];
} {
  const filePaths: string[] = [];
  const dirPaths: string[] = [];
  for (const path of paths) {
    if (isSupportedImportPath(path)) {
      filePaths.push(path);
    } else {
      dirPaths.push(path);
    }
  }
  return { filePaths, dirPaths };
}

