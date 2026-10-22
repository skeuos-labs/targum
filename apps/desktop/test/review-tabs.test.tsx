// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// jsdom lacks PointerEvent; Base UI dispatches it on dialog/select interactions.
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

import { AMAZING_GRACE } from '@show-converter/engine';
import { MockPlatformAdapter, setPlatformAdapter } from '../src/platform';
import { useSourceStore } from '../src/state/sourceStore';
import { useUiStore } from '../src/state/uiStore';
import { ReviewWorkspace } from '../src/components/ReviewWorkspace';
import type { Warning } from '@show-converter/engine';

function seedSource(warnings: Warning[] = []) {
  useSourceStore.setState({
    sources: [
      {
        id: 'src-ag',
        path: '/test/Amazing Grace.pro',
        name: 'Amazing Grace.pro',
        format: 'pro' as const,
        library: { presentations: [AMAZING_GRACE] },
        warnings,
        selectedSongId: AMAZING_GRACE.id,
      },
    ],
    selectedSourceId: 'src-ag',
    selectedSongId: AMAZING_GRACE.id,
    selectedSongs: new Set([`src-ag:${AMAZING_GRACE.id}`]),
  });
}

describe('Center workspace Content | Details | ⋯', () => {
  let mockAdapter: MockPlatformAdapter;

  beforeEach(() => {
    mockAdapter = new MockPlatformAdapter();
    setPlatformAdapter(mockAdapter);

    useSourceStore.getState().clearAll();
    useUiStore.setState({
      centerTab: 'content',
      contentSegment: 'structure',
      warningsSheetOpen: false,
      jsonViewerOpen: false,
      toast: null,
      sourcesRailCollapsed: false,
      exportDrawerExpanded: false,
    });
    seedSource();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('defaults to centerTab content and shows Content + Details tabs only', () => {
    render(<ReviewWorkspace />);

    expect(useUiStore.getState().centerTab).toBe('content');
    expect(screen.getByRole('tab', { name: /content/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /details/i })).toBeDefined();

    // No legacy tab labels
    expect(screen.queryByRole('tab', { name: /overview/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /^sections$/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /^slides$/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /warnings/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /raw json/i })).toBeNull();

    // Overflow trigger
    expect(screen.getByRole('button', { name: 'More' })).toBeDefined();
  });

  it('Content header shows format badge, filename, song title, Copy lyrics, Structure|Projection segment', () => {
    render(<ReviewWorkspace />);

    expect(screen.getByText('PRO')).toBeDefined();
    expect(screen.getByText('Amazing Grace.pro')).toBeDefined();
    expect(screen.getAllByText('Amazing Grace').length).toBeGreaterThanOrEqual(1);

    expect(screen.getByRole('button', { name: /copy lyrics/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^structure$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^projection$/i })).toBeDefined();
  });

  it('defaults to Structure segment showing sections spine; switching to Projection shows 16:9 cards; Copy lyrics stays', () => {
    render(<ReviewWorkspace />);

    // Structure spine visible by default
    expect(screen.getByText(/sections & lyrics spine/i)).toBeDefined();
    expect(screen.getAllByText('Verse 1').length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole('button', { name: /^projection$/i }));
    expect(useUiStore.getState().contentSegment).toBe('projection');

    expect(screen.getByText(/projection simulator/i)).toBeDefined();
    const slideBadges = screen.getAllByText(/^[1-9]\/9$/);
    expect(slideBadges).toHaveLength(9);
    expect(screen.getByRole('button', { name: /copy lyrics/i })).toBeDefined();
  });

  it('Copy lyrics writes formatted lyrics to clipboard in Content', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextSpy } });

    render(<ReviewWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /copy lyrics/i }));
    expect(writeTextSpy).toHaveBeenCalled();
    expect(await screen.findByText(/copied!/i)).toBeDefined();
  });

  it('warning chip opens WarningsSheet without leaving Content; Content stays mounted', () => {
    const warning: Warning = {
      code: 'PRO_STYLES_NOT_EXTRACTED',
      severity: 'info',
      message: 'Text styling was ignored',
    };
    seedSource([warning]);
    render(<ReviewWorkspace />);

    // Chip shows severity-aware label
    const chip = screen.getByRole('button', { name: /1 info/i });
    fireEvent.click(chip);

    expect(useUiStore.getState().warningsSheetOpen).toBe(true);
    expect(useUiStore.getState().centerTab).toBe('content');

    // Dialog lists warning details
    expect(screen.getByText(/PRO_STYLES_NOT_EXTRACTED/)).toBeDefined();
    expect(screen.getByText(/Text styling was ignored/)).toBeDefined();
    // Footer note
    expect(screen.getByText(/export can proceed/i)).toBeDefined();

    // Content still mounted (song title still in DOM under sheet)
    expect(screen.getAllByText('Amazing Grace').length).toBeGreaterThanOrEqual(1);

    // Close via close button
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    expect(useUiStore.getState().warningsSheetOpen).toBe(false);
  });

  it('0 warnings shows OK chip and Full diagnostics sheet is empty-state friendly', () => {
    render(<ReviewWorkspace />);

    expect(screen.getByText('OK')).toBeDefined();

    // Overflow → Full diagnostics
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /full diagnostics/i }));

    expect(useUiStore.getState().warningsSheetOpen).toBe(true);
    expect(screen.getByText(/no warnings/i)).toBeDefined();
  });

  it('severity-aware chip label: 2 warn · 1 error form', () => {
    seedSource([
      { code: 'W1', severity: 'warn', message: 'warn one' },
      { code: 'W2', severity: 'warn', message: 'warn two' },
      { code: 'E1', severity: 'error', message: 'error one' },
    ]);
    render(<ReviewWorkspace />);

    expect(screen.getByRole('button', { name: /2 warn · 1 error/i })).toBeDefined();
  });

  it('Overflow → Raw JSON AST opens JSON viewer with tree and Copy JSON', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextSpy } });

    render(<ReviewWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /raw json ast/i }));

    expect(useUiStore.getState().jsonViewerOpen).toBe(true);
    expect(screen.getByText('"title"')).toBeDefined();
    expect(screen.getByText('"sourceFormat"')).toBeDefined();

    const copyBtn = screen.getByRole('button', { name: /copy json/i });
    fireEvent.click(copyBtn);
    expect(writeTextSpy).toHaveBeenCalled();
    expect(await screen.findByText(/copied!/i)).toBeDefined();
  });

  it('overflow menu closes on select', () => {
    render(<ReviewWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('menu', { name: /more/i })).toBeDefined();

    fireEvent.click(screen.getByRole('menuitem', { name: /full diagnostics/i }));
    expect(screen.queryByRole('menu', { name: /more/i })).toBeNull();
  });

  it('Details tab shows metadata editor heading and editable title', () => {
    render(<ReviewWorkspace />);

    fireEvent.click(screen.getByRole('tab', { name: /details/i }));
    expect(useUiStore.getState().centerTab).toBe('details');

    expect(screen.getByText(/metadata editor/i)).toBeDefined();
    expect(screen.getByDisplayValue('Amazing Grace')).toBeDefined();
    expect(screen.getByText(/arrangement flow/i)).toBeDefined();

    // Back to Content
    fireEvent.click(screen.getByRole('tab', { name: /content/i }));
    expect(useUiStore.getState().centerTab).toBe('content');
    expect(screen.getByText(/sections & lyrics spine/i)).toBeDefined();
  });

  it('closing warnings sheet via Escape does not unmount Content', async () => {
    seedSource([
      { code: 'X', severity: 'warn', message: 'something happened' },
    ]);
    render(<ReviewWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /1 warn/i }));
    expect(useUiStore.getState().warningsSheetOpen).toBe(true);

    await waitFor(() => {
      expect(screen.getByText(/something happened/)).toBeDefined();
    });

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    await waitFor(() => {
      expect(useUiStore.getState().warningsSheetOpen).toBe(false);
    });
    expect(screen.getAllByText('Amazing Grace').length).toBeGreaterThanOrEqual(1);
  });
});
