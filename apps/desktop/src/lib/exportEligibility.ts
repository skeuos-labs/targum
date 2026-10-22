export type ExportBlockReason = 'no-selection' | 'no-output-dir';

export function getExportBlockReason(
  selectedCount: number,
  outputDirectory: string
): ExportBlockReason | null {
  if (selectedCount <= 0) {
    return 'no-selection';
  }
  if (!outputDirectory.trim()) {
    return 'no-output-dir';
  }
  return null;
}

export function exportBlockMessage(reason: ExportBlockReason | null): string | null {
  switch (reason) {
    case 'no-selection':
      return 'Select songs to export';
    case 'no-output-dir':
      return 'Pick an output folder';
    default:
      return null;
  }
}
