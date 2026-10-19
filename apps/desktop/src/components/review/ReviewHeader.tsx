import { AlertTriangle, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { TabsList, TabsTrigger } from '../ui/tabs';
import type { ReviewTab } from '../ReviewWorkspace';

const TAB_DEFS: { id: ReviewTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'sections', label: 'Sections' },
  { id: 'slides', label: 'Slides' },
  { id: 'warnings', label: 'Warnings' },
  { id: 'json', label: 'Raw JSON' },
];

export function ReviewHeader({
  format,
  fileName,
  songTitle,
  subtitle,
  warningCount,
  onShowWarnings,
}: {
  format: string;
  fileName: string;
  songTitle: string;
  subtitle: string;
  warningCount: number;
  onShowWarnings: () => void;
}) {
  return (
    <header className="shrink-0 border-b border-border bg-card px-6 pt-4 pb-0">
      <div className="flex items-center justify-between gap-4">
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

        {warningCount === 0 ? (
          <Badge
            variant="outline"
            className="shrink-0 border-emerald-500/20 bg-emerald-500/10 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
          >
            OK
          </Badge>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onShowWarnings}
            className="shrink-0 rounded-full border-amber-500/30 bg-amber-500/15 text-[11px] font-semibold text-amber-600 hover:bg-amber-500/25 hover:text-amber-600 dark:text-amber-400"
          >
            <AlertTriangle data-icon="inline-start" />
            <span>
              {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
            </span>
          </Button>
        )}
      </div>

      <p className="mt-1 mb-3 truncate text-xs text-muted-foreground">{subtitle}</p>

      <TabsList
        variant="line"
        className="h-auto w-full justify-start gap-6 rounded-none border-t border-border/60 bg-transparent p-0 pt-2"
      >
        {TAB_DEFS.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="border-b-2 border-transparent pb-2.5 text-xs font-semibold uppercase tracking-wider data-active:border-primary data-active:text-primary"
          >
            <span>{tab.label}</span>
            {tab.id === 'warnings' && warningCount > 0 && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {warningCount}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </header>
  );
}
