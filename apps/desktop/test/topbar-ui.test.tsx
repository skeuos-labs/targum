// @vitest-environment jsdom
import './helpers/jsdomPolyfills';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { AMAZING_GRACE } from '@skeuos-labs/mizmor';
import { useThemeStore } from '../src/state/themeStore';
import { useSourceStore } from '../src/state/sourceStore';
import { useUiStore } from '../src/state/uiStore';
import { TopBar } from '../src/components/TopBar';
import { selectOption, setupDesktopTest } from './helpers/componentHarness';
import type { MockPlatformAdapter } from '../src/platform';

describe('Core Desktop UI Components', () => {
  let mockAdapter: MockPlatformAdapter;

  beforeEach(() => {
    mockAdapter = setupDesktopTest();
  });

  afterEach(() => {
    cleanup();
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
});

