import { useState } from 'react';
import { FolderPlus, FilePlus } from 'lucide-react';
import { useSourceStore } from '../state/sourceStore';
import { getPlatformAdapter } from '../platform';
import { useDropTarget } from '../lib/useDropTarget';
import { DropOverlay } from './DropOverlay';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { SourceList } from './source/SourceList';

export function SourcesSidebar() {
  const sources = useSourceStore((s) => s.sources);
  const selectedSourceId = useSourceStore((s) => s.selectedSourceId);
  const selectedSongId = useSourceStore((s) => s.selectedSongId);
  const selectedSongs = useSourceStore((s) => s.selectedSongs);
  const addFiles = useSourceStore((s) => s.addFiles);
  const addDirectory = useSourceStore((s) => s.addDirectory);
  const removeSource = useSourceStore((s) => s.removeSource);
  const selectSong = useSourceStore((s) => s.selectSong);
  const toggleSongSelection = useSourceStore((s) => s.toggleSongSelection);
  const selectAllSongs = useSourceStore((s) => s.selectAllSongs);
  const clearAll = useSourceStore((s) => s.clearAll);

  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const adapter = getPlatformAdapter();

  const { ref: dropRef } = useDropTarget({
    id: 'sidebar',
    onDropFiles: async (files) => {
      await addFiles(files, adapter);
    },
    onDropPaths: async (paths) => {
      await addFiles(paths, adapter);
    },
  });

  const allSongKeys: string[] = [];
  for (const s of sources) {
    for (const p of s.library.presentations) {
      allSongKeys.push(`${s.id}:${p.id}`);
    }
  }
  const isAllSelected =
    allSongKeys.length > 0 && allSongKeys.every((key) => selectedSongs.has(key));

  const handleAddFiles = async () => {
    try {
      const paths = await adapter.pickFiles();
      if (paths && paths.length > 0) {
        await addFiles(paths, adapter);
      }
    } catch {
      // Pick cancelled or failed
    }
  };

  const handleAddFolder = async () => {
    try {
      const dir = await adapter.pickDirectory();
      if (dir) {
        await addDirectory(dir, true, adapter);
      }
    } catch {
      // Pick cancelled or failed
    }
  };

  return (
    <aside
      ref={dropRef}
      data-drop-target="sidebar"
      className="relative flex h-full w-80 flex-col border-r border-border bg-card/40 select-none overflow-hidden"
    >
      <DropOverlay targetId="sidebar" compact />

      <div className="flex flex-col gap-2 border-b border-border p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Sources
          </h2>
          {sources.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={clearAll}
              className="h-auto p-0 text-[11px] text-muted-foreground hover:text-destructive"
            >
              Clear All
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="xs" onClick={handleAddFiles} className="justify-center">
            <FilePlus data-icon="inline-start" />
            <span>Add Files</span>
          </Button>
          <Button variant="outline" size="xs" onClick={handleAddFolder} className="justify-center">
            <FolderPlus data-icon="inline-start" />
            <span>Add Folder</span>
          </Button>
        </div>

        {allSongKeys.length > 0 && (
          <div className="flex items-center justify-between pt-1">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={(checked) => selectAllSongs(checked === true)}
                aria-label="Select all songs"
              />
              <span>
                Select All ({selectedSongs.size}/{allSongKeys.length})
              </span>
            </label>
          </div>
        )}
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
