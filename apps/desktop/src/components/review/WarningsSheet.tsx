import type { Warning } from '@show-converter/engine';
import { AlertTriangle, Check, Info } from 'lucide-react';
import { useUiStore } from '../../state/uiStore';
import { cn } from '../../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const SEVERITY_STYLES: Record<
  Warning['severity'],
  { card: string; badge: string; Icon: typeof AlertTriangle }
> = {
  info: {
    card: 'border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-200',
    badge: 'border-sky-500/30 bg-sky-500/20 text-sky-700 dark:text-sky-300',
    Icon: Info,
  },
  warn: {
    card: 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200',
    badge: 'border-amber-500/30 bg-amber-500/20 text-amber-700 dark:text-amber-300',
    Icon: AlertTriangle,
  },
  error: {
    card: 'border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-200',
    badge: 'border-red-500/30 bg-red-500/20 text-red-700 dark:text-red-300',
    Icon: AlertTriangle,
  },
};

/** Modal sheet listing every warning; export is not blocked by errors. */
export function WarningsSheet({ warnings }: { warnings: Warning[] }) {
  const open = useUiStore((s) => s.warningsSheetOpen);
  const setWarningsSheetOpen = useUiStore((s) => s.setWarningsSheetOpen);

  return (
    <Dialog open={open} onOpenChange={(next) => setWarningsSheetOpen(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Full diagnostics</DialogTitle>
          <DialogDescription>
            Parse &amp; export warnings for the active file.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {warnings.length > 0 ? (
            warnings.map((warn, i) => {
              const style = SEVERITY_STYLES[warn.severity] ?? SEVERITY_STYLES.warn;
              const Icon = style.Icon;
              return (
                <div
                  key={`${warn.code}-${i}`}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3 text-xs shadow-xs',
                    style.card
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded border px-1.5 py-0.5 font-mono text-[11px] font-bold',
                          style.badge
                        )}
                      >
                        [{warn.code}]
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider">
                        {warn.severity}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed">{warn.message}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
              <Check className="mx-auto mb-2 h-8 w-8 text-emerald-500 opacity-80" />
              <p className="text-sm font-semibold text-foreground">No warnings</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Clean parse — nothing to review.
              </p>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Export can proceed — errors do not block conversion.
        </p>
      </DialogContent>
    </Dialog>
  );
}
