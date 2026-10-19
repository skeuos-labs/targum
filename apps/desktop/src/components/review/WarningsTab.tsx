import { AlertTriangle, Check } from 'lucide-react';

export function WarningsTab({ warnings }: { warnings: { code: string; severity: string; message: string }[] }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h3 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Parse & Export Diagnostics
      </h3>

      {warnings.length > 0 ? (
        <div className="space-y-3">
          {warnings.map((warn, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs shadow-xs text-amber-900 dark:text-amber-200"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded border border-amber-500/30 bg-amber-500/20 px-1.5 py-0.5 font-mono text-[11px] font-bold">
                    [{warn.code}]
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    {warn.severity}
                  </span>
                </div>
                <p className="text-xs leading-relaxed">{warn.message}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          <Check className="mx-auto mb-2 h-8 w-8 text-emerald-500 opacity-80" />
          <p className="text-sm font-semibold text-foreground">
            No warnings for this file. Clean parse.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            All slides, sections, and metadata conform faithfully to the canonical format.
          </p>
        </div>
      )}
    </div>
  );
}
