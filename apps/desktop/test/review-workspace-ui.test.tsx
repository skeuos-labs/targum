// @vitest-environment jsdom
import './helpers/jsdomPolyfills';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { AMAZING_GRACE } from '@show-converter/engine';
import { useSourceStore } from '../src/state/sourceStore';
import { ReviewWorkspace } from '../src/components/ReviewWorkspace';
import { toProBytes, setupDesktopTest } from './helpers/componentHarness';

describe('Core Desktop UI Components', () => {
  beforeEach(() => {
    setupDesktopTest();
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
      const droppedFile = new File([bytes as unknown as BlobPart], 'Dropped.pro', {
        type: 'application/octet-stream',
      });

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
});
