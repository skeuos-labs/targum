// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';

// jsdom lacks PointerEvent; Base UI dispatches it on select/checkbox clicks.
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
    }
  }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventPolyfill;
}

if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = async function (this: Blob): Promise<ArrayBuffer> {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

import { AMAZING_GRACE } from '@show-converter/engine';
import { MockPlatformAdapter, setPlatformAdapter } from '../src/platform';
import { useSourceStore } from '../src/state/sourceStore';
import { useUiStore } from '../src/state/uiStore';
import { useExportStore } from '../src/state/exportStore';
import { ExportDrawer } from '../src/components/export/ExportDrawer';

describe('ExportDrawer', () => {
  let mockAdapter: MockPlatformAdapter;

  beforeEach(() => {
    mockAdapter = new MockPlatformAdapter();
    setPlatformAdapter(mockAdapter);

    useSourceStore.setState({
      sources: ['src-a', 'src-b'].map((id) => ({
        id,
        path: `/test/${id}.pro`,
        name: `${id}.pro`,
        format: 'pro' as const,
        library: { presentations: [AMAZING_GRACE] },
        warnings: [],
        selectedSongId: AMAZING_GRACE.id,
      })),
      selectedSourceId: 'src-a',
      selectedSongId: AMAZING_GRACE.id,
      selectedSongs: new Set([`src-a:${AMAZING_GRACE.id}`, `src-b:${AMAZING_GRACE.id}`]),
    });
    useUiStore.setState({ exportDrawerExpanded: false });
    useExportStore.setState({
      targetFormat: 'pro',
      outputDirectory: '',
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

  describe('collapsed peek (default)', () => {
    it('shows format label, song count, amber no-folder notice, helper, and disabled button', () => {
      render(<ExportDrawer />);

      // Target format chip (default ProPresenter .pro)
      expect(screen.getByText('ProPresenter')).toBeDefined();
      expect(screen.getByText('.pro')).toBeDefined();

      // Destination status: empty dir → amber notice
      const noFolder = screen.getByText('No folder selected');
      expect(noFolder.className).toMatch(/amber/);

      // Primary button + exact disabled helper
      const exportBtn = screen.getByRole('button', {
        name: /export 2 songs/i,
      }) as HTMLButtonElement;
      expect(exportBtn.disabled).toBe(true);
      expect(screen.getByText('Pick an output folder')).toBeDefined();

      // Expand chevron
      expect(
        screen.getByRole('button', { name: 'Expand export settings' })
      ).toBeDefined();

      // Settings are not mounted while collapsed
      expect(screen.queryByText('Target Format')).toBeNull();
      expect(screen.queryByPlaceholderText('/path/to/output')).toBeNull();
    });

    it('enables export and hides helper once output directory is set', async () => {
      useExportStore.setState({ outputDirectory: '/out' });
      render(<ExportDrawer />);

      expect(screen.queryByText('Pick an output folder')).toBeNull();
      expect(screen.queryByText('No folder selected')).toBeNull();
      expect(screen.getByText('/out')).toBeDefined();

      const exportBtn = screen.getByRole('button', {
        name: /export 2 songs/i,
      }) as HTMLButtonElement;
      expect(exportBtn.disabled).toBe(false);

      // Routine export: one click from the collapsed peek executes the export
      await act(async () => {
        fireEvent.click(exportBtn);
      });
      await waitFor(() => {
        expect(useExportStore.getState().lastSummary).not.toBeNull();
      });
      expect(useExportStore.getState().lastSummary!.successCount).toBe(2);
    });

    it('uses singular label for a single selected song', () => {
      useSourceStore.setState({
        selectedSongs: new Set([`src-a:${AMAZING_GRACE.id}`]),
      });
      useExportStore.setState({ outputDirectory: '/out' });

      render(<ExportDrawer />);
      expect(
        screen.getByRole('button', { name: /export 1 song/i })
      ).toBeDefined();
    });

    it('shows Select songs to export and stays disabled even with a folder set', () => {
      useSourceStore.setState({ selectedSongs: new Set() });
      useExportStore.setState({ outputDirectory: '/out' });

      render(<ExportDrawer />);

      expect(screen.getByText('Select songs to export')).toBeDefined();
      const exportBtn = screen.getByRole('button', {
        name: /export 0 songs/i,
      }) as HTMLButtonElement;
      expect(exportBtn.disabled).toBe(true);
    });

    it('disables the button while isExporting', () => {
      useExportStore.setState({ outputDirectory: '/out', isExporting: true });

      render(<ExportDrawer />);

      const exportBtn = screen.getByRole('button', {
        name: /exporting/i,
      }) as HTMLButtonElement;
      expect(exportBtn.disabled).toBe(true);
      expect(screen.queryByText('Pick an output folder')).toBeNull();
      expect(screen.queryByText('Select songs to export')).toBeNull();
    });

    it('helper click expands the drawer and focuses the output input (no-output-dir)', () => {
      render(<ExportDrawer />);

      fireEvent.click(screen.getByText('Pick an output folder'));

      expect(useUiStore.getState().exportDrawerExpanded).toBe(true);
      const input = document.getElementById('output-directory-input');
      expect(input).not.toBeNull();
      expect(document.activeElement).toBe(input);
    });

    it('format chip expands the drawer (opens expanded settings)', () => {
      render(<ExportDrawer />);

      fireEvent.click(screen.getByRole('button', { name: 'ProPresenter' }));

      expect(useUiStore.getState().exportDrawerExpanded).toBe(true);
      expect(screen.getByText('Target Format')).toBeDefined();
    });

    it('treats whitespace-only output directory as unset in the peek', () => {
      useExportStore.setState({ outputDirectory: '   ' });
      render(<ExportDrawer />);

      expect(screen.getByText('No folder selected')).toBeDefined();
      expect(screen.getByText('Pick an output folder')).toBeDefined();
      const exportBtn = screen.getByRole('button', {
        name: /export 2 songs/i,
      }) as HTMLButtonElement;
      expect(exportBtn.disabled).toBe(true);
    });
  });

  describe('expanded settings', () => {
    it('expand shows Target Format, Collision Policy, and Output Directory; collapse removes them but preserves store values', () => {
      useExportStore.setState({ outputDirectory: '/out' });
      render(<ExportDrawer />);

      fireEvent.click(screen.getByRole('button', { name: 'Expand export settings' }));

      expect(screen.getByText('Target Format')).toBeDefined();
      expect(
        screen.getByRole('combobox', { name: /collision policy/i })
      ).toBeDefined();
      expect(screen.getByPlaceholderText('/path/to/output')).toBeDefined();

      // Change settings while expanded
      fireEvent.click(screen.getByRole('button', { name: /videopsalm/i }));
      fireEvent.change(screen.getByPlaceholderText('/path/to/output'), {
        target: { value: '/changed/out' },
      });
      expect(useExportStore.getState().targetFormat).toBe('vpc');
      expect(useExportStore.getState().outputDirectory).toBe('/changed/out');

      const selectedBefore = [...useSourceStore.getState().selectedSongs];

      // Collapse: settings leave the DOM, store values and selection survive
      fireEvent.click(screen.getByRole('button', { name: 'Collapse export settings' }));

      expect(screen.queryByText('Target Format')).toBeNull();
      expect(screen.queryByPlaceholderText('/path/to/output')).toBeNull();
      expect(
        screen.queryByRole('combobox', { name: /collision policy/i })
      ).toBeNull();

      const state = useExportStore.getState();
      expect(state.targetFormat).toBe('vpc');
      expect(state.outputDirectory).toBe('/changed/out');
      expect(state.collisionPolicy).toBe('rename');
      expect([...useSourceStore.getState().selectedSongs]).toEqual(selectedBefore);
    });

    it('expanding with an empty output directory focuses the output input', () => {
      render(<ExportDrawer />);

      fireEvent.click(screen.getByRole('button', { name: 'Expand export settings' }));

      const input = document.getElementById('output-directory-input');
      expect(input).not.toBeNull();
      expect(document.activeElement).toBe(input);
    });

    it('peek shows the destination path again after expand → collapse with a folder set', () => {
      useExportStore.setState({ outputDirectory: '/exports/set' });
      render(<ExportDrawer />);

      fireEvent.click(screen.getByRole('button', { name: 'Expand export settings' }));
      expect(screen.queryByText('/exports/set')).toBeNull();
      expect(screen.queryByText('No folder selected')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Collapse export settings' }));
      expect(screen.getByText('/exports/set')).toBeDefined();
      expect(screen.queryByText('No folder selected')).toBeNull();
    });
  });
});
