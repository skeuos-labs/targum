import { create } from 'zustand';
import {
  importFile,
  detectFormat,
  FORMAT_REGISTRY,
  type FormatId,
  type Library,
  type Metadata,
  type Warning,
} from '@show-converter/engine';
import { getPlatformAdapter, type PlatformAdapter } from '../platform';

export interface SourceFile {
  id: string;
  path: string;
  name: string;
  format: FormatId;
  library: Library;
  warnings: Warning[];
  selectedSongId?: string;
}

export type SourceInput = string | File;

export interface SourceStoreState {
  sources: SourceFile[];
  selectedSourceId?: string;
  selectedSongId?: string;
  selectedSongs: Set<string>; // composite "sourceId:songId"
  addFiles(inputs: SourceInput[], adapter?: PlatformAdapter): Promise<void>;
  addDirectory(dirPath: string, recursive?: boolean, adapter?: PlatformAdapter): Promise<void>;
  removeSource(id: string): void;
  selectSong(sourceId: string, songId: string): void;
  toggleSongSelection(sourceId: string, songId: string): void;
  selectAllSongs(selected: boolean): void;
  updateSongTitle(sourceId: string, songId: string, newTitle: string): void;
  updateSongMetadata(sourceId: string, songId: string, patch: Partial<Metadata>): void;
  clearAll(): void;
}

