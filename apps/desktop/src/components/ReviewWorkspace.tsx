import { Presentation as PresentationIcon, AlertTriangle, Music } from 'lucide-react';
import { useSourceStore } from '../state/sourceStore';

export function ReviewWorkspace() {
  const { sources, selectedSourceId, selectedSongId, updateSongTitle } =
    useSourceStore();

  const currentSource =
    sources.find((s) => s.id === selectedSourceId) ?? sources[0];

  const activeSong =
    currentSource?.library.presentations.find((p) => p.id === selectedSongId) ??
    currentSource?.library.presentations[0];

  if (!currentSource || !activeSong) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-background select-none">
        <div className="mb-4 rounded-full bg-muted/60 p-4">
          <PresentationIcon className="h-10 w-10 text-muted-foreground opacity-60" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          Drop presentation files to get started
        </h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          Import ProPresenter (.pro, .pro6), VideoPsalm (.vpc), FreeShow (.show),
          PowerPoint (.pptx), or text files to review and convert.
        </p>
      </main>
    );
  }

  // Map slide ID to section
  const slideToSectionMap = new Map<string, { name: string; color?: string }>();
  for (const sec of activeSong.sections) {
    for (const sId of sec.slideIds) {
      if (!slideToSectionMap.has(sId)) {
        slideToSectionMap.set(sId, { name: sec.name, color: sec.color });
      }
    }
  }

  const allWarnings = [
    ...(currentSource.warnings ?? []),
    ...(activeSong.warnings ?? []),
  ];

  return (
    <main className="flex flex-1 flex-col overflow-y-auto bg-background p-6 space-y-5">
      {/* Song Overview Card */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              aria-label="Song Title"
              value={activeSong.title}
              onChange={(e) =>
                updateSongTitle(currentSource.id, activeSong.id, e.target.value)
              }
              className="w-full rounded border border-transparent bg-transparent text-xl font-bold text-foreground hover:border-border focus:border-border focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring px-2 py-0.5 -ml-2"
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1 px-0.5">
              <span>
                <strong className="text-foreground/80">Author:</strong>{' '}
                {activeSong.metadata.author || 'Unknown'}
              </span>
              <span>•</span>
              <span>
                <strong className="text-foreground/80">CCLI:</strong>{' '}
                {activeSong.metadata.ccli || '—'}
              </span>
              <span>•</span>
              <span>
                <strong className="text-foreground/80">Copyright:</strong>{' '}
                {activeSong.metadata.copyright || '—'}
              </span>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-mono font-semibold uppercase text-foreground">
              {currentSource.format}
            </span>
          </div>
        </div>

        {/* Sections Bar */}
        {activeSong.sections.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60">
            {activeSong.sections.map((sec) => (
              <span
                key={sec.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: sec.color || '#3b82f6' }}
                />
                <span className="font-medium text-foreground">{sec.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  ({sec.slideIds.length})
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Warnings Banner */}
      {allWarnings.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            <span>Warnings Detected</span>
          </div>
          {allWarnings.map((w, idx) => (
            <div key={idx} className="flex gap-2 text-[11px]">
              <span className="font-mono font-bold">[{w.code}]</span>
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Slide Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Music className="h-3.5 w-3.5" />
            <span>Slides ({activeSong.slides.length})</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {activeSong.slides.map((slide, index) => {
            const sec = slideToSectionMap.get(slide.id);
            const slideText = slide.items
              .filter((it) => it.type === 'text')
              .map((it) => it.plainText)
              .join('\n');

            return (
              <div
                key={slide.id || index}
                className="group relative flex flex-col aspect-video rounded-lg border border-border bg-zinc-950 text-zinc-100 p-3 shadow-sm overflow-hidden select-text"
              >
                <div className="flex items-center justify-between pb-1 border-b border-zinc-800/60 text-[11px]">
                  <span className="font-semibold text-zinc-300 truncate max-w-[120px]">
                    {sec?.name || slide.label || 'Slide'}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400">
                    {index + 1}/{activeSong.slides.length}
                  </span>
                </div>
                <div className="flex flex-1 items-center justify-center p-2 text-center overflow-hidden">
                  <p className="text-xs leading-relaxed font-medium whitespace-pre-wrap text-zinc-100">
                    {slideText || (
                      <span className="italic text-zinc-600">[Empty slide]</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
