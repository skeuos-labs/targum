// @vitest-environment jsdom
import './helpers/jsdomPolyfills';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { AMAZING_GRACE } from '@show-converter/engine';
import { useSourceStore } from '../src/state/sourceStore';
import { useExportStore } from '../src/state/exportStore';
import { ExportDrawer } from '../src/components/export/ExportDrawer';
import { BatchProgressModal } from '../src/components/BatchProgressModal';
import App from '../src/App';
import { toProBytes, selectOption, setupDesktopTest } from './helpers/componentHarness';
import type { MockPlatformAdapter } from '../src/platform';

describe('Core Desktop Shell & Modals', () => {
  let mockAdapter: MockPlatformAdapter;

  beforeEach(() => {
    mockAdapter = setupDesktopTest();
  });

  afterEach(() => {
    cleanup();
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
