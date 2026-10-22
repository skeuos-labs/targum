import { useEffect, useRef } from 'react';
import { TopBar } from './components/TopBar';
import { SourcesSidebar } from './components/SourcesSidebar';
import { ReviewWorkspace } from './components/ReviewWorkspace';
import { ExportDrawer } from './components/export/ExportDrawer';
import { BatchProgressModal } from './components/BatchProgressModal';
import { ImportStage } from './components/import/ImportStage';
import { Toast } from './components/Toast';
import { getPlatformAdapter } from './platform';
import { useSourceStore } from './state/sourceStore';
import { useDndStore } from './state/dndStore';
import { useUiStore } from './state/uiStore';

export default function App() {
  const sources = useSourceStore((s) => s.sources);
  const importPaths = useSourceStore((s) => s.importPaths);
  const showToast = useUiStore((s) => s.showToast);
  const prevSourcesLengthRef = useRef(sources.length);

  // Toast only on the 0 -> N crossing (initial import from empty stage).
  // Count presentations (songs), not source files — one file can hold many songs.
  // Also reset the workbench to Content/Structure so re-import after Clear All
  // never lands on a stale Details/Projection segment.
  useEffect(() => {
    const prev = prevSourcesLengthRef.current;
    const next = sources.length;
    if (prev === 0 && next > 0) {
      const songCount = sources.flatMap((s) => s.library.presentations).length;
      showToast(`Imported ${songCount} ${songCount === 1 ? 'song' : 'songs'}`);
      const ui = useUiStore.getState();
      ui.setCenterTab('content');
      ui.setContentSegment('structure');
    }
    prevSourcesLengthRef.current = next;
  }, [sources, showToast]);

  // Native OS drag-drop (Tauri). HTML5 DnD is swallowed by WebView2 when
  // dragDropEnabled is true (default), so this is the only path on desktop.
  useEffect(() => {
    const adapter = getPlatformAdapter();
    if (!adapter.onDragDrop) {
      useDndStore.getState().setMode('html5');
      return;
    }

    useDndStore.getState().setMode('native');

    const unlisten = adapter.onDragDrop((event) => {
      const dnd = useDndStore.getState();
      if (event.type === 'enter') {
        dnd.beginDrag(null);
      } else if (event.type === 'over') {
        if (!dnd.dragging) dnd.beginDrag(null);
        if (event.position) {
          const hit = dnd.hitTest(event.position.x, event.position.y);
          dnd.setTarget(hit);
        }
      } else if (event.type === 'leave') {
        dnd.endDrag();
      } else if (event.type === 'drop') {
        dnd.endDrag();
        if (event.paths && event.paths.length > 0) {
          void importPaths(event.paths, adapter);
        }
      }
    });

    // Clear stuck overlay if the window loses the drag (Esc, alt-tab)
    const onWindowBlur = () => {
      useDndStore.getState().endDrag();
    };
    window.addEventListener('blur', onWindowBlur);

    return () => {
      unlisten();
      window.removeEventListener('blur', onWindowBlur);
      useDndStore.getState().endDrag();
    };
  }, [importPaths]);

  // Global HTML5 cancel: dragend / drop / Esc outside zones must clear overlay
  useEffect(() => {
    const end = () => useDndStore.getState().endDrag();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') end();
    };
    const onLeave = (e: Event) => {
      if ((e as DragEvent).relatedTarget === null) end();
    };
    window.addEventListener('dragend', end);
    window.addEventListener('drop', end);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('dragend', end);
      window.removeEventListener('drop', end);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground select-none overflow-hidden">
      <TopBar />
      {sources.length === 0 ? (
        <ImportStage />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <SourcesSidebar />
          <ReviewWorkspace />
          <ExportDrawer />
        </div>
      )}
      <BatchProgressModal />
      <Toast />
    </div>
  );
}
