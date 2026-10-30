import {
  exportPresentation,
  type BatchItemResult,
  type FormatId,
  type Presentation,
} from '@skeuos-labs/mizmor';
import type { PlatformAdapter } from '../platform/adapter';
import type { SourceFile } from '../state/sourceStore';
import type { ResolvedOutputPath } from './exportPath';

export interface ExportTargetItem {
  source: SourceFile;
  presentation: Presentation;
}

function baseResult(
  it: ExportTargetItem,
  outputPath: string
): Omit<BatchItemResult, 'status'> {
  return {
    sourcePath: it.source.path,
    sourceFormat: it.source.format,
    presentationTitle: it.presentation.title || 'untitled',
    outputPath,
    warnings: it.source.warnings,
  };
}

/** Apply a resolved path's skip/error decision without exporting. */
export function itemFromResolution(
  it: ExportTargetItem,
  resolved: ResolvedOutputPath
): BatchItemResult {
  const base = baseResult(it, resolved.path);
  if (resolved.action === 'skip') {
    return { ...base, status: 'skipped' };
  }
  if (resolved.action === 'error') {
    return { ...base, status: 'failed', error: resolved.error };
  }
  // 'write' without bytes — callers handle actual export
  return { ...base, status: 'success' };
}

/**
 * Export one presentation to a resolved writable path, write bytes, merge warnings.
 * Shared by individual, library, and combined item loops.
 */
export async function exportAndWriteItem(
  it: ExportTargetItem,
  resolved: ResolvedOutputPath,
  format: FormatId,
  adapter: PlatformAdapter
): Promise<BatchItemResult> {
  const base = baseResult(it, resolved.path);
  const expRes = await exportPresentation(it.presentation, format);
  if (!expRes.ok) {
    return { ...base, status: 'failed', error: expRes.error };
  }
  try {
    await adapter.writeFile(resolved.path, expRes.value.bytes);
    const expWarnings = expRes.value.warnings ?? expRes.warnings ?? [];
    return {
      ...base,
      status: 'success',
      warnings: [...it.source.warnings, ...expWarnings],
    };
  } catch (err) {
    return {
      ...base,
      status: 'failed',
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

