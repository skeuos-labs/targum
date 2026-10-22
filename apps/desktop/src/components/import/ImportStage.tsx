import { useRef } from 'react';
import { FilePlus, FolderPlus, UploadCloud } from 'lucide-react';
import { useSourceStore } from '../../state/sourceStore';
import { useUiStore } from '../../state/uiStore';
import { useDndStore } from '../../state/dndStore';
import { getPlatformAdapter } from '../../platform';
import { useDropTarget } from '../../lib/useDropTarget';
import { IMPORT_FORMATS_LINE, IMPORT_HEADLINE } from '../../lib/importFormats';
import { DropOverlay } from '../DropOverlay';
import { Button } from '../ui/button';

/** Empty-stage drop screen: pick or drop files when no sources are loaded. */
export function ImportStage() {
  const addFiles = useSourceStore((s) => s.addFiles);
  const importPaths = useSourceStore((s) => s.importPaths);
  const showToast = useUiStore((s) => s.showToast);
  const isDraggingOver = useDndStore((s) => s.dragging && s.target === 'center');
  const adapterRef = useRef(getPlatformAdapter());

  const { ref: dropRef } = useDropTarget({
    id: 'center',
    onDropFiles: async (files) => {
      const count = await addFiles(files, adapterRef.current);
      if (files.length > 0 && count === 0) {
        showToast('No supported songs found');
      }
    },
    onDropPaths: async (paths) => {
      await importPaths(paths, adapterRef.current);
    },
  });

  const handlePickFiles = async () => {
    try {
      const paths = await adapterRef.current.pickFiles();
      if (paths && paths.length > 0) {
        await importPaths(paths, adapterRef.current);
      }
    } catch {
      // Pick cancelled or failed
    }
  };

  const handleAddFolder = async () => {
    try {
      const dir = await adapterRef.current.pickDirectory();
      if (dir) {
        await importPaths([dir], adapterRef.current);
      }
    } catch {
      // Pick cancelled or failed
    }
  };

  return (
    <main
      ref={dropRef}
      data-drop-target="center"
      className={`relative flex flex-1 flex-col items-center justify-center gap-6 bg-background p-10 text-center select-none transition-colors ${
        isDraggingOver ? 'border-2 border-dashed border-primary bg-primary/5' : ''
      }`}
    >
      <DropOverlay
        targetId="center"
        title="Drop files to import"
        subtitle="Release to import songs"
      />

      <div className="flex max-w-xl flex-col items-center gap-2">
        <h1 className="text-lg font-semibold text-foreground">{IMPORT_HEADLINE}</h1>
        <p className="text-xs text-muted-foreground">{IMPORT_FORMATS_LINE}</p>
      </div>

      <button
        type="button"
        onClick={handlePickFiles}
        className="flex w-full max-w-xl cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card/40 px-8 py-12 text-muted-foreground transition-colors hover:border-primary/60 hover:bg-primary/5"
      >
        <UploadCloud className="h-10 w-10 text-primary/70" />
        <span className="text-sm font-medium text-foreground">
          Drop files here or click to browse
        </span>
      </button>

      <div className="flex w-full max-w-xl gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePickFiles}
          className="flex-1 justify-center"
        >
          <FilePlus data-icon="inline-start" />
          <span>Add Files</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddFolder}
          className="flex-1 justify-center"
        >
          <FolderPlus data-icon="inline-start" />
          <span>Add Folder</span>
        </Button>
      </div>
    </main>
  );
}