const SUPPORTED_IMPORT_EXTENSIONS = new Set(
  FORMAT_REGISTRY.filter((f) => f.canImport).flatMap((f) =>
    f.extensions.map((ext) => ext.toLowerCase())
  )
);

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `src-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Read a browser File/Blob to bytes. Prefer arrayBuffer; fall back to FileReader (jsdom/older). */
async function readBrowserFile(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(new Uint8Array(reader.result as ArrayBuffer));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read file'));
    };
    reader.readAsArrayBuffer(file);
  });
}

export const useSourceStore = create<SourceStoreState>((set, get) => ({
  sources: [],
  selectedSourceId: undefined,
  selectedSongId: undefined,
  selectedSongs: new Set<string>(),

  addFiles: async (inputs: SourceInput[], adapter?: PlatformAdapter): Promise<void> => {
    const activeAdapter = adapter ?? getPlatformAdapter();
    const newSources: SourceFile[] = [];
    const newSelectedSongs = new Set<string>(get().selectedSongs);

    for (const input of inputs) {
      try {
        let bytes: Uint8Array;
        let fileName: string;
        let filePath: string;

        if (typeof input === 'string') {
          filePath = input;
          fileName = filePath.split(/[/\\]/).pop() || filePath;
          bytes = await activeAdapter.readFile(filePath);
        } else {
          const file = input;
          fileName = file.name;
          filePath = (file as unknown as { path?: string }).path || file.name;
          bytes = await readBrowserFile(file);

          if (typeof (activeAdapter as unknown as { writeFile?: (p: string, b: Uint8Array) => Promise<void> }).writeFile === 'function') {
            try {
              const mockPath = filePath.startsWith('/') ? filePath : '/' + filePath;
              await activeAdapter.writeFile(mockPath, bytes);
            } catch {
              // ignore mock write error
            }
          }
        }

        const imported = await importFile(bytes, fileName);

        if (!imported.ok) {
          continue;
        }

        const detected = detectFormat(fileName, bytes);
        const formatId = (detected ?? 'pro') as FormatId;
        const sourceId = generateId();
        const firstSongId = imported.value.presentations[0]?.id;

        const sourceFile: SourceFile = {
          id: sourceId,
          path: filePath,
          name: fileName,
          format: formatId,
          library: imported.value,
          warnings: imported.warnings ?? [],
          selectedSongId: firstSongId,
        };

        newSources.push(sourceFile);

        for (const pres of imported.value.presentations) {
          newSelectedSongs.add(`${sourceId}:${pres.id}`);
        }
      } catch {
        // Skip unreadable files
      }
    }

    if (newSources.length === 0) {
      return;
    }

    const currentSources = get().sources;
    const combinedSources = [...currentSources, ...newSources];

    const currentSelectedSourceId = get().selectedSourceId;
    const currentSelectedSongId = get().selectedSongId;

    let nextSelectedSourceId = currentSelectedSourceId;
    let nextSelectedSongId = currentSelectedSongId;

    if (!nextSelectedSourceId && combinedSources.length > 0) {
      nextSelectedSourceId = combinedSources[0]?.id;
      nextSelectedSongId = combinedSources[0]?.library.presentations[0]?.id;
    }

    set({
      sources: combinedSources,
      selectedSongs: newSelectedSongs,
      selectedSourceId: nextSelectedSourceId,
      selectedSongId: nextSelectedSongId,
    });
  },

  addDirectory: async (
    dirPath: string,
    recursive = false,
    adapter?: PlatformAdapter
  ): Promise<void> => {
    const activeAdapter = adapter ?? getPlatformAdapter();
    const entries = await activeAdapter.readDir(dirPath, { recursive });

    const matchingFiles = entries.filter((entryPath) => {
      const parts = entryPath.split(/[/\\]/);
      const filename = parts.pop() || '';
      const dotIndex = filename.lastIndexOf('.');
      if (dotIndex === -1) return false;
      const ext = filename.slice(dotIndex).toLowerCase();
      return SUPPORTED_IMPORT_EXTENSIONS.has(ext);
    });

    if (matchingFiles.length > 0) {
      await get().addFiles(matchingFiles, activeAdapter);
    }
  },

  removeSource: (id: string): void => {
    const { sources, selectedSongs, selectedSourceId } = get();
    const remainingSources = sources.filter((s) => s.id !== id);

    const updatedSelectedSongs = new Set<string>();
    for (const key of selectedSongs) {
      if (!key.startsWith(`${id}:`)) {
        updatedSelectedSongs.add(key);
      }
    }

    let nextSelectedSourceId: string | undefined = selectedSourceId;
    let nextSelectedSongId: string | undefined = get().selectedSongId;

    if (selectedSourceId === id) {
      const first = remainingSources[0];
      nextSelectedSourceId = first?.id;
      nextSelectedSongId = first?.selectedSongId ?? first?.library.presentations[0]?.id;
    }

    set({
      sources: remainingSources,
      selectedSongs: updatedSelectedSongs,
      selectedSourceId: nextSelectedSourceId,
      selectedSongId: nextSelectedSongId,
    });
  },

  selectSong: (sourceId: string, songId: string): void => {
    const { sources } = get();
    const updatedSources = sources.map((s) => {
      if (s.id === sourceId) {
        return { ...s, selectedSongId: songId };
      }
      return s;
    });

    set({
      sources: updatedSources,
      selectedSourceId: sourceId,
      selectedSongId: songId,
    });
  },

  toggleSongSelection: (sourceId: string, songId: string): void => {
    const { selectedSongs } = get();
    const key = `${sourceId}:${songId}`;
    const nextSelected = new Set(selectedSongs);

    if (nextSelected.has(key)) {
      nextSelected.delete(key);
    } else {
      nextSelected.add(key);
    }

    set({ selectedSongs: nextSelected });
  },

  selectAllSongs: (selected: boolean): void => {
    const { sources } = get();
    if (!selected) {
      set({ selectedSongs: new Set<string>() });
      return;
    }

    const nextSelected = new Set<string>();
    for (const source of sources) {
      for (const pres of source.library.presentations) {
        nextSelected.add(`${source.id}:${pres.id}`);
      }
    }

    set({ selectedSongs: nextSelected });
  },

  updateSongTitle: (sourceId: string, songId: string, newTitle: string): void => {
    const { sources } = get();
    const updatedSources = sources.map((source) => {
      if (source.id !== sourceId) {
        return source;
      }
      const updatedPresentations = source.library.presentations.map((pres) => {
        if (pres.id === songId) {
          return { ...pres, title: newTitle };
        }
        return pres;
      });
      return {
        ...source,
        library: {
          ...source.library,
          presentations: updatedPresentations,
        },
      };
    });

    set({ sources: updatedSources });
  },

  updateSongMetadata: (
    sourceId: string,
    songId: string,
    patch: Partial<Metadata>
  ): void => {
    const { sources } = get();
    const updatedSources = sources.map((source) => {
      if (source.id !== sourceId) {
        return source;
      }
      const updatedPresentations = source.library.presentations.map((pres) => {
        if (pres.id === songId) {
          return {
            ...pres,
            metadata: {
              ...pres.metadata,
              ...patch,
            },
          };
        }
        return pres;
      });
      return {
        ...source,
        library: {
          ...source.library,
          presentations: updatedPresentations,
        },
      };
    });

    set({ sources: updatedSources });
  },

  clearAll: (): void => {
    set({
      sources: [],
      selectedSourceId: undefined,
      selectedSongId: undefined,
      selectedSongs: new Set<string>(),
    });
  },
}));
