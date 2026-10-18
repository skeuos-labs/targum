import path from 'node:path';
import { batchConvert, type CollisionPolicy } from '../../batch/index.js';
import type { FormatId } from '../../canonical/index.js';
import { getFormat } from '../../pipeline/index.js';
import { formatCliWarning } from '../utils.js';

export interface BatchCommandOptions {
  inputs: string[];
  to: string;
  out: string;
  recursive?: boolean;
  combine?: boolean | string;
  combineName?: string;
  libraryName?: string;
  onCollision?: CollisionPolicy;
  strict?: boolean;
  json?: boolean;
}

export async function executeBatchCommand(
  rawOptions: BatchCommandOptions,
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  const normalizedTo =
    rawOptions.to.toLowerCase() === 'show' ? 'freeshow' : rawOptions.to;

  if (!rawOptions.out || rawOptions.out.trim() === '') {
    return {
      exitCode: 3,
      stdout: '',
      stderr: 'Missing required --out / -o option for batch command',
    };
  }

  if (!rawOptions.inputs || rawOptions.inputs.length === 0) {
    return {
      exitCode: 3,
      stdout: '',
      stderr: 'Missing required input file(s) or directory for batch command',
    };
  }

  const formatDef = getFormat(normalizedTo as FormatId);
  if (!formatDef || !formatDef.canExport) {
    return {
      exitCode: 3,
      stdout: '',
      stderr: `Unknown or unexportable target format: ${rawOptions.to}`,
    };
  }

  if (rawOptions.combine && rawOptions.libraryName) {
    return {
      exitCode: 3,
      stdout: '',
      stderr: '--combine and --library are mutually exclusive.',
    };
  }

  if (
    rawOptions.combine &&
    normalizedTo !== 'pptx' &&
    normalizedTo !== 'vpc' &&
    normalizedTo !== 'freeshow'
  ) {
    return {
      exitCode: 3,
      stdout: '',
      stderr: `--combine is only supported for pptx, vpc, and show formats (incompatible with "${rawOptions.to}").`,
    };
  }

  if (rawOptions.libraryName && normalizedTo !== 'pro') {
    return {
      exitCode: 3,
      stdout: '',
      stderr: '--library is only supported when target format is "pro".',
    };
  }

  const targetExt = formatDef.extensions[0] ?? `.${normalizedTo}`;
  const combineName =
    rawOptions.combineName ??
    (typeof rawOptions.combine === 'string' ? rawOptions.combine : undefined);

  const progressLines: string[] = [];

  try {
    const summary = await batchConvert(
      {
        inputs: rawOptions.inputs,
        to: normalizedTo as FormatId,
        outDir: rawOptions.out,
        recursive: rawOptions.recursive,
        onCollision: rawOptions.onCollision ?? 'rename',
        combine: Boolean(rawOptions.combine),
        combineName,
        libraryName: rawOptions.libraryName,
        strict: rawOptions.strict,
      },
      (progress) => {
        if (progress.status === 'processing') return;

        const sourceFile = path.basename(progress.sourcePath);
        let targetFile: string;
        if (rawOptions.combine) {
          const base = combineName || 'Combined_Presentations';
          targetFile = `${base}${targetExt}`;
        } else {
          const parsed = path.parse(sourceFile);
          targetFile = `${parsed.name}${targetExt}`;
        }

        let statusLabel = '(OK)';
        if (progress.status === 'skipped') {
          statusLabel = '(SKIPPED)';
        } else if (progress.status === 'failed') {
          statusLabel = '(FAILED)';
        }

        progressLines.push(
          `[${progress.currentFile}/${progress.totalFiles}] Converting ${sourceFile} -> ${targetFile} ${statusLabel}`,
        );
      },
    );

    let exitCode = 0;
    if (summary.failedCount > 0) {
      exitCode = 2;
    } else if (rawOptions.strict && summary.warningCount > 0) {
      exitCode = 1;
    }

    const stderrLines = [...progressLines];
    for (const item of summary.items) {
      for (const w of item.warnings ?? []) {
        stderrLines.push(formatCliWarning(w));
      }
    }

    if (rawOptions.json) {
      return {
        exitCode,
        stdout: JSON.stringify(summary, null, 2),
        stderr: stderrLines.join('\n'),
      };
    }

    const stdoutLines = [
      `Batch complete: ${summary.successCount}/${summary.totalSongs} songs succeeded across ${summary.totalFiles} files, ${summary.skippedCount} skipped, ${summary.failedCount} failed (${summary.durationMs}ms)`,
    ];
    if (summary.combinedOutputPath) {
      stdoutLines.push(`Combined output: ${summary.combinedOutputPath}`);
    }

    return {
      exitCode,
      stdout: stdoutLines.join('\n'),
      stderr: stderrLines.join('\n'),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      exitCode: 2,
      stdout: '',
      stderr: `Batch conversion failed: ${message}`,
    };
  }
}
