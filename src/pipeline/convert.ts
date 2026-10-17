import type { Library, Presentation, Warning } from '../canonical/index.js';
import { detectFormat } from './detector.js';
import {
  getFormat,
  type FormatId,
  type Result,
} from './registry.js';

export async function importFile(
  bytes: Uint8Array,
  fileName: string
): Promise<Result<Library>> {
  const formatId = detectFormat(fileName, bytes);
  if (!formatId) {
    return {
      ok: false,
      error: new Error(
        `Unrecognized file format: ${fileName || 'unnamed buffer'}`
      ),
    };
  }

  const format = getFormat(formatId);
  if (!format || !format.canImport || !format.importBytes) {
    return {
      ok: false,
      error: new Error(`Format "${formatId}" does not support import.`),
    };
  }

  return format.importBytes(bytes, fileName);
}

export async function exportLibrary(
  library: Library,
  formatId: FormatId
): Promise<Result<{ bytes: Uint8Array; warnings: Warning[] }>> {
  const format = getFormat(formatId);
  if (!format || !format.canExport || !format.exportBytes) {
    return {
      ok: false,
      error: new Error(`Format "${formatId}" does not support export.`),
    };
  }

  return format.exportBytes(library);
}

export async function exportPresentation(
  presentation: Presentation,
  formatId: FormatId
): Promise<Result<{ bytes: Uint8Array; warnings: Warning[] }>> {
  return exportLibrary({ presentations: [presentation] }, formatId);
}

export async function convertFile(
  bytes: Uint8Array,
  sourceFileName: string,
  targetFormat: FormatId
): Promise<Result<{ bytes: Uint8Array; warnings: Warning[] }>> {
  const imported = await importFile(bytes, sourceFileName);
  if (!imported.ok) {
    return { ok: false, error: imported.error };
  }

  const exported = await exportLibrary(imported.value, targetFormat);
  if (!exported.ok) {
    return { ok: false, error: exported.error };
  }

  const importWarnings = imported.warnings ?? [];
  const exportWarnings = exported.value.warnings ?? exported.warnings ?? [];
  const mergedWarnings: Warning[] = [...importWarnings, ...exportWarnings];

  return {
    ok: true,
    value: {
      bytes: exported.value.bytes,
      warnings: mergedWarnings,
    },
    warnings: mergedWarnings,
  };
}
