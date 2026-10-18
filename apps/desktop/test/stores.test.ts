// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createAmazingGracePresentation,
  writePro,
  type Presentation,
} from '@show-converter/engine';
import { MockPlatformAdapter, setPlatformAdapter } from '../src/platform';
import { useThemeStore } from '../src/state/themeStore';
import { useSourceStore } from '../src/state/sourceStore';
import { useExportStore } from '../src/state/exportStore';

if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = async function (this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

function toProBytes(pres: Presentation): Uint8Array {
  const res = writePro(pres);
  if (!res.ok) {
    throw res.error;
  }
  return res.bytes;
}

describe('Zustand UI State Stores', () => {
  let mockAdapter: MockPlatformAdapter;

  beforeEach(() => {
    mockAdapter = new MockPlatformAdapter();
    setPlatformAdapter(mockAdapter);

    // Reset stores
    useThemeStore.getState().setTheme('light');
    useSourceStore.getState().clearAll();
    useExportStore.setState({
      targetFormat: 'pro',
      outputDirectory: '/output',
      collisionPolicy: 'rename',
      combineMode: false,
      combineName: '',
      libraryName: '',
      isExporting: false,
      progress: { current: 0, total: 0, message: '' },
      lastSummary: null,
    });
  });

  describe('themeStore', () => {
    let matchMediaListeners: Array<(e: { matches: boolean }) => void> = [];
    let prefersDark = false;

    beforeEach(() => {
      matchMediaListeners = [];
      prefersDark = false;

      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: prefersDark,
        media: query,
        onchange: null,
        addListener: (fn: (e: { matches: boolean }) => void) => matchMediaListeners.push(fn),
        removeListener: () => {},
        addEventListener: (event: string, fn: (e: { matches: boolean }) => void) => {
          if (event === 'change') matchMediaListeners.push(fn);
        },
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }));
    });

    it('sets light and dark themes and updates DOM and localStorage', () => {
      useThemeStore.getState().setTheme('dark');
      expect(useThemeStore.getState().theme).toBe('dark');
      expect(useThemeStore.getState().resolvedTheme).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(localStorage.getItem('show-converter-theme')).toBe('dark');

      useThemeStore.getState().setTheme('light');
      expect(useThemeStore.getState().theme).toBe('light');
      expect(useThemeStore.getState().resolvedTheme).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(localStorage.getItem('show-converter-theme')).toBe('light');
    });

    it('resolves system theme based on matchMedia', () => {
      prefersDark = true;
      useThemeStore.getState().setTheme('system');
      expect(useThemeStore.getState().theme).toBe('system');
      expect(useThemeStore.getState().resolvedTheme).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      prefersDark = false;
      useThemeStore.getState().setTheme('system');
      expect(useThemeStore.getState().resolvedTheme).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('reacts to system color scheme changes when theme is system', () => {
      prefersDark = false;
      useThemeStore.getState().setTheme('system');
      expect(useThemeStore.getState().resolvedTheme).toBe('light');

      // Trigger media query change event
      for (const listener of matchMediaListeners) {
        listener({ matches: true });
      }

      expect(useThemeStore.getState().resolvedTheme).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('sourceStore', () => {
    let sampleProBytes: Uint8Array;
    let samplePres: Presentation;

    beforeEach(async () => {
      samplePres = createAmazingGracePresentation();
      sampleProBytes = toProBytes(samplePres);
      await mockAdapter.writeFile('/data/Amazing Grace.pro', sampleProBytes);
    });

    it('imports single presentation file and checks song into selectedSongs', async () => {
      await useSourceStore.getState().addFiles(['/data/Amazing Grace.pro'], mockAdapter);

      const state = useSourceStore.getState();
      expect(state.sources).toHaveLength(1);
      const source = state.sources[0]!;
      expect(source.name).toBe('Amazing Grace.pro');
      expect(source.format).toBe('pro');
      expect(source.library.presentations).toHaveLength(1);
      expect(source.library.presentations[0]!.title).toBe('Amazing Grace');

      // Defaults selectedSourceId and selectedSongId
      expect(state.selectedSourceId).toBe(source.id);
      expect(state.selectedSongId).toBe(source.library.presentations[0]!.id);

      // Auto-checks all songs
      const compositeKey = `${source.id}:${source.library.presentations[0]!.id}`;
      expect(state.selectedSongs.has(compositeKey)).toBe(true);
    });

    it('imports directories recursively', async () => {
      const pres2: Presentation = {
        ...createAmazingGracePresentation(),
        id: 'pres-2',
        title: 'Song Two',
      };
      const pres2Bytes = toProBytes(pres2);
      await mockAdapter.writeFile('/songs/nested/Song Two.pro', pres2Bytes);

      await useSourceStore.getState().addDirectory('/songs', true, mockAdapter);

      const state = useSourceStore.getState();
      expect(state.sources.length).toBeGreaterThanOrEqual(1);
      const imported = state.sources.find((s) => s.name === 'Song Two.pro');
      expect(imported).toBeDefined();
      expect(imported?.library.presentations[0]!.title).toBe('Song Two');
    });

    it('toggles individual song selection and selects all songs', async () => {
      await useSourceStore.getState().addFiles(['/data/Amazing Grace.pro'], mockAdapter);
      const source = useSourceStore.getState().sources[0]!;
      const songId = source.library.presentations[0]!.id;
      const compositeKey = `${source.id}:${songId}`;

      expect(useSourceStore.getState().selectedSongs.has(compositeKey)).toBe(true);

      // Toggle off
      useSourceStore.getState().toggleSongSelection(source.id, songId);
      expect(useSourceStore.getState().selectedSongs.has(compositeKey)).toBe(false);

      // Toggle back on
      useSourceStore.getState().toggleSongSelection(source.id, songId);
      expect(useSourceStore.getState().selectedSongs.has(compositeKey)).toBe(true);

      // Select all false
      useSourceStore.getState().selectAllSongs(false);
      expect(useSourceStore.getState().selectedSongs.size).toBe(0);

      // Select all true
      useSourceStore.getState().selectAllSongs(true);
      expect(useSourceStore.getState().selectedSongs.has(compositeKey)).toBe(true);
    });

    it('updates song title in-memory', async () => {
      await useSourceStore.getState().addFiles(['/data/Amazing Grace.pro'], mockAdapter);
      const source = useSourceStore.getState().sources[0]!;
      const songId = source.library.presentations[0]!.id;

      useSourceStore.getState().updateSongTitle(source.id, songId, 'Renamed Grace');

      const updated = useSourceStore.getState().sources[0]!;
      expect(updated.library.presentations[0]!.title).toBe('Renamed Grace');
    });

    it('removes source and clears its selected songs', async () => {
      await useSourceStore.getState().addFiles(['/data/Amazing Grace.pro'], mockAdapter);
      const source = useSourceStore.getState().sources[0]!;
      const songId = source.library.presentations[0]!.id;
      const compositeKey = `${source.id}:${songId}`;

      expect(useSourceStore.getState().selectedSongs.has(compositeKey)).toBe(true);

      useSourceStore.getState().removeSource(source.id);

      const state = useSourceStore.getState();
      expect(state.sources).toHaveLength(0);
      expect(state.selectedSongs.has(compositeKey)).toBe(false);
      expect(state.selectedSourceId).toBeUndefined();
      expect(state.selectedSongId).toBeUndefined();
    });
  });

  describe('exportStore', () => {
    beforeEach(async () => {
      const pres = createAmazingGracePresentation();
      const proBytes = toProBytes(pres);
      await mockAdapter.writeFile('/data/Song1.pro', proBytes);
      await useSourceStore.getState().addFiles(['/data/Song1.pro'], mockAdapter);
    });

    it('exports selected songs in individual mode', async () => {
      useExportStore.setState({
        targetFormat: 'pro',
        outputDirectory: '/out',
        collisionPolicy: 'rename',
        combineMode: false,
        libraryName: '',
      });

      const summary = await useExportStore.getState().executeExport(mockAdapter);

      expect(summary.totalSongs).toBe(1);
      expect(summary.successCount).toBe(1);
      expect(summary.failedCount).toBe(0);
      expect(await mockAdapter.exists('/out/Amazing Grace.pro')).toBe(true);
      expect(useExportStore.getState().lastSummary).toBe(summary);
      expect(useExportStore.getState().isExporting).toBe(false);
    });

    it('preserves updated song titles during export', async () => {
      const source = useSourceStore.getState().sources[0]!;
      const songId = source.library.presentations[0]!.id;
      useSourceStore.getState().updateSongTitle(source.id, songId, 'Edited Title');

      useExportStore.setState({
        targetFormat: 'pro',
        outputDirectory: '/out-edited',
        collisionPolicy: 'rename',
        combineMode: false,
        libraryName: '',
      });

      const summary = await useExportStore.getState().executeExport(mockAdapter);

      expect(summary.successCount).toBe(1);
      expect(await mockAdapter.exists('/out-edited/Edited Title.pro')).toBe(true);
    });

    it('handles collision policies during individual export', async () => {
      // Pre-create file
      await mockAdapter.writeFile('/out/Amazing Grace.pro', new Uint8Array([1, 2, 3]));

      // Rename policy
      useExportStore.setState({
        targetFormat: 'pro',
        outputDirectory: '/out',
        collisionPolicy: 'rename',
        combineMode: false,
      });
      const summaryRename = await useExportStore.getState().executeExport(mockAdapter);
      expect(summaryRename.successCount).toBe(1);
      expect(await mockAdapter.exists('/out/Amazing Grace (2).pro')).toBe(true);

      // Skip policy
      useExportStore.setState({
        targetFormat: 'pro',
        outputDirectory: '/out',
        collisionPolicy: 'skip',
        combineMode: false,
      });
      const summarySkip = await useExportStore.getState().executeExport(mockAdapter);
      expect(summarySkip.skippedCount).toBe(1);
      expect(summarySkip.successCount).toBe(0);

      // Overwrite policy
      useExportStore.setState({
        targetFormat: 'pro',
        outputDirectory: '/out',
        collisionPolicy: 'overwrite',
        combineMode: false,
      });
      const summaryOverwrite = await useExportStore.getState().executeExport(mockAdapter);
      expect(summaryOverwrite.successCount).toBe(1);
      const overwritten = await mockAdapter.readFile('/out/Amazing Grace.pro');
      expect(overwritten).not.toEqual(new Uint8Array([1, 2, 3]));
    });

    it('exports multiple songs in combined mode', async () => {
      const pres2: Presentation = {
        ...createAmazingGracePresentation(),
        id: 'pres-2',
        title: 'Song Two',
      };
      await mockAdapter.writeFile('/data/Song2.pro', toProBytes(pres2));
      await useSourceStore.getState().addFiles(['/data/Song2.pro'], mockAdapter);

      useExportStore.setState({
        targetFormat: 'vpc',
        outputDirectory: '/combined-out',
        collisionPolicy: 'rename',
        combineMode: true,
        combineName: 'WorshipSet',
      });

      const summary = await useExportStore.getState().executeExport(mockAdapter);

      expect(summary.totalSongs).toBe(2);
      expect(summary.successCount).toBe(2);
      expect(await mockAdapter.exists('/combined-out/WorshipSet.vpc')).toBe(true);
    });

    it('exports songs in library mode with .proplaylist', async () => {
      useExportStore.setState({
        targetFormat: 'pro',
        outputDirectory: '/libraries',
        collisionPolicy: 'rename',
        combineMode: false,
        libraryName: 'SundayService',
      });

      const summary = await useExportStore.getState().executeExport(mockAdapter);

      expect(summary.totalSongs).toBe(1);
      expect(summary.successCount).toBe(1);
      expect(await mockAdapter.exists('/libraries/SundayService/Amazing Grace.pro')).toBe(true);
      expect(
        await mockAdapter.exists('/libraries/SundayService/SundayService.proplaylist')
      ).toBe(true);
    });

    it('resets combineMode and libraryName when switching away from formats supporting them', () => {
      useExportStore.setState({
        targetFormat: 'vpc',
        combineMode: true,
        libraryName: 'MyLib',
      });

      // Switching to txt should reset combineMode (txt does not support combine) and libraryName
      useExportStore.getState().setTargetFormat('txt');
      expect(useExportStore.getState().targetFormat).toBe('txt');
      expect(useExportStore.getState().combineMode).toBe(false);
      expect(useExportStore.getState().libraryName).toBe('');

      // Setting combineMode on pptx (supported)
      useExportStore.getState().setTargetFormat('pptx');
      useExportStore.getState().setCombineMode(true);
      expect(useExportStore.getState().combineMode).toBe(true);

      // Switching to pro should reset combineMode (pro does not support combine)
      useExportStore.getState().setTargetFormat('pro');
      expect(useExportStore.getState().combineMode).toBe(false);

      // Setting libraryName on pro (supported)
      useExportStore.getState().setLibraryName('SundayPro');
      expect(useExportStore.getState().libraryName).toBe('SundayPro');

      // Switching to vpc should reset libraryName (vpc does not support pro library)
      useExportStore.getState().setTargetFormat('vpc');
      expect(useExportStore.getState().libraryName).toBe('');
    });

    it('clears summary with clearSummary()', () => {
      useExportStore.setState({
        lastSummary: {
          totalFiles: 1,
          totalSongs: 1,
          successCount: 1,
          skippedCount: 0,
          failedCount: 0,
          warningCount: 0,
          items: [],
          durationMs: 10,
        },
      });

      expect(useExportStore.getState().lastSummary).not.toBeNull();
      useExportStore.getState().clearSummary();
      expect(useExportStore.getState().lastSummary).toBeNull();
    });
  });
});
