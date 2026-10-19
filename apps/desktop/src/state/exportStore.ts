import { create } from 'zustand';
import {
  exportLibrary,
  generateProPlaylist,
  getFormat,
  type FormatId,
  type CollisionPolicy,
  type BatchSummary,
  type BatchItemResult,
  type PlaylistPresentationEntry,
  type Library,
} from '@show-converter/engine';
import { getPlatformAdapter, type PlatformAdapter } from '../platform';
import { useSourceStore } from './sourceStore';
import { resolveAdapterOutputPath } from '../lib/exportPath';
import {
  exportAndWriteItem,
  itemFromResolution,
  type ExportTargetItem,
} from '../lib/exportItem';

export interface ExportStoreState {
  targetFormat: FormatId;
  outputDirectory: string;
  collisionPolicy: CollisionPolicy;
  combineMode: boolean;
  combineName: string;
  libraryName: string;
  isExporting: boolean;
  progress: { current: number; total: number; message: string };
  lastSummary: BatchSummary | null;
  setTargetFormat(format: FormatId): void;
  setOutputDirectory(path: string): void;
  setCollisionPolicy(policy: CollisionPolicy): void;
  setCombineMode(combine: boolean, name?: string): void;
  setLibraryName(name: string): void;
  clearSummary(): void;
  executeExport(adapter?: PlatformAdapter): Promise<BatchSummary>;
}

const emptySummary = (): BatchSummary => ({
  totalFiles: 0,
  totalSongs: 0,
  successCount: 0,
  skippedCount: 0,
  failedCount: 0,
  warningCount: 0,
  items: [],
  durationMs: 0,
});

function collectSelectedItems(sources: ReturnType<typeof useSourceStore.getState>['sources'], selectedSongs: Set<string>): ExportTargetItem[] {
  const items: ExportTargetItem[] = [];
  for (const source of sources) {
    for (const pres of source.library.presentations) {
      if (selectedSongs.has(`${source.id}:${pres.id}`)) {
        items.push({ source, presentation: pres });
      }
    }
  }
  return items;
}

function summarize(
  items: BatchItemResult[],
  targetItems: ExportTargetItem[],
  startTime: number,
  combinedOutputPath?: string
): BatchSummary {
  return {
    totalFiles: new Set(targetItems.map((it) => it.source.id)).size,
    totalSongs: targetItems.length,
    successCount: items.filter((it) => it.status === 'success').length,
    skippedCount: items.filter((it) => it.status === 'skipped').length,
    failedCount: items.filter((it) => it.status === 'failed').length,
    warningCount: items.reduce((acc, it) => acc + (it.warnings?.length ?? 0), 0),
    items,
    ...(combinedOutputPath ? { combinedOutputPath } : {}),
    durationMs: Date.now() - startTime,
  };
}

/** Resolve path, then skip/error or export+write one target. */
async function runResolvedItem(
  it: ExportTargetItem,
  resolvedDir: string,
  baseName: string,
  ext: string,
  format: FormatId,
  adapter: PlatformAdapter,
  collisionPolicy: CollisionPolicy,
  trackedPaths: Set<string>
): Promise<BatchItemResult> {
  const resolved = await resolveAdapterOutputPath(
    adapter,
    resolvedDir,
    baseName,
    ext,
    collisionPolicy,
    trackedPaths
  );
  if (resolved.action === 'write') {
    return exportAndWriteItem(it, resolved, format, adapter);
  }
  return itemFromResolution(it, resolved);
}

