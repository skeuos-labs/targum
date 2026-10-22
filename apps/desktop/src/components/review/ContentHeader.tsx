import type { Presentation, Warning } from '@show-converter/engine';
import { AlertTriangle, Check, Copy, FileText } from 'lucide-react';
import { summarizeWarnings } from '../../lib/warningSummary';
import { formatLyricsForCopy } from '../../lib/lyrics';
import { useFlash } from '../../lib/useFlash';
import type { SlideToSectionMap } from '../../lib/slideText';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

export interface ContentHeaderProps {
  format: string;
  fileName: string;
  songTitle: string;
  subtitle: string;
  warnings: Warning[];
  song: Presentation;
  slideToSection: SlideToSectionMap;
}

/** Severity-aware chip label, e.g. "2 warn · 1 error" or "OK". */
export function formatWarningChipLabel(warnings: Warning[]): string {
  const s = summarizeWarnings(warnings);
  if (s.total === 0) return 'OK';
  const parts: string[] = [];
  if (s.info > 0) parts.push(`${s.info} info`);
  if (s.warn > 0) parts.push(`${s.warn} warn`);
  if (s.error > 0) parts.push(`${s.error} error`);
  return parts.join(' · ');
}

export function ContentHeader({
  format,
  fileName,
  songTitle,
  subtitle,
  warnings,
  song,
  slideToSection,
}: ContentHeaderProps) {
  const contentSegment = useUiStore((s) => s.contentSegment);
  const setContentSegment = useUiStore((s) => s.setContentSegment);
  const setWarningsSheetOpen = useUiStore((s) => s.setWarningsSheetOpen);
  const [copied, flashCopied] = useFlash();

  const summary = summarizeWarnings(warnings);

  const handleCopyLyrics = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(formatLyricsForCopy(song, slideToSection));
        flashCopied();
      }
    } catch {
      // clipboard fallback
    }
  };

  return (
    <header className="mx-auto w-full max-w-7xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Badge
            variant="outline"
            className="h-auto shrink-0 rounded border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-primary"
          >
            {format.toUpperCase()}
          </Badge>
          <div className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-foreground">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-muted-foreground" title={fileName}>
              {fileName}
            </span>
            <span className="text-muted-foreground/60">/</span>
            <span className="truncate font-bold text-foreground" title={songTitle}>
              {songTitle}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {summary.total === 0 ? (
            <Badge
              variant="outline"
              className="border-emerald-500/20 bg-emerald-500/10 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
            >
              OK
            </Badge>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setWarningsSheetOpen(true)}
              className="rounded-full border-amber-500/30 bg-amber-500/15 text-[11px] font-semibold text-amber-600 hover:bg-amber-500/25 hover:text-amber-600 dark:text-amber-400"
            >
              <AlertTriangle data-icon="inline-start" />
              <span>{formatWarningChipLabel(warnings)}</span>
            </Button>
          )}

          <div
            role="group"
            aria-label="Content view"
            className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5"
          >
            <button
              type="button"
              aria-pressed={contentSegment === 'structure'}
              onClick={() => setContentSegment('structure')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                contentSegment === 'structure'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Structure
            </button>
            <button
              type="button"
              aria-pressed={contentSegment === 'projection'}
              onClick={() => setContentSegment('projection')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                contentSegment === 'projection'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Projection
            </button>
          </div>

          <Button type="button" variant="secondary" size="xs" onClick={handleCopyLyrics}>
            {copied ? (
              <>
                <Check data-icon="inline-start" className="text-emerald-500" />
                <span className="text-emerald-500">Copied!</span>
              </>
            ) : (
              <>
                <Copy data-icon="inline-start" />
                <span>Copy lyrics</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
    </header>
  );
}
