import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';
import { useSourceStore } from '../../state/sourceStore';
import { useExportStore } from '../../state/exportStore';
import { getPlatformAdapter } from '../../platform';
import { exportBlockMessage, getExportBlockReason } from '../../lib/exportEligibility';
import { Button } from '../ui/button';
import { FORMAT_OPTIONS } from './FormatOptions';

interface ExportPeekProps {
  expanded: boolean;
  onToggle: () => void;
  onHelperClick: () => void;
  /** Expanded settings body, slotted between the status rows and the footer. */
  children?: ReactNode;
}

/**
 * Peek chrome + pinned export footer for the export drawer: header row with
 * expand/collapse control, format/destination status rows (collapsed only),
 * and the Export button with its disabled helper.
 */
export function ExportPeek({ expanded, onToggle, onHelperClick, children }: ExportPeekProps) {
  const selectedSongs = useSourceStore((s) => s.selectedSongs);
  const { targetFormat, outputDirectory, isExporting, executeExport } = useExportStore();

  const selectedCount = selectedSongs.size;
  const blockReason = getExportBlockReason(selectedCount, outputDirectory);
  const helper = exportBlockMessage(blockReason);
  const canExport = blockReason === null && !isExporting;

  const formatOption = FORMAT_OPTIONS.find((f) => f.id === targetFormat) ?? FORMAT_OPTIONS[0]!;

  const handleExport = () => {
    executeExport(getPlatformAdapter()).catch(() => {});
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-border p-3">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          <Settings2 className="h-3.5 w-3.5" />
          <span>Export</span>
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={expanded ? 'Collapse export settings' : 'Expand export settings'}
          onClick={onToggle}
        >
          {expanded ? <ChevronRight /> : <ChevronLeft />}
        </Button>
      </div>

      {!expanded && (
        <div className="space-y-2 border-b border-border p-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
              {formatOption.label}
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {formatOption.ext}
            </span>
          </div>
          {outputDirectory ? (
            <p className="truncate text-[11px] text-muted-foreground" title={outputDirectory}>
              {outputDirectory}
            </p>
          ) : (
            <p className="text-[11px] font-medium text-amber-500">No folder selected</p>
          )}
        </div>
      )}

      {children}

      <div className="mt-auto space-y-1.5 border-t border-border bg-card/80 p-3">
        <Button
          type="button"
          disabled={!canExport}
          onClick={handleExport}
          className="w-full justify-center py-2.5 text-xs font-semibold"
        >
          <CheckCircle2 data-icon="inline-start" />
          <span>
            {isExporting
              ? 'Exporting...'
              : `Export ${selectedCount} Song${selectedCount === 1 ? '' : 's'}`}
          </span>
          <ArrowRight data-icon="inline-end" />
        </Button>
        {helper && (
          <button
            type="button"
            onClick={onHelperClick}
            className="w-full rounded px-1 py-0.5 text-center text-[11px] text-muted-foreground hover:text-foreground"
          >
            {helper}
          </button>
        )}
      </div>
    </>
  );
}