async function runCombinedExport(
  targetItems: ExportTargetItem[],
  outputDirectory: string,
  combineName: string,
  targetFormat: FormatId,
  targetExt: string,
  collisionPolicy: CollisionPolicy,
  adapter: PlatformAdapter,
  trackedPaths: Set<string>
): Promise<{ items: BatchItemResult[]; combinedOutputPath?: string }> {
  const baseName = combineName.trim() || 'Combined_Presentations';
  const resolved = await resolveAdapterOutputPath(
    adapter,
    outputDirectory,
    baseName,
    targetExt,
    collisionPolicy,
    trackedPaths
  );

  const failAll = (error?: Error): BatchItemResult[] =>
    targetItems.map((it) => ({
      sourcePath: it.source.path,
      sourceFormat: it.source.format,
      presentationTitle: it.presentation.title || 'untitled',
      outputPath: resolved.path,
      status: resolved.action === 'skip' ? ('skipped' as const) : ('failed' as const),
      warnings: it.source.warnings,
      ...(resolved.action === 'skip' ? {} : { error: error ?? resolved.error }),
    }));

  if (resolved.action !== 'write') {
    if (resolved.action === 'skip') {
      return { items: failAll(), combinedOutputPath: resolved.path };
    }
    return { items: failAll(resolved.error) };
  }

  const combinedLibrary: Library = {
    presentations: targetItems.map((it) => it.presentation),
  };
  const expRes = await exportLibrary(combinedLibrary, targetFormat);
  if (!expRes.ok) {
    return { items: failAll(expRes.error) };
  }

  try {
    await adapter.writeFile(resolved.path, expRes.value.bytes);
    const expWarnings = expRes.value.warnings ?? expRes.warnings ?? [];
    const items = targetItems.map((it, i) => ({
      sourcePath: it.source.path,
      sourceFormat: it.source.format,
      presentationTitle: it.presentation.title || 'untitled',
      outputPath: resolved.path,
      status: 'success' as const,
      warnings:
        i === 0 ? [...it.source.warnings, ...expWarnings] : it.source.warnings,
    }));
    return { items, combinedOutputPath: resolved.path };
  } catch (err) {
    return {
      items: failAll(err instanceof Error ? err : new Error(String(err))),
    };
  }
}

async function runLibraryExport(
  targetItems: ExportTargetItem[],
  outputDirectory: string,
  libraryName: string,
  collisionPolicy: CollisionPolicy,
  adapter: PlatformAdapter,
  trackedPaths: Set<string>,
  onProgress: (current: number, total: number, message: string) => void
): Promise<BatchItemResult[]> {
  const separator = outputDirectory.includes('\\') ? '\\' : '/';
  const cleanOut = outputDirectory.replace(/[/\\]+$/, '');
  const trimmedLib = libraryName.trim();
  const libDir = `${cleanOut}${separator}${trimmedLib}`;
  await adapter.createDir(libDir);

  const playlistEntries: PlaylistPresentationEntry[] = [];
  const items: BatchItemResult[] = [];

  for (let i = 0; i < targetItems.length; i++) {
    const it = targetItems[i]!;
    const title = it.presentation.title || 'untitled';
    onProgress(i + 1, targetItems.length, `Exporting ${title} (${i + 1}/${targetItems.length})...`);

    const item = await runResolvedItem(it, libDir, title, '.pro', 'pro', adapter, collisionPolicy, trackedPaths);
    items.push(item);
    if (item.status === 'success' && item.outputPath) {
      const fileName = item.outputPath.split(/[/\\]/).pop() || '';
      playlistEntries.push({ title, uuid: it.presentation.id, relativePath: `./${fileName}` });
    }
  }

  if (playlistEntries.length > 0) {
    try {
      const playlistBytes = generateProPlaylist(trimmedLib, playlistEntries);
      await adapter.writeFile(`${libDir}${separator}${trimmedLib}.proplaylist`, playlistBytes);
    } catch {
      // Playlist write error
    }
  }
  return items;
}

async function runIndividualExport(
  targetItems: ExportTargetItem[],
  outputDirectory: string,
  targetFormat: FormatId,
  targetExt: string,
  collisionPolicy: CollisionPolicy,
  adapter: PlatformAdapter,
  trackedPaths: Set<string>,
  onProgress: (current: number, total: number, message: string) => void
): Promise<BatchItemResult[]> {
  const items: BatchItemResult[] = [];
  for (let i = 0; i < targetItems.length; i++) {
    const it = targetItems[i]!;
    const title = it.presentation.title || 'untitled';
    onProgress(i + 1, targetItems.length, `Exporting ${title} (${i + 1}/${targetItems.length})...`);
    items.push(
      await runResolvedItem(it, outputDirectory, title, targetExt, targetFormat, adapter, collisionPolicy, trackedPaths)
    );
  }
  return items;
}

