// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import {
  AMAZING_GRACE,
  writePro,
  type Presentation,
} from '@show-converter/engine';
import { MockPlatformAdapter, setPlatformAdapter } from '../src/platform';
import { useThemeStore } from '../src/state/themeStore';
import { useSourceStore } from '../src/state/sourceStore';
import { useExportStore } from '../src/state/exportStore';
import { TopBar } from '../src/components/TopBar';
import { StatusBar } from '../src/components/StatusBar';
import { SourcesSidebar } from '../src/components/SourcesSidebar';
import { ReviewWorkspace } from '../src/components/ReviewWorkspace';
import { ExportSidebar } from '../src/components/ExportSidebar';
import { BatchProgressModal } from '../src/components/BatchProgressModal';
import App from '../src/App';

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

describe('Core Desktop UI Components', () => {
  let mockAdapter: MockPlatformAdapter;

  beforeEach(() => {
    mockAdapter = new MockPlatformAdapter();
    setPlatformAdapter(mockAdapter);

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

  afterEach(() => {
    cleanup();
  });

  describe('Empty state', () => {
    it('renders empty workspace when no presentation is loaded', () => {
      render(<ReviewWorkspace />);
      expect(
        screen.getByText('Drop presentation files to get started')
      ).toBeDefined();
    });

    it('renders status bar with zero counts in empty state', () => {
      render(<StatusBar />);
      expect(screen.getByText(/0 files/i)).toBeDefined();
      expect(screen.getByText(/0 songs/i)).toBeDefined();
      expect(screen.getByText(/ready/i)).toBeDefined();
    });
  });

  describe('ReviewWorkspace with AMAZING_GRACE', () => {
    beforeEach(() => {
      useSourceStore.setState({
        sources: [
          {
            id: 'src-ag',
            path: '/test/Amazing Grace.pro',
            name: 'Amazing Grace.pro',
            format: 'pro',
            library: { presentations: [AMAZING_GRACE] },
            warnings: [],
            selectedSongId: AMAZING_GRACE.id,
          },
        ],
        selectedSourceId: 'src-ag',
        selectedSongId: AMAZING_GRACE.id,
        selectedSongs: new Set([`src-ag:${AMAZING_GRACE.id}`]),
      });
    });

    it('renders song title, metadata, section chips, and 9 slide cards with lyrics', () => {
      render(<ReviewWorkspace />);

      // Editable Title Input
      const titleInput = screen.getByDisplayValue('Amazing Grace') as HTMLInputElement;
      expect(titleInput).toBeDefined();

      // Metadata
      expect(screen.getByText(/John Newton/i)).toBeDefined();
      expect(screen.getByText(/22025/i)).toBeDefined();
      expect(screen.getByText(/Public Domain/i)).toBeDefined();

      // Section Chips
      expect(screen.getAllByText('Verse 1').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Verse 2').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Chorus').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Verse 3').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Verse 4').length).toBeGreaterThanOrEqual(1);

      // 9 Slide Cards with 16:9 badges
      const slideBadges = screen.getAllByText(/^[1-9]\/9$/);
      expect(slideBadges).toHaveLength(9);

      // Verify specific lyrics in slide cards
      expect(
        screen.getByText(/Amazing grace! How sweet the sound/i)
      ).toBeDefined();
      expect(
        screen.getByText(/When we've been there ten thousand years/i)
      ).toBeDefined();
    });

    it('updates song title when user edits title input', () => {
      render(<ReviewWorkspace />);
      const titleInput = screen.getByDisplayValue('Amazing Grace');
      fireEvent.change(titleInput, { target: { value: 'Amazing Grace (Custom)' } });

      const currentSource = useSourceStore.getState().sources[0]!;
      expect(currentSource.library.presentations[0]!.title).toBe(
        'Amazing Grace (Custom)'
      );
    });
  });

  describe('TopBar', () => {
    it('renders drag region, brand, version, theme toggle, and window controls', async () => {
      const minSpy = vi.spyOn(mockAdapter.window, 'minimize');
      const maxSpy = vi.spyOn(mockAdapter.window, 'toggleMaximize');
      const closeSpy = vi.spyOn(mockAdapter.window, 'close');

      const { container } = render(<TopBar />);

      expect(container.querySelector('[data-tauri-drag-region]')).toBeDefined();
      expect(screen.getByText('Show Converter')).toBeDefined();

      // Theme toggle
      const themeSelect = screen.getByRole('combobox', { name: /theme/i });
      fireEvent.change(themeSelect, { target: { value: 'dark' } });
      expect(useThemeStore.getState().theme).toBe('dark');

      // Window controls
      const minBtn = screen.getByRole('button', { name: /minimize/i });
      const maxBtn = screen.getByRole('button', { name: /maximize/i });
      const closeBtn = screen.getByRole('button', { name: /close/i });

      fireEvent.click(minBtn);
      expect(minSpy).toHaveBeenCalled();

      fireEvent.click(maxBtn);
      expect(maxSpy).toHaveBeenCalled();

      fireEvent.click(closeBtn);
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('SourcesSidebar', () => {
    beforeEach(async () => {
      const bytes = toProBytes(AMAZING_GRACE);
      await mockAdapter.writeFile('/test/Amazing Grace.pro', bytes);
      await useSourceStore.getState().addFiles(['/test/Amazing Grace.pro'], mockAdapter);
    });

    it('toggles song selection and displays source details', () => {
      render(<SourcesSidebar />);

      expect(screen.getByText('Amazing Grace.pro')).toBeDefined();
      expect(screen.getByText('Amazing Grace')).toBeDefined();

      const songCheckbox = screen.getByRole('checkbox', { name: /select song Amazing Grace/i });
      expect(songCheckbox).toBeDefined();
      expect((songCheckbox as HTMLInputElement).checked).toBe(true);

      fireEvent.click(songCheckbox);
      expect((songCheckbox as HTMLInputElement).checked).toBe(false);

      const source = useSourceStore.getState().sources[0]!;
      const key = `${source.id}:${source.library.presentations[0]!.id}`;
      expect(useSourceStore.getState().selectedSongs.has(key)).toBe(false);
    });

    it('triggers add files, add folder, and clear all actions', async () => {
      const pickFilesSpy = vi.spyOn(mockAdapter, 'pickFiles').mockResolvedValue(null);
      const pickDirSpy = vi.spyOn(mockAdapter, 'pickDirectory').mockResolvedValue(null);

      render(<SourcesSidebar />);

      const addFilesBtn = screen.getByRole('button', { name: /add files/i });
      const addFolderBtn = screen.getByRole('button', { name: /add folder/i });
      const clearBtn = screen.getByRole('button', { name: /clear all/i });

      fireEvent.click(addFilesBtn);
      expect(pickFilesSpy).toHaveBeenCalled();

      fireEvent.click(addFolderBtn);
      expect(pickDirSpy).toHaveBeenCalled();

      fireEvent.click(clearBtn);
      expect(useSourceStore.getState().sources).toHaveLength(0);
    });
  });

  describe('ExportSidebar', () => {
    beforeEach(async () => {
      const bytes = toProBytes(AMAZING_GRACE);
      await mockAdapter.writeFile('/test/Amazing Grace.pro', bytes);
      await useSourceStore.getState().addFiles(['/test/Amazing Grace.pro'], mockAdapter);
    });

    it('selects target format, sets collision policy, and triggers export', async () => {
      render(<ExportSidebar />);

      // Target format selector
      const vpcBtn = screen.getByRole('button', { name: /videopsalm/i });
      fireEvent.click(vpcBtn);
      expect(useExportStore.getState().targetFormat).toBe('vpc');

      // Collision policy
      const collisionSelect = screen.getByRole('combobox', { name: /collision policy/i });
      fireEvent.change(collisionSelect, { target: { value: 'overwrite' } });
      expect(useExportStore.getState().collisionPolicy).toBe('overwrite');

      // Export button shows song count
      const exportBtn = screen.getByRole('button', { name: /export 1 song/i });
      expect(exportBtn).toBeDefined();

      await act(async () => {
        fireEvent.click(exportBtn);
      });
    });
  });

  describe('BatchProgressModal', () => {
    it('renders progress bar and status while exporting', () => {
      useExportStore.setState({
        isExporting: true,
        progress: { current: 1, total: 3, message: 'Converting Amazing Grace...' },
        lastSummary: null,
      });

      render(<BatchProgressModal />);

      expect(screen.getByText('Exporting Presentations...')).toBeDefined();
      expect(screen.getByText('Converting Amazing Grace...')).toBeDefined();
      expect(screen.getByText('1 / 3')).toBeDefined();
    });

    it('renders summary statistics and open folder button when export finishes', () => {
      const openSpy = vi.spyOn(mockAdapter, 'openPath');

      useExportStore.setState({
        isExporting: false,
        outputDirectory: '/output/folder',
        lastSummary: {
          totalFiles: 1,
          totalSongs: 2,
          successCount: 2,
          skippedCount: 0,
          failedCount: 0,
          warningCount: 0,
          items: [],
          durationMs: 120,
        },
      });

      render(<BatchProgressModal />);

      expect(screen.getByText('Export Complete')).toBeDefined();
      expect(screen.getByText(/2 succeeded/i)).toBeDefined();

      const openBtn = screen.getByRole('button', { name: /open output folder/i });
      fireEvent.click(openBtn);
      expect(openSpy).toHaveBeenCalledWith('/output/folder');

      const closeBtn = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeBtn);
      expect(useExportStore.getState().lastSummary).toBeNull();
    });
  });

  describe('App Shell Layout', () => {
    it('renders full 3-column workspace with TopBar and StatusBar', async () => {
      render(<App />);

      expect(screen.getByText('Show Converter')).toBeDefined();
      expect(screen.getByRole('heading', { name: /sources/i })).toBeDefined();
      expect(screen.getByText('Drop presentation files to get started')).toBeDefined();
      expect(screen.getByRole('heading', { name: /export/i })).toBeDefined();
      expect(screen.getByText(/ready/i)).toBeDefined();
    });
  });
});
