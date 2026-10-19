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

    it('renders breadcrumbs, subtitle, OK diagnostics badge, and 5 tab buttons', () => {
      render(<ReviewWorkspace />);

      // Breadcrumbs
      expect(screen.getByText('Amazing Grace.pro')).toBeDefined();
      expect(screen.getAllByText('Amazing Grace').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('PRO')).toBeDefined();

      // OK badge when 0 warnings
      expect(screen.getByText('OK')).toBeDefined();

      // Subtitle line
      expect(screen.getByText(/1 song · 5 sections · 9 slides/i)).toBeDefined();

      // 5 Tabs
      expect(screen.getByRole('tab', { name: /overview/i })).toBeDefined();
      expect(screen.getByRole('tab', { name: /sections/i })).toBeDefined();
      expect(screen.getByRole('tab', { name: /slides/i })).toBeDefined();
      expect(screen.getByRole('tab', { name: /warnings/i })).toBeDefined();
      expect(screen.getByRole('tab', { name: /raw json/i })).toBeDefined();
    });

    it('renders Overview tab with editable inputs, collapsible drawer, metrics strip, and arrangement flow', async () => {
      render(<ReviewWorkspace />);

      // Title Input
      const titleInput = screen.getByDisplayValue('Amazing Grace') as HTMLInputElement;
      expect(titleInput).toBeDefined();

      // Primary Grid: Author, CCLI, Copyright
      const authorInput = screen.getByDisplayValue('John Newton');
      const ccliInput = screen.getByDisplayValue('22025');
      const copyrightInput = screen.getByDisplayValue('Public Domain');
      expect(authorInput).toBeDefined();
      expect(ccliInput).toBeDefined();
      expect(copyrightInput).toBeDefined();

      // Edit metadata and check "Saved ✓" indicator appears
      fireEvent.change(authorInput, { target: { value: 'John Newton (Rev)' } });
      fireEvent.blur(authorInput);
      expect(screen.getByText(/Saved/i)).toBeDefined();

      // Check store updated
      const source = useSourceStore.getState().sources[0]!;
      expect(source.library.presentations[0]!.metadata.author).toBe('John Newton (Rev)');

      // Metrics strip
      expect(screen.getByText('5')).toBeDefined(); // 5 sections
      expect(screen.getByText('9')).toBeDefined(); // 9 slides

      // Collapsible drawer toggle
      const drawerToggle = screen.getByRole('button', { name: /view more metadata/i });
      fireEvent.click(drawerToggle);
      expect(screen.getByLabelText(/language/i)).toBeDefined();
      expect(screen.getByLabelText(/theme name/i)).toBeDefined();
      expect(screen.getByLabelText(/notes/i)).toBeDefined();

      // Arrangement flow (e.g. Standard and Short rows with arrow-separated pills)
      expect(screen.getByText('Standard')).toBeDefined();
      expect(screen.getByText('Short')).toBeDefined();
    });

    it('renders Sections tab with spine layout and copy lyrics button', async () => {
      // Mock navigator.clipboard
      const writeTextSpy = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextSpy },
      });

      render(<ReviewWorkspace />);

      // Switch to Sections tab
      fireEvent.click(screen.getByRole('tab', { name: /sections/i }));

      // Section names in rotated spine
      expect(screen.getAllByText('Verse 1').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Chorus').length).toBeGreaterThanOrEqual(1);

      // Copy lyrics button
      const copyBtn = screen.getByRole('button', { name: /copy lyrics/i });
      expect(copyBtn).toBeDefined();
      fireEvent.click(copyBtn);
      expect(writeTextSpy).toHaveBeenCalled();
      expect(await screen.findByText(/copied!/i)).toBeDefined();
    });

    it('renders Slides tab with 16:9 cards, slide fractions, and consecutive section deduplication', () => {
      render(<ReviewWorkspace />);

      // Switch to Slides tab
      fireEvent.click(screen.getByRole('tab', { name: /slides/i }));

      // 9 Slide Cards with 16:9 badges (1/9 .. 9/9)
      const slideBadges = screen.getAllByText(/^[1-9]\/9$/);
      expect(slideBadges).toHaveLength(9);

      // Verify specific lyrics in slide cards
      expect(screen.getByText(/Amazing grace! How sweet the sound/i)).toBeDefined();
      expect(screen.getByText(/When we've been there ten thousand years/i)).toBeDefined();
    });

    it('renders Warnings tab with clean parse message when 0 warnings, or warning cards when present', () => {
      const { rerender } = render(<ReviewWorkspace />);

      // Switch to Warnings tab
      fireEvent.click(screen.getByRole('tab', { name: /warnings/i }));
      expect(screen.getByText(/no warnings for this file\. clean parse\./i)).toBeDefined();

      // Re-render with a warning
      act(() => {
        useSourceStore.setState({
          sources: [
            {
              id: 'src-ag',
              path: '/test/Amazing Grace.pro',
              name: 'Amazing Grace.pro',
              format: 'pro',
              library: { presentations: [AMAZING_GRACE] },
              warnings: [
                {
                  code: 'PRO_STYLES_NOT_EXTRACTED',
                  severity: 'info',
                  message: 'Text styling was ignored',
                },
              ],
              selectedSongId: AMAZING_GRACE.id,
            },
          ],
        });
      });

      rerender(<ReviewWorkspace />);

      // Clicking amber warning badge in header navigates to Warnings tab
      const warningBadge = screen.getByText(/1 warning/i);
      fireEvent.click(warningBadge);
      expect(screen.getByText(/PRO_STYLES_NOT_EXTRACTED/i)).toBeDefined();
      expect(screen.getByText(/Text styling was ignored/i)).toBeDefined();
    });

    it('renders Raw JSON tab with recursive color-coded tree and copy JSON button', async () => {
      const writeTextSpy = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextSpy },
      });

      render(<ReviewWorkspace />);

      // Switch to Raw JSON tab
      fireEvent.click(screen.getByRole('tab', { name: /raw json/i }));

      // Color-coded keys
      expect(screen.getByText('"title"')).toBeDefined();
      expect(screen.getByText('"sourceFormat"')).toBeDefined();

      // Copy JSON button
      const copyBtn = screen.getByRole('button', { name: /copy json/i });
      fireEvent.click(copyBtn);
      expect(writeTextSpy).toHaveBeenCalled();
      expect(await screen.findByText(/copied!/i)).toBeDefined();
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

    it('disables export button and shows hint when output directory is empty', () => {
      useExportStore.setState({ outputDirectory: '' });

      render(<ExportSidebar />);

      expect(screen.getByText('Select destination folder')).toBeDefined();

      const exportBtn = screen.getByRole('button', { name: /export 1 song/i }) as HTMLButtonElement;
      expect(exportBtn.disabled).toBe(true);
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