export const useExportStore = create<ExportStoreState>((set, get) => ({
  targetFormat: 'pro',
  outputDirectory: '',
  collisionPolicy: 'rename',
  combineMode: false,
  combineName: '',
  libraryName: '',
  isExporting: false,
  progress: { current: 0, total: 0, message: '' },
  lastSummary: null,

  setTargetFormat: (format: FormatId): void => {
    const supportsCombine = format === 'pptx' || format === 'vpc' || format === 'freeshow';
    const supportsLibrary = format === 'pro';
    set({
      targetFormat: format,
      ...(supportsCombine ? {} : { combineMode: false }),
      ...(supportsLibrary ? {} : { libraryName: '' }),
    });
  },

  setOutputDirectory: (path: string): void => {
    set({ outputDirectory: path });
  },

  setCollisionPolicy: (policy: CollisionPolicy): void => {
    set({ collisionPolicy: policy });
  },

  setCombineMode: (combine: boolean, name?: string): void => {
    set({
      combineMode: combine,
      ...(name !== undefined ? { combineName: name } : {}),
    });
  },

  setLibraryName: (name: string): void => {
    set({ libraryName: name });
  },

  clearSummary: (): void => {
    set({ lastSummary: null });
  },

  executeExport: async (adapter?: PlatformAdapter): Promise<BatchSummary> => {
    const startTime = Date.now();
    const activeAdapter = adapter ?? getPlatformAdapter();
    const {
      targetFormat,
      outputDirectory,
      collisionPolicy,
      combineMode,
      combineName,
      libraryName,
    } = get();
    const { sources, selectedSongs } = useSourceStore.getState();

    const targetItems = collectSelectedItems(sources, selectedSongs);

    if (targetItems.length === 0) {
      const summary = emptySummary();
      set({ lastSummary: summary, isExporting: false });
      return summary;
    }

    if (!outputDirectory.trim()) {
      throw new Error('Output directory is required');
    }

    set({
      isExporting: true,
      progress: { current: 0, total: targetItems.length, message: 'Starting export...' },
    });

    try {
      await activeAdapter.createDir(outputDirectory);

      const targetDef = getFormat(targetFormat);
      const targetExt = targetDef?.extensions[0] ?? '.pro';
      const trackedPaths = new Set<string>();
      const onProgress = (current: number, total: number, message: string) =>
        set({ progress: { current, total, message } });

      let items: BatchItemResult[];
      let combinedOutputPath: string | undefined;

      if (combineMode) {
        const combined = await runCombinedExport(
          targetItems,
          outputDirectory,
          combineName,
          targetFormat,
          targetExt,
          collisionPolicy,
          activeAdapter,
          trackedPaths
        );
        items = combined.items;
        combinedOutputPath = combined.combinedOutputPath;
      } else if (libraryName.trim().length > 0) {
        items = await runLibraryExport(
          targetItems,
          outputDirectory,
          libraryName,
          collisionPolicy,
          activeAdapter,
          trackedPaths,
          onProgress
        );
      } else {
        items = await runIndividualExport(
          targetItems,
          outputDirectory,
          targetFormat,
          targetExt,
          collisionPolicy,
          activeAdapter,
          trackedPaths,
          onProgress
        );
      }

      const summary = summarize(items, targetItems, startTime, combinedOutputPath);
      set({
        progress: {
          current: targetItems.length,
          total: targetItems.length,
          message: 'Export complete',
        },
        lastSummary: summary,
      });
      return summary;
    } finally {
      set({ isExporting: false });
    }
  },
}));
