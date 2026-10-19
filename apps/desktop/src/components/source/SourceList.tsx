import { ChevronDown, ChevronRight, Music, Trash2 } from 'lucide-react';
import type { SourceFile } from '../../state/sourceStore';
import { cn } from '../../lib/utils';
import { Checkbox } from '../ui/checkbox';

export function SourceList({
  sources,
  selectedSourceId,
  selectedSongId,
  selectedSongs,
  expandedSources,
  onToggleExpanded,
  onSelectSong,
  onToggleSong,
  onRemoveSource,
}: {
  sources: SourceFile[];
  selectedSourceId?: string;
  selectedSongId?: string;
  selectedSongs: Set<string>;
  expandedSources: Record<string, boolean>;
  onToggleExpanded: (id: string) => void;
  onSelectSong: (sourceId: string, songId: string) => void;
  onToggleSong: (sourceId: string, songId: string) => void;
  onRemoveSource: (sourceId: string) => void;
}) {
  if (sources.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center p-4 text-center text-muted-foreground">
        <FileEmptyIcon />
        <p className="text-xs">No files added yet</p>
        <p className="mt-1 text-[11px] opacity-70">Click Add Files or drag files here</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-2">
      {sources.map((source) => {
        const open = expandedSources[source.id] !== false;
        const songCount = source.library.presentations.length;

        return (
          <div
            key={source.id}
            className="overflow-hidden rounded-md border border-border bg-card/60"
          >
            <div className="group flex items-center justify-between p-2 hover:bg-accent/40">
              <button
                type="button"
                onClick={() => onToggleExpanded(source.id)}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
              >
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="shrink-0 rounded bg-primary/10 px-1 py-0.2 font-mono text-[10px] font-bold text-primary uppercase">
                  .{source.format}
                </span>
                <span
                  className="truncate text-xs font-medium text-foreground"
                  title={source.name}
                >
                  {source.name}
                </span>
              </button>

              <div className="ml-2 flex shrink-0 items-center gap-1.5">
                <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
                  {songCount}
                </span>
                <button
                  type="button"
                  aria-label={`Remove source ${source.name}`}
                  onClick={() => onRemoveSource(source.id)}
                  className="p-0.5 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {open && (
              <div className="divide-y divide-border/30 border-t border-border/50 bg-background/50">
                {source.library.presentations.map((song) => {
                  const songKey = `${source.id}:${song.id}`;
                  const isChecked = selectedSongs.has(songKey);
                  const isCurrent =
                    selectedSourceId === source.id && selectedSongId === song.id;

                  return (
                    <div
                      key={song.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs transition-colors hover:bg-accent/60',
                        isCurrent && 'border-l-2 border-primary bg-accent font-semibold'
                      )}
                      onClick={() => onSelectSong(source.id, song.id)}
                    >
                      <Checkbox
                        aria-label={`Select song ${song.title}`}
                        checked={isChecked}
                        onCheckedChange={() => onToggleSong(source.id, song.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Music className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate text-foreground">
                        {song.title || 'Untitled Song'}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {song.slides.length} slides
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FileEmptyIcon() {
  return (
    <svg
      className="mb-2 h-8 w-8 opacity-40"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 3v5h5" />
    </svg>
  );
}
