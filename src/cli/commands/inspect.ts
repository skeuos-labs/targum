import fs from 'node:fs';
import type { Warning } from '../../canonical/index.js';
import { detectFormat, getFormat, importFile } from '../../pipeline/index.js';
import { formatCliWarning } from '../utils.js';

export interface InspectCommandOptions {
  input: string;
  json?: boolean;
}

export async function executeInspectCommand(options: InspectCommandOptions): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  if (!fs.existsSync(options.input)) {
    return {
      exitCode: 3,
      stdout: '',
      stderr: `File not found: ${options.input}`,
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
      stderr: `Failed to import "${options.input}": ${message}`,
    };
  }

  const result = await importFile(bytes, options.input);
  if (!result.ok) {
    return {
      exitCode: 2,
      stdout: '',
      stderr: `Failed to import "${options.input}": ${result.error.message}`,
    };
  }

  const library = result.value;
  const allWarnings: Warning[] = [...(result.warnings ?? [])];
  for (const pres of library.presentations) {
    for (const w of pres.warnings ?? []) {
      if (!allWarnings.includes(w)) {
        allWarnings.push(w);
      }
    }
  }

  const stderr =
    allWarnings.length > 0 ? allWarnings.map(formatCliWarning).join('\n') : '';

  if (options.json) {
    return {
      exitCode: 0,
      stdout: JSON.stringify(library, null, 2),
      stderr,
    };
  }

  const detected = detectFormat(options.input, bytes);
  const formatDef = detected ? getFormat(detected) : undefined;
  const formatLabel = formatDef
    ? `${formatDef.label} (${formatDef.id})`
    : (detected ?? 'unknown');

  const lines: string[] = [
    `File: ${options.input}`,
    `Format: ${formatLabel}`,
    `Presentations: ${library.presentations.length}`,
  ];

  for (let i = 0; i < library.presentations.length; i++) {
    const pres = library.presentations[i]!;
    lines.push('');
    lines.push(`--- Presentation ${i + 1}: ${pres.title || 'Untitled'} ---`);
    lines.push(`Title: ${pres.title || 'Untitled'}`);
    lines.push(`Author: ${pres.metadata.author ?? 'N/A'}`);
    lines.push(`CCLI: ${pres.metadata.ccli ?? 'N/A'}`);
    lines.push(`Copyright: ${pres.metadata.copyright ?? 'N/A'}`);
    lines.push(`Total Slides: ${pres.slides.length}`);

    if (pres.sections.length === 0) {
      lines.push('Sections (0): (none)');
    } else {
      lines.push(`Sections (${pres.sections.length}):`);
      for (const section of pres.sections) {
        lines.push(`  - ${section.name}: ${section.slideIds.length} slides`);
      }
    }

    if (pres.warnings && pres.warnings.length > 0) {
      lines.push(`Warnings (${pres.warnings.length}):`);
      for (const w of pres.warnings) {
        lines.push(`  ${formatCliWarning(w)}`);
      }
    }
  }

  return {
    exitCode: 0,
    stdout: lines.join('\n'),
    stderr,
  };
}
