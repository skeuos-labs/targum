/**
 * Strips or replaces illegal filename characters: `[/\\:*?"<>|]` and control characters (`[\u0000-\u001f\u007f]`).
 * Trims leading and trailing spaces and dots.
 * Fallbacks to "untitled" if empty string.
 */
export function sanitizeFileName(title: string): string {
  const stripped = title.replace(/[/\\:*?"<>|\u0000-\u001f\u007f]/g, '');
  const trimmed = stripped.replace(/^[. ]+|[. ]+$/g, '');
  if (trimmed.length === 0) {
    return 'untitled';
  }
  return trimmed;
}
