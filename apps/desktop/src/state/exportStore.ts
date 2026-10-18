import { create } from 'zustand';
import {
  exportPresentation,
  exportLibrary,
  generateProPlaylist,
  getFormat,
  sanitizeFileName,
  type FormatId,
  type CollisionPolicy,
  type BatchSummary,
  type BatchItemResult,
  type PlaylistPresentationEntry,
  type Library,
  type Presentation,
} from '@show-converter/engine';
import { getPlatformAdapter, type PlatformAdapter } from '../platform';
import { useSourceStore, type SourceFile } from './sourceStore';

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
  executeExport(adapter?: PlatformAdapter): Promise<BatchSummary>;
}

interface TargetItem {
  source: SourceFile;
  presentation: Presentation;
}

async function resolveAdapterOutputPath(
  adapter: PlatformAdapter,
  outDir: string,
  baseName: string,
  ext: string,
  policy: CollisionPolicy,
  trackedPaths: Set<string>
): Promise<{ action: 'write' | 'skip' | 'error'; path: string; error?: Error }> {
  const normalizedExt = ext.length === 0 || ext.startsWith('.') ? ext : `.${ext}`;
  const sanitized = sanitizeFileName(baseName) || 'presentation';
  const separator = outDir.includes('\\') ? '\\' : '/';
  const cleanDir = outDir.replace(/[/\\]+$/, '');
  const targetPath = `${cleanDir}${separator}${sanitized}${normalizedExt}`;

  const hasCollision = (await adapter.exists(targetPath)) || trackedPaths.has(targetPath);

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
    set({ targetFormat: format });
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

    const targetItems: TargetItem[] = [];
    for (const source of sources) {
      for (const pres of source.library.presentations) {
        if (selectedSongs.has(`${source.id}:${pres.id}`)) {
          targetItems.push({ source, presentation: pres });
        }
      }
    }

    if (targetItems.length === 0) {
      const emptySummary: BatchSummary = {
        totalFiles: 0,
        totalSongs: 0,
        successCount: 0,
        skippedCount: 0,
        failedCount: 0,
        warningCount: 0,
        items: [],
        durationMs: 0,
      };
      set({ lastSummary: emptySummary, isExporting: false });
      return emptySummary;
    }

    if (!outputDirectory.trim()) {
      throw new Error('Output directory is required');
    }

    set({
      isExporting: true,
      progress: {
        current: 0,
        total: targetItems.length,
        message: 'Starting export...',
      },
    });

    try {
      await activeAdapter.createDir(outputDirectory);

    const targetDef = getFormat(targetFormat);
    const targetExt = targetDef?.extensions[0] ?? '.pro';
    const trackedPaths = new Set<string>();
    const items: BatchItemResult[] = [];
    let combinedOutputPath: string | undefined;

    if (combineMode) {
      // Combined mode
      const baseName = combineName.trim() || 'Combined_Presentations';
      const resolved = await resolveAdapterOutputPath(
        activeAdapter,
        outputDirectory,
        baseName,
        targetExt,
        collisionPolicy,
        trackedPaths
      );

      if (resolved.action === 'skip') {
        combinedOutputPath = resolved.path;
        for (const it of targetItems) {
          items.push({
            sourcePath: it.source.path,
            sourceFormat: it.source.format,
            presentationTitle: it.presentation.title || 'untitled',
            outputPath: resolved.path,
            status: 'skipped',
            warnings: it.source.warnings,
          });
        }
      } else if (resolved.action === 'error') {
        for (const it of targetItems) {
          items.push({
            sourcePath: it.source.path,
            sourceFormat: it.source.format,
            presentationTitle: it.presentation.title || 'untitled',
            outputPath: resolved.path,
            status: 'failed',
            warnings: it.source.warnings,
            error: resolved.error,
          });
        }
      } else {
        const combinedLibrary: Library = {
          presentations: targetItems.map((it) => it.presentation),
        };
        const expRes = await exportLibrary(combinedLibrary, targetFormat);
        if (!expRes.ok) {
          for (const it of targetItems) {
            items.push({
              sourcePath: it.source.path,
              sourceFormat: it.source.format,
              presentationTitle: it.presentation.title || 'untitled',
              status: 'failed',
              warnings: it.source.warnings,
              error: expRes.error,
            });
          }
        } else {
          try {
            await activeAdapter.writeFile(resolved.path, expRes.value.bytes);
            combinedOutputPath = resolved.path;
            const expWarnings = expRes.value.warnings ?? expRes.warnings ?? [];
            for (let i = 0; i < targetItems.length; i++) {
              const it = targetItems[i]!;
              items.push({
                sourcePath: it.source.path,
                sourceFormat: it.source.format,
                presentationTitle: it.presentation.title || 'untitled',
                outputPath: resolved.path,
                status: 'success',
                warnings: i === 0 ? [...it.source.warnings, ...expWarnings] : it.source.warnings,
              });
            }
          } catch (err) {
            for (const it of targetItems) {
              items.push({
                sourcePath: it.source.path,
                sourceFormat: it.source.format,
                presentationTitle: it.presentation.title || 'untitled',
                outputPath: resolved.path,
                status: 'failed',
                warnings: it.source.warnings,
                error: err instanceof Error ? err : new Error(String(err)),
              });
            }
          }
        }
      }
    } else if (libraryName.trim().length > 0) {
      // Library mode: export .pro files to <outputDirectory>/<libraryName> + <libraryName>.proplaylist
      const separator = outputDirectory.includes('\\') ? '\\' : '/';
      const cleanOut = outputDirectory.replace(/[/\\]+$/, '');
      const trimmedLib = libraryName.trim();
      const libDir = `${cleanOut}${separator}${trimmedLib}`;
      await activeAdapter.createDir(libDir);

      const playlistEntries: PlaylistPresentationEntry[] = [];

      for (let i = 0; i < targetItems.length; i++) {
        const it = targetItems[i]!;
        const presTitle = it.presentation.title || 'untitled';

        set({
          progress: {
            current: i + 1,
            total: targetItems.length,
            message: `Exporting ${presTitle} (${i + 1}/${targetItems.length})...`,
          },
        });

        const resolved = await resolveAdapterOutputPath(
          activeAdapter,
          libDir,
          presTitle,
          '.pro',
          collisionPolicy,
          trackedPaths
        );

        if (resolved.action === 'skip') {
          items.push({
            sourcePath: it.source.path,
            sourceFormat: it.source.format,
            presentationTitle: presTitle,
            outputPath: resolved.path,
            status: 'skipped',
            warnings: it.source.warnings,
          });
        } else if (resolved.action === 'error') {
          items.push({
            sourcePath: it.source.path,
            sourceFormat: it.source.format,
            presentationTitle: presTitle,
            outputPath: resolved.path,
            status: 'failed',
            warnings: it.source.warnings,
            error: resolved.error,
          });
        } else {
          const expRes = await exportPresentation(it.presentation, 'pro');
          if (!expRes.ok) {
            items.push({
              sourcePath: it.source.path,
              sourceFormat: it.source.format,
              presentationTitle: presTitle,
              outputPath: resolved.path,
              status: 'failed',
              warnings: it.source.warnings,
              error: expRes.error,
            });
          } else {
            try {
              await activeAdapter.writeFile(resolved.path, expRes.value.bytes);
              const fileName = resolved.path.split(/[/\\]/).pop() || '';
              playlistEntries.push({
                title: presTitle,
                uuid: it.presentation.id,
                relativePath: `./${fileName}`,
              });
              const expWarnings = expRes.value.warnings ?? expRes.warnings ?? [];
              items.push({
                sourcePath: it.source.path,
                sourceFormat: it.source.format,
                presentationTitle: presTitle,
                outputPath: resolved.path,
                status: 'success',
                warnings: [...it.source.warnings, ...expWarnings],
              });
            } catch (err) {
              items.push({
                sourcePath: it.source.path,
                sourceFormat: it.source.format,
                presentationTitle: presTitle,
                outputPath: resolved.path,
                status: 'failed',
                warnings: it.source.warnings,
                error: err instanceof Error ? err : new Error(String(err)),
              });
            }
          }
        }
      }

      if (playlistEntries.length > 0) {
        try {
          const playlistBytes = generateProPlaylist(trimmedLib, playlistEntries);
          const playlistPath = `${libDir}${separator}${trimmedLib}.proplaylist`;
          await activeAdapter.writeFile(playlistPath, playlistBytes);
        } catch {
          // Playlist write error
        }
      }
    } else {
      // Individual mode
      for (let i = 0; i < targetItems.length; i++) {
        const it = targetItems[i]!;
        const presTitle = it.presentation.title || 'untitled';

        set({
          progress: {
            current: i + 1,
            total: targetItems.length,
            message: `Exporting ${presTitle} (${i + 1}/${targetItems.length})...`,
          },
        });

        const resolved = await resolveAdapterOutputPath(
          activeAdapter,
          outputDirectory,
          presTitle,
          targetExt,
          collisionPolicy,
          trackedPaths
        );

        if (resolved.action === 'skip') {
          items.push({
            sourcePath: it.source.path,
            sourceFormat: it.source.format,
            presentationTitle: presTitle,
            outputPath: resolved.path,
            status: 'skipped',
            warnings: it.source.warnings,
          });
        } else if (resolved.action === 'error') {
          items.push({
            sourcePath: it.source.path,
            sourceFormat: it.source.format,
            presentationTitle: presTitle,
            outputPath: resolved.path,
            status: 'failed',
            warnings: it.source.warnings,
            error: resolved.error,
          });
        } else {
          const expRes = await exportPresentation(it.presentation, targetFormat);
          if (!expRes.ok) {
            items.push({
              sourcePath: it.source.path,
              sourceFormat: it.source.format,
              presentationTitle: presTitle,
              outputPath: resolved.path,
              status: 'failed',
              warnings: it.source.warnings,
              error: expRes.error,
            });
          } else {
            try {
              await activeAdapter.writeFile(resolved.path, expRes.value.bytes);
              const expWarnings = expRes.value.warnings ?? expRes.warnings ?? [];
              items.push({
                sourcePath: it.source.path,
                sourceFormat: it.source.format,
                presentationTitle: presTitle,
                outputPath: resolved.path,
                status: 'success',
                warnings: [...it.source.warnings, ...expWarnings],
              });
            } catch (err) {
              items.push({
                sourcePath: it.source.path,
                sourceFormat: it.source.format,
                presentationTitle: presTitle,
                outputPath: resolved.path,
                status: 'failed',
                warnings: it.source.warnings,
                error: err instanceof Error ? err : new Error(String(err)),
              });
            }
          }
        }
      }
    }

    const successCount = items.filter((it) => it.status === 'success').length;
    const skippedCount = items.filter((it) => it.status === 'skipped').length;
    const failedCount = items.filter((it) => it.status === 'failed').length;
    const warningCount = items.reduce((acc, it) => acc + (it.warnings?.length ?? 0), 0);
    const totalFiles = new Set(targetItems.map((it) => it.source.id)).size;

    const summary: BatchSummary = {
      totalFiles,
      totalSongs: targetItems.length,
      successCount,
      skippedCount,
      failedCount,
      warningCount,
      items,
      ...(combinedOutputPath ? { combinedOutputPath } : {}),
      durationMs: Date.now() - startTime,
    };

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
