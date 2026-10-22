import { useState } from 'react';
import { FolderPlus, FilePlus, ChevronLeft } from 'lucide-react';
import { useSourceStore } from '../state/sourceStore';
import { useUiStore } from '../state/uiStore';
import { getPlatformAdapter } from '../platform';
import { useDropTarget } from '../lib/useDropTarget';
import { DropOverlay } from './DropOverlay';
import { Button } from './ui/button';
import { SourceList } from './source/SourceList';

export function SourcesSidebar() {
  const sources = useSourceStore((s) => s.sources);
  const selectedSourceId = useSourceStore((s) => s.selectedSourceId);
  const selectedSongId = useSourceStore((s) => s.selectedSongId);
  const selectedSongs = useSourceStore((s) => s.selectedSongs);
  const addFiles = useSourceStore((s) => s.addFiles);
  const importPaths = useSourceStore((s) => s.importPaths);
  const showToast = useUiStore((s) => s.showToast);
  const removeSource = useSourceStore((s) => s.removeSource);
  const selectSong = useSourceStore((s) => s.selectSong);
  const toggleSongSelection = useSourceStore((s) => s.toggleSongSelection);
  const selectAllSongs = useSourceStore((s) => s.selectAllSongs);
  const clearAll = useSourceStore((s) => s.clearAll);
  const sourcesRailCollapsed = useUiStore((s) => s.sourcesRailCollapsed);
  const toggleSourcesRail = useUiStore((s) => s.toggleSourcesRail);

  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const adapter = getPlatformAdapter();

  const { ref: dropRef } = useDropTarget({
    id: 'sidebar',
    onDropFiles: async (files) => {
      const count = await addFiles(files, adapter);
      if (files.length > 0 && count === 0) {
        showToast('No supported songs found');
      }
    },
    onDropPaths: async (paths) => {
      await importPaths(paths, adapter);
    },
  });

  const allSongKeys: string[] = [];
  for (const s of sources) {
    for (const p of s.library.presentations) {
      allSongKeys.push(`${s.id}:${p.id}`);
    }
  }
  const noEligibleSongs = allSongKeys.length === 0;

  const handleAddFiles = async () => {
    try {
      const paths = await adapter.pickFiles();
      if (paths && paths.length > 0) {
        await importPaths(paths, adapter);
      }
    } catch {
      // Pick cancelled or failed
    }
  };

  const handleAddFolder = async () => {
    try {
      const dir = await adapter.pickDirectory();
      if (dir) {
        await importPaths([dir], adapter);
      }
    } catch {
      // Pick cancelled or failed
    }
  };

  // Collapse only hides the rail; selection state stays untouched.
  if (sourcesRailCollapsed) {
    return null;
  }

  return (
    <aside
      ref={dropRef}
      data-drop-target="sidebar"
      className="relative flex h-full w-80 flex-col border-r border-border bg-card/40 select-none overflow-hidden"
    >
      <DropOverlay targetId="sidebar" compact />

      <div className="flex flex-col gap-2 border-b border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Sources
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {sources.length} files
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {selectedSongs.size}/{allSongKeys.length} selected
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Collapse sources rail"
              onClick={toggleSourcesRail}
            >
              <ChevronLeft />
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={handleAddFiles}
            className="flex-1 justify-center"
          >
            <FilePlus data-icon="inline-start" />
            <span>Add Files</span>
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={handleAddFolder}
            className="flex-1 justify-center"
          >
            <FolderPlus data-icon="inline-start" />
            <span>Add Folder</span>
          </Button>
          {sources.length > 0 && (
            <Button
              variant="outline"
              size="xs"
              onClick={clearAll}
              className="flex-1 justify-center text-muted-foreground hover:border-destructive/40 hover:text-destructive"
            >
              Clear All
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={noEligibleSongs}
            onClick={() => selectAllSongs(true)}
            className="h-auto p-0 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Select all
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={noEligibleSongs}
            onClick={() => selectAllSongs(false)}
            className="h-auto p-0 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Select none
          </Button>
        </div>
      </div>

      <SourceList
        sources={sources}
        selectedSourceId={selectedSourceId}
        selectedSongId={selectedSongId}
        selectedSongs={selectedSongs}
        expandedSources={expandedSources}
        onToggleExpanded={(id) =>
          setExpandedSources((prev) => ({
            ...prev,
            [id]: prev[id] === undefined ? false : !prev[id],
          }))
        }
        onSelectSong={selectSong}
        onToggleSong={toggleSongSelection}
        onRemoveSource={removeSource}
      />
    </aside>
  );
}
