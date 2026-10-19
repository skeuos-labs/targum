import { useMemo, useRef, useState } from 'react';
import { Presentation as PresentationIcon } from 'lucide-react';
import { useSourceStore } from '../state/sourceStore';
import { getPlatformAdapter } from '../platform';
import { useDropTarget } from '../lib/useDropTarget';
import { DropOverlay } from './DropOverlay';
import { useDndStore } from '../state/dndStore';
import { formatSourceFormatLabel } from '../lib/formatLabels';
import { useSlideToSectionMap } from '../lib/useSlideToSectionMap';
import { Tabs, TabsContent } from './ui/tabs';
import { ReviewHeader } from './review/ReviewHeader';
import {
  DEFAULT_REVIEW_TAB,
  REVIEW_TABS,
  type ReviewTab,
} from './review/tabsRegistry';

export type { ReviewTab };

export function ReviewWorkspace() {
  const sources = useSourceStore((s) => s.sources);
  const selectedSourceId = useSourceStore((s) => s.selectedSourceId);
  const selectedSongId = useSourceStore((s) => s.selectedSongId);
  const addFiles = useSourceStore((s) => s.addFiles);
  const isDraggingOver = useDndStore((s) => s.dragging && s.target === 'center');
  const [activeTab, setActiveTab] = useState<ReviewTab>(DEFAULT_REVIEW_TAB);

  const adapterRef = useRef(getPlatformAdapter());
  const { ref: dropRef } = useDropTarget({
    id: 'center',
    onDropFiles: async (files) => {
      await addFiles(files, adapterRef.current);
    },
    onDropPaths: async (paths) => {
      await addFiles(paths, adapterRef.current);
    },
  });

  const currentSource = sources.find((s) => s.id === selectedSourceId) ?? sources[0];
  const activeSong =
    currentSource?.library.presentations.find((p) => p.id === selectedSongId) ??
    currentSource?.library.presentations[0];

  const slideToSection = useSlideToSectionMap(activeSong);
  const warnings = useMemo(() => {
    if (!currentSource || !activeSong) return [];
    return [...(currentSource.warnings ?? []), ...(activeSong.warnings ?? [])];
  }, [currentSource, activeSong]);

  if (!currentSource || !activeSong) {
    return (
      <main
        ref={dropRef}
        data-drop-target="center"
        className={`relative flex flex-1 flex-col items-center justify-center bg-background p-8 text-center select-none transition-colors ${
          isDraggingOver ? 'border-2 border-dashed border-primary bg-primary/5' : ''
        }`}
      >
        <DropOverlay
          targetId="center"
          title="Drop files to import"
          subtitle="Supports .pro, .pro6, .vpc, .show, .pptx, .txt"
        />
        <div className="mb-4 rounded-full bg-muted/60 p-4">
          <PresentationIcon className="h-10 w-10 text-muted-foreground opacity-60" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          Drop presentation files to get started
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Import ProPresenter (.pro, .pro6), VideoPsalm (.vpc), FreeShow (.show),
          PowerPoint (.pptx), or text files to review and convert.
        </p>
      </main>
    );
  }

  const tabProps = {
    source: currentSource,
    song: activeSong,
    slideToSection,
    warnings,
  };

  return (
    <main
      ref={dropRef}
      data-drop-target="center"
      className={`relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background select-none transition-colors ${
        isDraggingOver ? 'ring-2 ring-inset ring-primary bg-primary/5' : ''
      }`}
    >
      <DropOverlay
        targetId="center"
        title="Drop presentation files to import"
        subtitle="Supports .pro, .pro6, .vpc, .show, .pptx, .txt"
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ReviewTab)}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <ReviewHeader
          format={currentSource.format}
          fileName={currentSource.name}
          songTitle={activeSong.title}
          subtitle={buildSubtitle(currentSource, activeSong)}
          warningCount={warnings.length}
          onShowWarnings={() => setActiveTab('warnings')}
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-6 select-text">
          {REVIEW_TABS.map(({ id, Component }) => (
            <TabsContent key={id} value={id} className="mt-0">
              <Component {...tabProps} />
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </main>
  );
}

function buildSubtitle(
  source: { library: { presentations: unknown[] }; format: string },
  song: { sections: unknown[]; slides: unknown[]; sourceFormat?: string }
): string {
  const songCount = source.library.presentations.length;
  const sectionCount = song.sections.length;
  const slideCount = song.slides.length;
  const formatLabel = formatSourceFormatLabel(song.sourceFormat || source.format);
  return `${songCount} ${songCount === 1 ? 'song' : 'songs'} · ${sectionCount} ${
    sectionCount === 1 ? 'section' : 'sections'
  } · ${slideCount} ${slideCount === 1 ? 'slide' : 'slides'} · ${formatLabel}`;
}
