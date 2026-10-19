import { useState } from 'react';
import {
  FolderPlus,
  FilePlus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Music,
  FileText,
} from 'lucide-react';
import { useSourceStore } from '../state/sourceStore';
import { getPlatformAdapter } from '../platform';
import { cn } from '../lib/utils';
import { useDropTarget } from '../lib/useDropTarget';
import { DropOverlay } from './DropOverlay';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';

export function SourcesSidebar() {
  const {
    sources,
    selectedSourceId,
    selectedSongId,
    selectedSongs,
    addFiles,
    addDirectory,
    removeSource,
    selectSong,
    toggleSongSelection,
    selectAllSongs,
    clearAll,
  } = useSourceStore();

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

  const toggleAccordion = (id: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const isExpanded = (id: string) => expandedSources[id] !== false;

  return (
    <aside
      ref={dropRef}
      data-drop-target="sidebar"
      className="relative flex h-full w-80 flex-col border-r border-border bg-card/40 select-none overflow-hidden"
    >
      <DropOverlay targetId="sidebar" compact />

      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={handleAddFiles}
            className="justify-center"
          >
            <FilePlus data-icon="inline-start" />
            <span>Add Files</span>
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={handleAddFolder}
            className="justify-center"
          >
            <FolderPlus data-icon="inline-start" />
            <span>Add Folder</span>
          </Button>
        </div>

        {/* Select All Checkbox */}
        {allSongKeys.length > 0 && (
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={(checked) => selectAllSongs(checked === true)}
                aria-label="Select all songs"
              />
              <span>Select All ({selectedSongs.size}/{allSongKeys.length})</span>
            </label>
          </div>
        )}
      </div>

      {/* Source Files List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground p-4">
            <FileText className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-xs">No files added yet</p>
            <p className="text-[11px] opacity-70 mt-1">
              Click Add Files or drag files here
            </p>
          </div>
        ) : (
          sources.map((source) => {
            const open = isExpanded(source.id);
            const songCount = source.library.presentations.length;

            return (
              <div
                key={source.id}
                className="rounded-md border border-border bg-card/60 overflow-hidden"
              >
                {/* File Header Accordion Row */}
                <div className="flex items-center justify-between p-2 hover:bg-accent/40 group">
                  <button
                    type="button"
                    onClick={() => toggleAccordion(source.id)}
                    className="flex flex-1 items-center gap-1.5 min-w-0 text-left"
                  >
                    {open ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="rounded bg-primary/10 px-1 py-0.2 text-[10px] font-mono font-bold text-primary shrink-0 uppercase">
                      .{source.format}
                    </span>
                    <span
                      className="text-xs font-medium text-foreground truncate"
                      title={source.name}
                    >
                      {source.name}
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
                      {songCount}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove source ${source.name}`}
                      onClick={() => removeSource(source.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Sub-list of Songs */}
                {open && (
                  <div className="border-t border-border/50 divide-y divide-border/30 bg-background/50">
                    {source.library.presentations.map((song) => {
                      const songKey = `${source.id}:${song.id}`;
                      const isChecked = selectedSongs.has(songKey);
                      const isCurrent =
                        selectedSourceId === source.id && selectedSongId === song.id;

                      return (
                        <div
                          key={song.id}
                          className={cn(
                            'flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors cursor-pointer hover:bg-accent/60',
                            isCurrent && 'bg-accent font-semibold border-l-2 border-primary'
                          )}
                          onClick={() => selectSong(source.id, song.id)}
                        >
                          <Checkbox
                            aria-label={`Select song ${song.title}`}
                            checked={isChecked}
                            onCheckedChange={() => {
                              toggleSongSelection(source.id, song.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Music className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="flex-1 truncate text-foreground">
                            {song.title || 'Untitled Song'}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {song.slides.length} slides
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
