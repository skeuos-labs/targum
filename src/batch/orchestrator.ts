import fs from 'node:fs';
import path from 'node:path';
import type { FormatId, Presentation, Warning } from '../canonical/types.js';
import { exportLibrary, exportPresentation, importFile } from '../pipeline/convert.js';
import { detectFormat } from '../pipeline/detector.js';
import { getFormat } from '../pipeline/registry.js';
import { resolveOutputPath } from './collision.js';
import { generateProPlaylist, type PlaylistPresentationEntry } from './playlist.js';
import { scanBatchInputs } from './scanner.js';
import type {
  BatchConvertOptions,
  BatchItemResult,
  BatchProgressCallback,
  BatchSummary,
} from './types.js';

interface AccumulatedItemRef {
  pres: Presentation;
  sourcePath: string;
  sourceFormat: FormatId;
  warnings: Warning[];
}

/**
 * Core batch orchestrator engine.
 * Converts sets of files/folders to individual or combined presentation outputs.
 */
export async function batchConvert(
  options: BatchConvertOptions,
  onProgress?: BatchProgressCallback
): Promise<BatchSummary> {
  const startTime = Date.now();

  // Validate outDir
  if (!options.outDir || options.outDir.trim() === '') {
    throw new Error('Output directory is required (--out).');
  }

  // Validate incompatible flags
  if (options.combine && options.libraryName) {
    throw new Error('--combine and --library are mutually exclusive.');
  }

  const normalizedTo =
    (options.to as string) === 'show' ? 'freeshow' : options.to;

  if (
    options.combine &&
    normalizedTo !== 'pptx' &&
    normalizedTo !== 'vpc' &&
    normalizedTo !== 'freeshow'
  ) {
    throw new Error(
      '--combine is only supported for pptx, vpc, and show formats. For ProPresenter, use --library <name>.'
    );
  }

  if (options.libraryName && normalizedTo !== 'pro') {
    throw new Error("--library is only supported when target format is 'pro'.");
  }

  const formatDef = getFormat(normalizedTo);
  if (!formatDef || !formatDef.canExport) {
    throw new Error(`Target format "${options.to}" does not support export.`);
  }

  const targetExt = formatDef.extensions[0] ?? `.${normalizedTo}`;

  // Ensure output directory exists
  await fs.promises.mkdir(options.outDir, { recursive: true });

  // Scan input files
  const { files: discoveredFiles, warnings: scanWarnings } = await scanBatchInputs(
    options.inputs,
    { recursive: options.recursive }
  );

  const totalFiles = discoveredFiles.length;
  const items: BatchItemResult[] = [];
  const trackedPaths = new Set<string>();
  let totalSongs = 0;

  const accumulatedPresentations: Presentation[] = [];
  const accumulatedRefs: AccumulatedItemRef[] = [];
  const playlistEntries: PlaylistPresentationEntry[] = [];

  for (let i = 0; i < totalFiles; i++) {
    const sourcePath = discoveredFiles[i]!;
    const currentFile = i + 1;

    onProgress?.({
      currentFile,
      totalFiles,
      sourcePath,
      status: 'processing',
    });

    let bytes: Uint8Array;
    try {
      bytes = await fs.promises.readFile(sourcePath);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      items.push({
        sourcePath,
        sourceFormat: 'unknown' as FormatId,
        presentationTitle: 'unknown',
        status: 'failed',
        warnings: [],
        error,
      });
      onProgress?.({
        currentFile,
        totalFiles,
        sourcePath,
        status: 'failed',
        error,
      });
      continue;
    }

    const imported = await importFile(bytes, sourcePath);
    if (!imported.ok) {
      const error = imported.error;
      items.push({
        sourcePath,
        sourceFormat: 'unknown' as FormatId,
        presentationTitle: 'unknown',
        status: 'failed',
        warnings: [],
        error,
      });
      onProgress?.({
        currentFile,
        totalFiles,
        sourcePath,
        status: 'failed',
        error,
      });
      continue;
    }

    const detected = detectFormat(sourcePath, bytes);
    const sourceFormat = (detected ?? 'unknown') as FormatId;
    const presentations = imported.value.presentations;
    const fileSongCount = presentations.length;
    totalSongs += fileSongCount;

    const importWarnings = imported.warnings ?? [];
    let anyFailed = false;
    let allSkipped = true;
    let lastError: Error | undefined;

    for (const pres of presentations) {
      const presTitle = pres.title || 'untitled';

      if (options.combine) {
        accumulatedPresentations.push(pres);
        accumulatedRefs.push({
          pres,
          sourcePath,
          sourceFormat,
          warnings: importWarnings,
        });
        allSkipped = false;
      } else if (options.libraryName) {
        const libDir = path.resolve(options.outDir, options.libraryName);
        await fs.promises.mkdir(libDir, { recursive: true });

        const resolved = resolveOutputPath(
          libDir,
          presTitle,
          '.pro',
          options.onCollision,
          trackedPaths
        );

        if (resolved.action === 'skip') {
          items.push({
            sourcePath,
            sourceFormat,
            presentationTitle: presTitle,
            outputPath: resolved.path,
            status: 'skipped',
            warnings: importWarnings,
          });
        } else if (resolved.action === 'error') {
          anyFailed = true;
          allSkipped = false;
          lastError = resolved.error;
          items.push({
            sourcePath,
            sourceFormat,
            presentationTitle: presTitle,
            outputPath: resolved.path,
            status: 'failed',
            warnings: importWarnings,
            error: resolved.error,
          });
        } else {
          allSkipped = false;
          const expRes = await exportPresentation(pres, 'pro');
          if (!expRes.ok) {
            anyFailed = true;
            lastError = expRes.error;
            items.push({
              sourcePath,
              sourceFormat,
              presentationTitle: presTitle,
              outputPath: resolved.path,
              status: 'failed',
              warnings: importWarnings,
              error: expRes.error,
            });
          } else {
            await fs.promises.writeFile(resolved.path, expRes.value.bytes);
            playlistEntries.push({
              title: presTitle,
              uuid: pres.id,
              relativePath: `./${path.basename(resolved.path)}`,
            });
            const expWarnings = expRes.value.warnings ?? expRes.warnings ?? [];
            items.push({
              sourcePath,
              sourceFormat,
              presentationTitle: presTitle,
              outputPath: resolved.path,
              status: 'success',
              warnings: [...importWarnings, ...expWarnings],
            });
          }
        }
      } else {
        // Individual mode
        const resolved = resolveOutputPath(
          options.outDir,
          presTitle,
          targetExt,
          options.onCollision,
          trackedPaths
        );

        if (resolved.action === 'skip') {
          items.push({
            sourcePath,
            sourceFormat,
            presentationTitle: presTitle,
            outputPath: resolved.path,
            status: 'skipped',
            warnings: importWarnings,
          });
        } else if (resolved.action === 'error') {
          anyFailed = true;
          allSkipped = false;
          lastError = resolved.error;
          items.push({
            sourcePath,
            sourceFormat,
            presentationTitle: presTitle,
            outputPath: resolved.path,
            status: 'failed',
            warnings: importWarnings,
            error: resolved.error,
          });
        } else {
          allSkipped = false;
          const expRes = await exportPresentation(pres, normalizedTo);
          if (!expRes.ok) {
            anyFailed = true;
            lastError = expRes.error;
            items.push({
              sourcePath,
              sourceFormat,
              presentationTitle: presTitle,
              outputPath: resolved.path,
              status: 'failed',
              warnings: importWarnings,
              error: expRes.error,
            });
          } else {
            await fs.promises.writeFile(resolved.path, expRes.value.bytes);
            const expWarnings = expRes.value.warnings ?? expRes.warnings ?? [];
            items.push({
              sourcePath,
              sourceFormat,
              presentationTitle: presTitle,
              outputPath: resolved.path,
              status: 'success',
              warnings: [...importWarnings, ...expWarnings],
            });
          }
        }
      }
    }

    const fileStatus = anyFailed
      ? 'failed'
      : allSkipped && fileSongCount > 0
        ? 'skipped'
        : 'success';

    onProgress?.({
      currentFile,
      totalFiles,
      sourcePath,
      songCount: fileSongCount,
      status: fileStatus,
      ...(lastError ? { error: lastError } : {}),
    });
  }

  // Post-loop processing
  let combinedOutputPath: string | undefined;

  if (options.combine && accumulatedPresentations.length > 0) {
    const combineBaseName = options.combineName?.trim() || 'Combined_Presentations';
    const resolved = resolveOutputPath(
      options.outDir,
      combineBaseName,
      targetExt,
      options.onCollision,
      trackedPaths
    );

    if (resolved.action === 'skip') {
      combinedOutputPath = resolved.path;
      for (const ref of accumulatedRefs) {
        items.push({
          sourcePath: ref.sourcePath,
          sourceFormat: ref.sourceFormat,
          presentationTitle: ref.pres.title || 'untitled',
          outputPath: resolved.path,
          status: 'skipped',
          warnings: ref.warnings,
        });
      }
    } else if (resolved.action === 'error') {
      for (const ref of accumulatedRefs) {
        items.push({
          sourcePath: ref.sourcePath,
          sourceFormat: ref.sourceFormat,
          presentationTitle: ref.pres.title || 'untitled',
          outputPath: resolved.path,
          status: 'failed',
          warnings: ref.warnings,
          error: resolved.error,
        });
      }
    } else {
      const combinedLibrary = { presentations: accumulatedPresentations };
      const expRes = await exportLibrary(combinedLibrary, normalizedTo);
      if (!expRes.ok) {
        for (const ref of accumulatedRefs) {
          items.push({
            sourcePath: ref.sourcePath,
            sourceFormat: ref.sourceFormat,
            presentationTitle: ref.pres.title || 'untitled',
            status: 'failed',
            warnings: ref.warnings,
            error: expRes.error,
          });
        }
      } else {
        await fs.promises.writeFile(resolved.path, expRes.value.bytes);
        combinedOutputPath = resolved.path;
        const expWarnings = expRes.value.warnings ?? expRes.warnings ?? [];
        for (const ref of accumulatedRefs) {
          items.push({
            sourcePath: ref.sourcePath,
            sourceFormat: ref.sourceFormat,
            presentationTitle: ref.pres.title || 'untitled',
            outputPath: resolved.path,
            status: 'success',
            warnings: [...ref.warnings, ...expWarnings],
          });
        }
      }
    }
  }

  if (options.libraryName && playlistEntries.length > 0) {
    const libDir = path.resolve(options.outDir, options.libraryName);
    const playlistBytes = generateProPlaylist(options.libraryName, playlistEntries);
    const playlistPath = path.resolve(libDir, `${options.libraryName}.proplaylist`);
    await fs.promises.writeFile(playlistPath, playlistBytes);
  }

  const successCount = items.filter((it) => it.status === 'success').length;
  const skippedCount = items.filter((it) => it.status === 'skipped').length;
  const failedCount = items.filter((it) => it.status === 'failed').length;
  const warningCount =
    scanWarnings.length +
    items.reduce((acc, it) => acc + (it.warnings?.length ?? 0), 0);

  const summary: BatchSummary = {
    totalFiles,
    totalSongs,
    successCount,
    skippedCount,
    failedCount,
    warningCount,
    items,
    ...(combinedOutputPath ? { combinedOutputPath } : {}),
    durationMs: Date.now() - startTime,
  };

  return summary;
}
