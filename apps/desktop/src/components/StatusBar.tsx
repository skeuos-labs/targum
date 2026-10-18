import { useSourceStore } from '../state/sourceStore';
import { useExportStore } from '../state/exportStore';
import { getFormat } from '@show-converter/engine';

export function StatusBar() {
  const sources = useSourceStore((s) => s.sources);
  const { targetFormat, isExporting, progress } = useExportStore();

  const totalFiles = sources.length;
  const totalSongs = sources.reduce(
    (acc, source) => acc + source.library.presentations.length,
    0
  );

  const formatDef = getFormat(targetFormat);
  const targetLabel = formatDef ? formatDef.label : targetFormat.toUpperCase();

  return (
    <footer className="flex h-6 w-full items-center justify-between border-t border-border bg-card px-3 text-[11px] text-muted-foreground select-none">
      <div className="flex items-center space-x-3">
        <span>
          {totalFiles} {totalFiles === 1 ? 'file' : 'files'}
        </span>
        <span className="text-border">|</span>
        <span>
          {totalSongs} {totalSongs === 1 ? 'song' : 'songs'}
        </span>
        <span className="text-border">|</span>
        <span>Target: {targetLabel}</span>
      </div>

      <div className="flex items-center space-x-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            isExporting ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
          }`}
        />
        <span>{isExporting ? progress.message || 'Exporting...' : 'Ready'}</span>
      </div>
    </footer>
  );
}
