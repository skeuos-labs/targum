import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  X,
} from 'lucide-react';
import { useExportStore } from '../state/exportStore';
import { getPlatformAdapter } from '../platform';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

export function BatchProgressModal() {
  const { isExporting, progress, lastSummary, outputDirectory, clearSummary } =
    useExportStore();
  const adapter = getPlatformAdapter();

  if (!isExporting && !lastSummary) {
    return null;
  }

  const handleClose = () => {
    clearSummary();
  };

  const handleOpenFolder = () => {
    if (outputDirectory) {
      adapter.openPath(outputDirectory).catch(() => {});
    }
  };

  const percent =
    progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Exporting In-Progress State */}
        {isExporting && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Exporting Presentations...
                </h3>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {progress.current} / {progress.total}
              </span>
            </div>

            {/* Progress Bar */}
            <Progress value={percent} aria-label="Export progress" />

            {/* Status Message */}
            <p className="text-xs text-muted-foreground truncate">
              {progress.message || 'Processing presentations...'}
            </p>
          </div>
        )}

        {/* Export Completed State */}
        {!isExporting && lastSummary && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                {lastSummary.failedCount === 0 ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                )}
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Export Complete
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Completed in {lastSummary.durationMs}ms
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Dismiss"
                onClick={handleClose}
              >
                <X />
              </Button>
            </div>

            {/* Stats Breakdown */}
            <div className="grid grid-cols-3 gap-2 py-2">
              <div className="rounded-lg border border-border bg-background p-2.5 text-center">
                <span className="block text-lg font-bold text-emerald-500">
                  {lastSummary.successCount}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {lastSummary.successCount === 1 ? '1 succeeded' : `${lastSummary.successCount} succeeded`}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5 text-center">
                <span className="block text-lg font-bold text-amber-500">
                  {lastSummary.skippedCount}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {lastSummary.skippedCount === 1 ? '1 skipped' : `${lastSummary.skippedCount} skipped`}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5 text-center">
                <span className="block text-lg font-bold text-rose-500">
                  {lastSummary.failedCount}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {lastSummary.failedCount === 1 ? '1 failed' : `${lastSummary.failedCount} failed`}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleOpenFolder}
              >
                <FolderOpen data-icon="inline-start" />
                <span>Open Output Folder</span>
              </Button>
              <Button type="button" size="xs" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
