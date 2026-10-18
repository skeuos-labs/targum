import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  X,
} from 'lucide-react';
import { useExportStore } from '../state/exportStore';
import { getPlatformAdapter } from '../platform';

export function BatchProgressModal() {
  const { isExporting, progress, lastSummary, outputDirectory } = useExportStore();
  const adapter = getPlatformAdapter();

  if (!isExporting && !lastSummary) {
    return null;
  }

  const handleClose = () => {
    useExportStore.setState({ lastSummary: null });
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
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>

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
              <button
                type="button"
                aria-label="Dismiss"
                onClick={handleClose}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
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
              <button
                type="button"
                onClick={handleOpenFolder}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                <span>Open Output Folder</span>
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
