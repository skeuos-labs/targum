import { FORMAT_REGISTRY } from '../../pipeline/index.js';

export interface FormatsCommandOptions {
  json?: boolean;
}

export function executeFormatsCommand(options: FormatsCommandOptions = {}): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  if (options.json) {
    const jsonList = FORMAT_REGISTRY.map((f) => ({
      id: f.id,
      label: f.label,
      extensions: f.extensions,
      canImport: f.canImport,
      canExport: f.canExport,
    }));
    return {
      exitCode: 0,
      stdout: JSON.stringify(jsonList, null, 2),
      stderr: '',
    };
  }

  const headers = ['Format ID', 'Format Name', 'Extensions', 'Import', 'Export'];
  const rows = FORMAT_REGISTRY.map((f) => [
    f.id,
    f.label,
    f.extensions.join(', '),
    f.canImport ? 'Yes' : 'No',
    f.canExport ? 'Yes' : 'No',
  ]);

  const colWidths = headers.map((header, colIndex) => {
    const maxRowWidth = rows.reduce(
      (max, row) => Math.max(max, (row[colIndex] ?? '').length),
      0,
    );
    return Math.max(header.length, maxRowWidth);
  });

  const pad = (text: string, width: number) => text.padEnd(width);

  const headerLine = headers
    .map((header, i) => pad(header, colWidths[i]!))
    .join('  ');
  const dividerLine = colWidths
    .map((width) => '-'.repeat(width))
    .join('  ');
  const dataLines = rows.map((row) =>
    row.map((cell, i) => pad(cell, colWidths[i]!)).join('  '),
  );

  const stdout = [headerLine, dividerLine, ...dataLines].join('\n');

  return {
    exitCode: 0,
    stdout,
    stderr: '',
  };
}
