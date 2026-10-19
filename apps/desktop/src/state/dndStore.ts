import { create } from 'zustand';

/** Absolute viewport region (CSS px) for a drop target. */
export interface DropZoneRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type DropTargetId = 'sidebar' | 'center' | 'export';

type DropTargetEntry = { rect: DropZoneRect; pathsFor: () => string[]; filesFor: () => File[] };

export type DndMode = 'html5' | 'native';

interface DndState {
  /** Which drop-zone system is active this session. */
  mode: DndMode;
  /** True while a drag is over an app drop zone. */
  dragging: boolean;
  /** Which zone should show the active overlay (mutually exclusive). */
  target: DropTargetId | null;
  targets: Record<DropTargetId, DropTargetEntry | null>;
  setMode(mode: DndMode): void;
  registerTarget(id: DropTargetId, entry: DropTargetEntry | null): void;
  beginDrag(target?: DropTargetId | null): void;
  setTarget(target: DropTargetId | null): void;
  /** Clear drag UI. Safe to call on leave, drop, dragend, or Esc. */
  endDrag(): void;
  /** Resolve drop target from viewport point (native events + hit-test). */
  hitTest(x: number, y: number): DropTargetId | null;
  /** Non-empty paths from a zone, if any (native / path-capable). */
  pathsFor(id: DropTargetId): string[];
  /** HTML5 File objects from a zone. */
  filesFor(id: DropTargetId): File[];
}

export const useDndStore = create<DndState>((set, get) => ({
  mode: 'html5',
  dragging: false,
  target: null,
  targets: { sidebar: null, center: null, export: null },

  setMode: (mode) => {
    set({ mode });
  },

  registerTarget: (id, entry) => {
    set((s) => ({ targets: { ...s.targets, [id]: entry } }));
  },

  beginDrag: (target = null) => {
    set({ dragging: true, target });
  },

  setTarget: (target) => {
    set({ dragging: true, target });
  },

  endDrag: () => {
    if (!get().dragging && get().target === null) {
      return;
    }
    set({ dragging: false, target: null });
  },

  hitTest: (x, y) => {
    const { targets } = get();
    // Prefer center (largest) when rects overlap at borders
    const order: DropTargetId[] = ['center', 'sidebar', 'export'];
    for (const id of order) {
      const entry = targets[id];
      if (!entry) continue;
      const { left, top, right, bottom } = entry.rect;
      if (x >= left && x <= right && y >= top && y <= bottom) {
        return id;
      }
    }
    return null;
  },

  pathsFor: (id) => get().targets[id]?.pathsFor() ?? [],
  filesFor: (id) => get().targets[id]?.filesFor() ?? [],
}));
