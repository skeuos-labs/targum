import fs from 'node:fs';
import path from 'node:path';
import type { Presentation, Warning } from '../../canonical/index.js';
import {
  exportLibrary,
  exportPresentation,
  getFormat,
  importFile,
  type FormatId,
} from '../../pipeline/index.js';
import {
  disambiguateFileName,
  formatCliWarning,
  sanitizeFileName,
} from '../utils.js';

export interface ConvertCommandOptions {
  input: string;
  to: string;
  out?: string;
  force?: boolean;
  strict?: boolean;
  song?: string;
  split?: string;
  json?: boolean;
}

export async function executeConvertCommand(
  options: ConvertCommandOptions,
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  if (!fs.existsSync(options.input)) {
    return {
      exitCode: 3,
      stdout: '',
      stderr: `Input file not found: ${options.input}`,
    };
  }

  const targetFormat = getFormat(options.to as FormatId);
  if (!targetFormat || !targetFormat.canExport) {
    return {
      exitCode: 3,
      stdout: '',
      stderr: `Unknown or unexportable target format: ${options.to}`,
    };
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(fs.readFileSync(options.input));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      exitCode: 2,
      stdout: '',
      stderr: `Import failed: ${message}`,
    };
  }

  const importResult = await importFile(bytes, options.input);
  if (!importResult.ok) {
    return {
      exitCode: 2,
      stdout: '',
      stderr: `Import failed: ${importResult.error.message}`,
    };
  }

  let library = importResult.value;
  const count = library.presentations.length;
  const singleSongFormats: readonly string[] = ['pro', 'txt', 'pptx'];

  if (
    count > 1 &&
    singleSongFormats.includes(options.to) &&
    !options.split &&
    !options.song
  ) {
    return {
      exitCode: 2,
      stdout: '',
      stderr: `Input "${options.input}" contains ${count} songs, but target format "${options.to}" only supports 1 song per file. Use --split <dir> to unpack all songs or --song <index|title> to convert one.`,
    };
  }

  if (options.song !== undefined && options.song !== '') {
    const songQuery = options.song.trim();
    let matchedPres: Presentation | undefined;

    const indexNum = Number(songQuery);
    if (
      Number.isInteger(indexNum) &&
      indexNum >= 1 &&
      indexNum <= library.presentations.length
    ) {
      matchedPres = library.presentations[indexNum - 1];
    } else {
      const lower = songQuery.toLowerCase();
      matchedPres = library.presentations.find(
        (p) => (p.title || '').trim().toLowerCase() === lower,
      );
    }

    if (!matchedPres) {
      return {
        exitCode: 3,
        stdout: '',
        stderr: `Song "${options.song}" not found in ${options.input}`,
      };
    }

    library = {
      ...library,
      presentations: [matchedPres],
    };
  }

  if (options.split) {
    if (!fs.existsSync(options.split)) {
      fs.mkdirSync(options.split, { recursive: true });
    }

    const ext = targetFormat.extensions[0] ?? `.${targetFormat.id}`;
    const writtenFiles: string[] = [];
    const allWarnings: Warning[] = [...(importResult.warnings ?? [])];

    for (const p of library.presentations) {
      for (const w of p.warnings ?? []) {
        if (!allWarnings.includes(w)) {
          allWarnings.push(w);
        }
      }

      const exportRes = await exportPresentation(p, targetFormat.id);
      if (!exportRes.ok) {
        return {
          exitCode: 2,
          stdout: '',
          stderr: `Export failed: ${exportRes.error.message}`,
        };
      }

      for (const w of exportRes.value.warnings ?? []) {
        if (!allWarnings.includes(w)) {
          allWarnings.push(w);
        }
      }

      const baseName = sanitizeFileName(p.title || 'untitled');
      const targetPath = options.force
        ? path.resolve(options.split, `${baseName}${ext}`)
        : disambiguateFileName(options.split, baseName, ext);

      if (
        path.resolve(targetPath).toLowerCase() ===
        path.resolve(options.input).toLowerCase()
      ) {
        return {
          exitCode: 3,
          stdout: '',
          stderr: 'Target output path cannot equal source input path.',
        };
      }

      fs.writeFileSync(targetPath, exportRes.value.bytes);
      writtenFiles.push(targetPath);
    }

    const exitCode = options.strict && allWarnings.length > 0 ? 1 : 0;
    if (options.json) {
      return {
        exitCode,
        stdout: JSON.stringify(
          {
            ok: true,
            count: writtenFiles.length,
            outDir: options.split,
            files: writtenFiles,
            warnings: allWarnings,
          },
          null,
          2,
        ),
        stderr: '',
      };
    }

    const summaryLines = [
      `Unpacked ${writtenFiles.length} songs to ${options.split}:`,
      ...writtenFiles.map((f) => `  ${f}`),
    ];
    return {
      exitCode,
      stdout: summaryLines.join('\n'),
      stderr:
        allWarnings.length > 0
          ? allWarnings.map(formatCliWarning).join('\n')
          : '',
    };
  }

  const ext = targetFormat.extensions[0] ?? `.${targetFormat.id}`;
  let outputPath: string;
  if (options.out) {
    outputPath = path.resolve(options.out);
  } else {
    const parsed = path.parse(options.input);
    outputPath = path.resolve(parsed.dir, `${parsed.name}${ext}`);
  }

  if (
    path.resolve(outputPath).toLowerCase() ===
    path.resolve(options.input).toLowerCase()
  ) {
    return {
      exitCode: 3,
      stdout: '',
      stderr: 'Target output path cannot equal source input path.',
    };
  }

  if (fs.existsSync(outputPath) && !options.force) {
    return {
      exitCode: 3,
      stdout: '',
      stderr: `Output file already exists: ${outputPath}. Use --force / -f to overwrite.`,
    };
  }

  const exportRes = await exportLibrary(library, targetFormat.id);
  if (!exportRes.ok) {
    return {
      exitCode: 2,
      stdout: '',
      stderr: `Export failed: ${exportRes.error.message}`,
    };
  }

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, exportRes.value.bytes);

  const allWarnings: Warning[] = [...(importResult.warnings ?? [])];
  for (const p of library.presentations) {
    for (const w of p.warnings ?? []) {
      if (!allWarnings.includes(w)) {
        allWarnings.push(w);
      }
    }
  }
  for (const w of exportRes.value.warnings ?? []) {
    if (!allWarnings.includes(w)) {
      allWarnings.push(w);
    }
  }

  const exitCode = options.strict && allWarnings.length > 0 ? 1 : 0;
  if (options.json) {
    return {
      exitCode,
      stdout: JSON.stringify(
        {
          ok: true,
          source: options.input,
          target: outputPath,
          format: options.to,
          warnings: allWarnings,
        },
        null,
        2,
      ),
      stderr: '',
    };
  }

  return {
    exitCode,
    stdout: outputPath,
    stderr:
      allWarnings.length > 0
        ? allWarnings.map(formatCliWarning).join('\n')
        : '',
  };
}
