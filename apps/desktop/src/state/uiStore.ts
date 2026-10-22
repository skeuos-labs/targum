import { create } from 'zustand';

export type CenterTab = 'content' | 'details';
export type ContentSegment = 'structure' | 'projection';

export interface UiToast {
  id: number;
  message: string;
}

export interface UiStoreState {
  sourcesRailCollapsed: boolean;
  exportDrawerExpanded: boolean;
  centerTab: CenterTab;
  contentSegment: ContentSegment;
  warningsSheetOpen: boolean;
  jsonViewerOpen: boolean;
  toast: UiToast | null;
  setSourcesRailCollapsed(v: boolean): void;
  toggleSourcesRail(): void;
  setExportDrawerExpanded(v: boolean): void;
  setCenterTab(t: CenterTab): void;
  setContentSegment(s: ContentSegment): void;
  setWarningsSheetOpen(v: boolean): void;
  setJsonViewerOpen(v: boolean): void;
  showToast(message: string): void;
  clearToast(id?: number): void;
}

const SOURCES_RAIL_STORAGE_KEY = 'show-converter.sourcesRailCollapsed';

function readSourcesRailCollapsed(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(SOURCES_RAIL_STORAGE_KEY) === '1';
    }
  } catch {
    // localStorage not accessible
  }
  return false;
}

function writeSourcesRailCollapsed(collapsed: boolean): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SOURCES_RAIL_STORAGE_KEY, collapsed ? '1' : '0');
    }
  } catch {
    // localStorage not accessible
  }
}

let nextToastId = 0;

export const useUiStore = create<UiStoreState>((set, get) => ({
  sourcesRailCollapsed: readSourcesRailCollapsed(),
  exportDrawerExpanded: false,
  centerTab: 'content',
  contentSegment: 'structure',
  warningsSheetOpen: false,
  jsonViewerOpen: false,
  toast: null,

  setSourcesRailCollapsed: (v: boolean) => {
    writeSourcesRailCollapsed(v);
    set({ sourcesRailCollapsed: v });
  },

  toggleSourcesRail: () => {
    get().setSourcesRailCollapsed(!get().sourcesRailCollapsed);
  },

  setExportDrawerExpanded: (v: boolean) => {
    set({ exportDrawerExpanded: v });
  },

  setCenterTab: (t: CenterTab) => {
    set({ centerTab: t });
  },

  setContentSegment: (s: ContentSegment) => {
    set({ contentSegment: s });
  },

  setWarningsSheetOpen: (v: boolean) => {
    set({ warningsSheetOpen: v });
  },

  setJsonViewerOpen: (v: boolean) => {
    set({ jsonViewerOpen: v });
  },

  showToast: (message: string) => {
    nextToastId += 1;
    set({ toast: { id: nextToastId, message } });
  },

  clearToast: (id?: number) => {
    const current = get().toast;
    if (!current) {
      return;
    }
    if (id === undefined || current.id === id) {
      set({ toast: null });
    }
  },
}));
