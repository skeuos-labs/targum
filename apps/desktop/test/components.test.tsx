// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';

// jsdom lacks PointerEvent; Base UI dispatches it on checkbox/select clicks.
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? 'mouse';
      this.isPrimary = params.isPrimary ?? true;
    }
  }
  (window as unknown as { PointerEvent: typeof PointerEventPolyfill }).PointerEvent =
    PointerEventPolyfill;
}
import {
  AMAZING_GRACE,
  writePro,
  type Presentation,
} from '@show-converter/engine';
import { MockPlatformAdapter, setPlatformAdapter } from '../src/platform';
import { useThemeStore } from '../src/state/themeStore';
import { useSourceStore } from '../src/state/sourceStore';
import { useUiStore } from '../src/state/uiStore';
import { useExportStore } from '../src/state/exportStore';
import { TopBar } from '../src/components/TopBar';
import { SourcesSidebar } from '../src/components/SourcesSidebar';
import { ReviewWorkspace } from '../src/components/ReviewWorkspace';
import { ExportDrawer } from '../src/components/export/ExportDrawer';
import { BatchProgressModal } from '../src/components/BatchProgressModal';
import App from '../src/App';

if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = async function (this: Blob): Promise<ArrayBuffer> {
    // Prefer synchronous path when possible (jsdom File/Blob)
    const anyThis = this as unknown as { size?: number };
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
      reader.readAsArrayBuffer(this as Blob);
      void anyThis;
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

/** Open a Base UI Select trigger and click the option with the given accessible name. */
async function selectOption(triggerName: RegExp, optionName: string | RegExp): Promise<void> {
  const trigger = screen.getByRole('combobox', { name: triggerName });
  fireEvent.click(trigger);
  const option = await screen.findByRole('option', { name: optionName });
  fireEvent.pointerDown(option);
  fireEvent.click(option);
}

describe('Core Desktop UI Components', () => {
  let mockAdapter: MockPlatformAdapter;

  beforeEach(() => {
    mockAdapter = new MockPlatformAdapter();
    setPlatformAdapter(mockAdapter);

    useThemeStore.getState().setTheme('light');
    useSourceStore.getState().clearAll();
    useUiStore.getState().setSourcesRailCollapsed(false);
    useUiStore.setState({
      centerTab: 'content',
      contentSegment: 'structure',
      warningsSheetOpen: false,
      jsonViewerOpen: false,
      toast: null,
      exportDrawerExpanded: false,
    });
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
      expect(screen.getByText('Drop songs to convert')).toBeDefined();
    });

    it('handles dropping File objects onto empty ReviewWorkspace', async () => {
      const bytes = toProBytes(AMAZING_GRACE);
      const droppedFile = new File([bytes as unknown as BlobPart], 'Dropped.pro', { type: 'application/octet-stream' });

      render(<ReviewWorkspace />);
      const mainEl = screen.getByRole('main');

      // Drag enter -> shows overlay without flicker
      fireEvent.dragEnter(mainEl, { dataTransfer: { files: [droppedFile] } });
      expect(screen.getByText('Drop files to import')).toBeDefined();

      // Drop file
      await act(async () => {
        fireEvent.drop(mainEl, { dataTransfer: { files: [droppedFile] } });
      });

      // Assert song loaded in store (File.arrayBuffer / FileReader may be async)
      await waitFor(() => {
        expect(useSourceStore.getState().sources).toHaveLength(1);
      });
      expect(useSourceStore.getState().sources[0]!.name).toBe('Dropped.pro');
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

    it('renders breadcrumbs, subtitle, OK diagnostics badge, and Content|Details tabs', () => {
      render(<ReviewWorkspace />);

      // Breadcrumbs (Content header)
      expect(screen.getByText('Amazing Grace.pro')).toBeDefined();
      expect(screen.getAllByText('Amazing Grace').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('PRO')).toBeDefined();

      // OK badge when 0 warnings
      expect(screen.getByText('OK')).toBeDefined();

      // Subtitle line
      expect(screen.getByText(/1 song · 5 sections · 9 slides/i)).toBeDefined();

      // Content | Details | overflow
      expect(screen.getByRole('tab', { name: /content/i })).toBeDefined();
      expect(screen.getByRole('tab', { name: /details/i })).toBeDefined();
      expect(screen.getByRole('button', { name: 'More' })).toBeDefined();
      expect(screen.queryByRole('tab', { name: /overview/i })).toBeNull();
      expect(screen.queryByRole('tab', { name: /sections/i })).toBeNull();
      expect(screen.queryByRole('tab', { name: /slides/i })).toBeNull();
      expect(screen.queryByRole('tab', { name: /warnings/i })).toBeNull();
      expect(screen.queryByRole('tab', { name: /raw json/i })).toBeNull();
    });

    it('renders Details tab with editable inputs, collapsible drawer, metrics strip, and arrangement flow', async () => {
      render(<ReviewWorkspace />);

      fireEvent.click(screen.getByRole('tab', { name: /details/i }));

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

    it('renders Structure spine by default and Copy lyrics in header', async () => {
      // Mock navigator.clipboard
      const writeTextSpy = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextSpy },
      });

      render(<ReviewWorkspace />);

      // Section names in rotated spine (Structure segment, default)
      expect(screen.getAllByText('Verse 1').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Chorus').length).toBeGreaterThanOrEqual(1);

      // Copy lyrics button (header owns it; visible in both segments)
      const copyBtn = screen.getByRole('button', { name: /copy lyrics/i });
      expect(copyBtn).toBeDefined();
      fireEvent.click(copyBtn);
      expect(writeTextSpy).toHaveBeenCalled();
      expect(await screen.findByText(/copied!/i)).toBeDefined();
    });

    it('renders Projection segment with 16:9 cards, slide fractions, and consecutive section deduplication', () => {
      render(<ReviewWorkspace />);

      // Switch segment to Projection
      fireEvent.click(screen.getByRole('button', { name: /^projection$/i }));

      // 9 Slide Cards with 16:9 badges (1/9 .. 9/9)
      const slideBadges = screen.getAllByText(/^[1-9]\/9$/);
      expect(slideBadges).toHaveLength(9);

      // Verify specific lyrics in slide cards
      expect(screen.getByText(/Amazing grace! How sweet the sound/i)).toBeDefined();
      expect(screen.getByText(/When we've been there ten thousand years/i)).toBeDefined();

      // Copy lyrics still present in Projection segment
      expect(screen.getByRole('button', { name: /copy lyrics/i })).toBeDefined();
    });

    it('opens WarningsSheet with clean parse message when 0 warnings, or warning cards when present', () => {
      const { rerender } = render(<ReviewWorkspace />);

      // Overflow → Full diagnostics (empty)
      fireEvent.click(screen.getByRole('button', { name: 'More' }));
      fireEvent.click(screen.getByRole('menuitem', { name: /full diagnostics/i }));
      expect(screen.getByText(/no warnings/i)).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: /close/i }));

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

      // Clicking warning chip in header opens WarningsSheet
      const warningBadge = screen.getByRole('button', { name: /1 info/i });
      fireEvent.click(warningBadge);
      expect(screen.getByText(/PRO_STYLES_NOT_EXTRACTED/i)).toBeDefined();
      expect(screen.getByText(/Text styling was ignored/i)).toBeDefined();
    });

    it('opens Raw JSON viewer via overflow with recursive color-coded tree and copy JSON', async () => {
      const writeTextSpy = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextSpy },
      });

      render(<ReviewWorkspace />);

      // Overflow → Raw JSON AST
      fireEvent.click(screen.getByRole('button', { name: 'More' }));
      fireEvent.click(screen.getByRole('menuitem', { name: /raw json ast/i }));

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

      // Theme toggle (Base UI Select: open + pick option)
      await selectOption(/theme/i, 'Dark');
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

    it('shows Sources (N) chip when rail collapsed with sources loaded; click expands rail', () => {
      useSourceStore.setState({
        sources: ['src-1', 'src-2', 'src-3'].map((id, i) => ({
          id,
          path: `/test/Song ${i}.pro`,
          name: `Song ${i}.pro`,
          format: 'pro' as const,
          library: { presentations: [AMAZING_GRACE] },
          warnings: [],
          selectedSongId: AMAZING_GRACE.id,
        })),
      });
      act(() => {
        useUiStore.getState().setSourcesRailCollapsed(true);
      });

      render(<TopBar />);

      const chip = screen.getByRole('button', { name: 'Sources (3)' });
      fireEvent.click(chip);
      expect(useUiStore.getState().sourcesRailCollapsed).toBe(false);
    });

    it('hides Sources chip when rail is expanded', () => {
      useSourceStore.setState({
        sources: [
          {
            id: 'src-1',
            path: '/test/Amazing Grace.pro',
            name: 'Amazing Grace.pro',
            format: 'pro',
            library: { presentations: [AMAZING_GRACE] },
            warnings: [],
            selectedSongId: AMAZING_GRACE.id,
          },
        ],
      });
      act(() => {
        useUiStore.getState().setSourcesRailCollapsed(false);
      });

      render(<TopBar />);

      expect(screen.queryByRole('button', { name: /^Sources \(/ })).toBeNull();
    });

    it('never shows Sources chip on Import stage even when rail collapsed', () => {
      useSourceStore.setState({ sources: [] });
      act(() => {
        useUiStore.getState().setSourcesRailCollapsed(true);
      });

      render(<TopBar />);

      expect(screen.queryByRole('button', { name: /^Sources \(/ })).toBeNull();
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
      // Base UI Checkbox: state exposed on the control via aria-checked
      expect(songCheckbox.getAttribute('aria-checked')).toBe('true');

      fireEvent.click(songCheckbox);
      expect(songCheckbox.getAttribute('aria-checked')).toBe('false');

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

    it('handles dropping File objects onto SourcesSidebar', async () => {
      const bytes = toProBytes(AMAZING_GRACE);
      const droppedFile = new File([bytes as unknown as BlobPart], 'SideDrop.pro', { type: 'application/octet-stream' });

      const { container } = render(<SourcesSidebar />);
      const asideEl = container.querySelector('aside')!;

      // Drag enter -> shows overlay without flicker
      fireEvent.dragEnter(asideEl, { dataTransfer: { files: [droppedFile] } });
      expect(screen.getByText('Drop files to import')).toBeDefined();

      // Drop file
      await act(async () => {
        fireEvent.drop(asideEl, { dataTransfer: { files: [droppedFile] } });
      });

      await waitFor(() => {
        expect(useSourceStore.getState().sources.some((s) => s.name === 'SideDrop.pro')).toBe(true);
      });
    });

    it('returns nothing when the sources rail is collapsed', () => {
      act(() => {
        useUiStore.getState().setSourcesRailCollapsed(true);
      });

      const { container } = render(<SourcesSidebar />);

      expect(container.querySelector('aside')).toBeNull();
      expect(screen.queryByText('Sources')).toBeNull();
    });

    it('shows file count, selected chip, and Select all / Select none controls', () => {
      useSourceStore.setState({
        sources: ['src-a', 'src-b'].map((id, si) => ({
          id,
          path: `/test/File ${si}.pro`,
          name: `File ${si}.pro`,
          format: 'pro' as const,
          library: {
            presentations: [
              { ...AMAZING_GRACE, id: `song-${si}-1` },
              { ...AMAZING_GRACE, id: `song-${si}-2` },
            ],
          },
          warnings: [],
          selectedSongId: `song-${si}-1`,
        })),
        selectedSourceId: 'src-a',
        selectedSongId: 'song-0-1',
        selectedSongs: new Set([
          'src-a:song-0-1',
          'src-a:song-0-2',
          'src-b:song-1-1',
          'src-b:song-1-2',
        ]),
      });

      render(<SourcesSidebar />);

      expect(screen.getByText('2 files')).toBeDefined();
      expect(screen.getByText('4/4 selected')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Select all' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Select none' })).toBeDefined();
      // Old combined checkbox row is gone
      expect(screen.queryByRole('checkbox', { name: /select all songs/i })).toBeNull();
    });

    it('Select none clears selection and Select all restores every song', () => {
      useSourceStore.setState({
        sources: ['src-a', 'src-b'].map((id, si) => ({
          id,
          path: `/test/File ${si}.pro`,
          name: `File ${si}.pro`,
          format: 'pro' as const,
          library: {
            presentations: [
              { ...AMAZING_GRACE, id: `song-${si}-1` },
              { ...AMAZING_GRACE, id: `song-${si}-2` },
            ],
          },
          warnings: [],
          selectedSongId: `song-${si}-1`,
        })),
        selectedSourceId: 'src-a',
        selectedSongId: 'song-0-1',
        selectedSongs: new Set([
          'src-a:song-0-1',
          'src-a:song-0-2',
          'src-b:song-1-1',
          'src-b:song-1-2',
        ]),
      });

      render(<SourcesSidebar />);

      fireEvent.click(screen.getByRole('button', { name: 'Select none' }));
      expect(useSourceStore.getState().selectedSongs.size).toBe(0);

      fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
      expect(useSourceStore.getState().selectedSongs.size).toBe(4);
    });

    it('collapsing the rail unmounts the aside without touching selectedSongs', () => {
      useSourceStore.setState({
        sources: [
          {
            id: 'src-a',
            path: '/test/Amazing Grace.pro',
            name: 'Amazing Grace.pro',
            format: 'pro',
            library: { presentations: [AMAZING_GRACE] },
            warnings: [],
            selectedSongId: AMAZING_GRACE.id,
          },
        ],
        selectedSourceId: 'src-a',
        selectedSongId: AMAZING_GRACE.id,
        selectedSongs: new Set([`src-a:${AMAZING_GRACE.id}`]),
      });

      render(<SourcesSidebar />);

      fireEvent.click(screen.getByRole('button', { name: 'Collapse sources rail' }));

      expect(useUiStore.getState().sourcesRailCollapsed).toBe(true);
      expect(screen.queryByText('Sources')).toBeNull();
      expect([...useSourceStore.getState().selectedSongs]).toEqual([
        `src-a:${AMAZING_GRACE.id}`,
      ]);
    });

    it('disables Select all / Select none when there are no eligible songs', () => {
      useSourceStore.setState({
        sources: [
          {
            id: 'src-empty',
            path: '/test/Empty.pro',
            name: 'Empty.pro',
            format: 'pro',
            library: { presentations: [] },
            warnings: [],
          },
        ],
        selectedSourceId: 'src-empty',
        selectedSongId: undefined,
        selectedSongs: new Set(),
      });

      render(<SourcesSidebar />);

      const selectAllBtn = screen.getByRole('button', { name: 'Select all' }) as HTMLButtonElement;
      const selectNoneBtn = screen.getByRole('button', { name: 'Select none' }) as HTMLButtonElement;
      expect(selectAllBtn.disabled).toBe(true);
      expect(selectNoneBtn.disabled).toBe(true);
    });
  });

  describe('ExportDrawer', () => {
    beforeEach(async () => {
      const bytes = toProBytes(AMAZING_GRACE);
      await mockAdapter.writeFile('/test/Amazing Grace.pro', bytes);
      await useSourceStore.getState().addFiles(['/test/Amazing Grace.pro'], mockAdapter);
    });

    it('selects target format, sets collision policy, and triggers export', async () => {
      render(<ExportDrawer />);

      // Peek is collapsed by default; expand to reach settings
      fireEvent.click(screen.getByRole('button', { name: 'Expand export settings' }));

      // Target format selector
      const vpcBtn = screen.getByRole('button', { name: /videopsalm/i });
      fireEvent.click(vpcBtn);
      expect(useExportStore.getState().targetFormat).toBe('vpc');

      // Collision policy (Base UI Select)
      await selectOption(/collision policy/i, 'Overwrite');
      expect(useExportStore.getState().collisionPolicy).toBe('overwrite');

      // Export button shows song count
      const exportBtn = screen.getByRole('button', { name: /export 1 song/i });
      expect(exportBtn).toBeDefined();

      await act(async () => {
        fireEvent.click(exportBtn);
      });
    });

    it('disables export button and shows folder helper when output directory is empty', () => {
      useExportStore.setState({ outputDirectory: '' });

      render(<ExportDrawer />);

      expect(screen.getByText('No folder selected')).toBeDefined();
      expect(screen.getByText('Pick an output folder')).toBeDefined();

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
    it('renders full 3-column workspace when sources are loaded (no StatusBar)', () => {
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

      render(<App />);

      expect(screen.getByText('Show Converter')).toBeDefined();
      expect(screen.getByRole('heading', { name: /sources/i })).toBeDefined();
      expect(screen.getAllByText('Amazing Grace.pro').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('heading', { name: /export/i })).toBeDefined();
      expect(screen.queryByText(/^Ready$/i)).toBeNull();
    });

    it('renders Import stage instead of the workbench when empty', () => {
      render(<App />);

      expect(screen.getByText('Drop songs to convert')).toBeDefined();
      expect(screen.queryByRole('heading', { name: /sources/i })).toBeNull();
    });
  });
});
