import { useCallback, useEffect, useRef, useState } from 'react';
import { useDndStore, type DropTargetId } from '../state/dndStore';

export interface UseDropTargetOptions {
  id: DropTargetId;
  /** HTML5 drop (web). Called with File objects from dataTransfer. */
  onDropFiles?: (files: File[]) => void | Promise<void>;
  /** Path-based drop (Tauri HTML5 File.path, or injected). Prefer when non-empty. */
  onDropPaths?: (paths: string[]) => void | Promise<void>;
}

function pathsFromDataTransfer(dt: DataTransfer | null): string[] {
  if (!dt) return [];
  const paths: string[] = [];
  for (let i = 0; i < dt.files.length; i++) {
    const f = dt.files[i] as File & { path?: string };
    if (f.path) paths.push(f.path);
  }
  return paths;
}

/**
 * HTML5 drop-zone: enter/leave depth counter, shared exclusive target,
 * rects refreshed on dragenter for native hit-testing.
 *
 * Uses state-backed ref so listeners rebind when the host remounts
 * (e.g. ReviewWorkspace empty ↔ content early-return swap).
 */
export function useDropTarget({ id, onDropFiles, onDropPaths }: UseDropTargetOptions) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const depth = useRef(0);
  const handlersRef = useRef({ onDropFiles, onDropPaths });
  handlersRef.current = { onDropFiles, onDropPaths };

  const registerTarget = useDndStore((s) => s.registerTarget);

  useEffect(() => {
    const el = node;
    if (!el) return;

    const refreshRect = () => {
      const r = el.getBoundingClientRect();
      registerTarget(id, {
        rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
        pathsFor: () => [],
        filesFor: () => [],
      });
    };

    const inside = (e: DragEvent) => {
      const related = e.relatedTarget as Node | null;
      if (!related) return false;
      return related === el || el.contains(related);
    };

    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      e.stopPropagation();
      depth.current++;
      if (depth.current === 1) {
        refreshRect();
        useDndStore.getState().beginDrag(id);
      }
    };

    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      e.stopPropagation();
      if (useDndStore.getState().target !== id) {
        depth.current = Math.max(depth.current, 1);
        useDndStore.getState().setTarget(id);
      }
    };

    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (inside(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) {
        const st = useDndStore.getState();
        if (st.target === id) {
          st.endDrag();
        }
      }
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      depth.current = 0;
      const files = e.dataTransfer ? Array.from(e.dataTransfer.files) : [];
      const paths = pathsFromDataTransfer(e.dataTransfer);
      useDndStore.getState().endDrag();

      const { onDropFiles: fh, onDropPaths: ph } = handlersRef.current;
      if (paths.length > 0 && ph) {
        void ph(paths);
        return;
      }
      if (files.length > 0 && fh) {
        void fh(files);
      }
    };

    el.addEventListener('dragenter', onDragEnter);
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    refreshRect();

    return () => {
      el.removeEventListener('dragenter', onDragEnter);
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
      registerTarget(id, null);
    };
  }, [id, node, registerTarget]);

  const setRef = useCallback((n: HTMLElement | null) => {
    setNode(n);
  }, []);

  return { ref: setRef };
}
