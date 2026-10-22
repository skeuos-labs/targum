// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { AMAZING_GRACE, writePro, type Presentation } from '@show-converter/engine';
import { MockPlatformAdapter, setPlatformAdapter } from '../src/platform';
import { useSourceStore } from '../src/state/sourceStore';
import { useUiStore } from '../src/state/uiStore';
import { ImportStage } from '../src/components/import/ImportStage';
import App from '../src/App';

function toProBytes(pres: Presentation): Uint8Array {
  const res = writePro(pres);
  if (!res.ok) {
    throw res.error;
  }
  return res.bytes;
}

describe('ImportStage and stage routing', () => {
  let mockAdapter: MockPlatformAdapter;

  beforeEach(async () => {
    mockAdapter = new MockPlatformAdapter();
    setPlatformAdapter(mockAdapter);

    useSourceStore.getState().clearAll();
    useUiStore.setState({ toast: null });

    await mockAdapter.writeFile('/samples/Amazing Grace.pro', toProBytes(AMAZING_GRACE));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders headline, formats line, and Add Files / Add Folder buttons', () => {
    render(<ImportStage />);

    expect(screen.getByText('Drop songs to convert')).toBeDefined();
    expect(
      screen.getByText(
        'ProPresenter .pro/.pro6 · VideoPsalm .vpc/.json · FreeShow .show · Plain Text .txt · PowerPoint .pptx'
      )
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add Files' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add Folder' })).toBeDefined();
  });

  it('Add Files picks a mounted path, App switches to workbench, and toast shows Imported 1 song', async () => {
    vi.spyOn(mockAdapter, 'pickFiles').mockResolvedValue(['/samples/Amazing Grace.pro']);

    render(<App />);
    expect(screen.getByText('Drop songs to convert')).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add Files' }));
    });

    // Import stage gone, sources rail (workbench) visible
    await waitFor(() => {
      expect(screen.queryByText('Drop songs to convert')).toBeNull();
    });
    expect(screen.getByRole('heading', { name: /sources/i })).toBeDefined();

    // Toast on 0 -> N crossing
    expect(await screen.findByText('Imported 1 song')).toBeDefined();
  });

  it('does not render ImportStage (or fire a toast) when sources are already populated', () => {
    useSourceStore.setState({
      sources: [
        {
          id: 'src-ag',
          path: '/samples/Amazing Grace.pro',
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

    expect(screen.queryByText('Drop songs to convert')).toBeNull();
    expect(screen.getByRole('heading', { name: /sources/i })).toBeDefined();
    expect(screen.queryByText(/^Imported /)).toBeNull();
  });

  it('drops a directory path and imports nested supported files', async () => {
    render(<ImportStage />);

    const mainEl = screen.getByRole('main');
    const dirDrop = { path: '/samples' } as unknown as File & { path: string };
    await act(async () => {
      fireEvent.drop(mainEl, { dataTransfer: { files: [dirDrop] } });
    });

    // Directory scan finds Amazing Grace.pro under /samples
    await waitFor(() => {
      expect(useSourceStore.getState().sources).toHaveLength(1);
    });
    expect(useSourceStore.getState().sources[0]!.name).toBe('Amazing Grace.pro');
  });

  it('importPaths with unsupported inputs toasts No supported songs found', async () => {
    render(<App />);

    await act(async () => {
      await useSourceStore.getState().importPaths(['/samples/missing.pro'], mockAdapter);
    });

    expect(useSourceStore.getState().sources).toHaveLength(0);
    expect(await screen.findByText('No supported songs found')).toBeDefined();
    // Success toast must not also fire
    expect(screen.queryByText(/^Imported /)).toBeNull();
  });

  it('Add Folder on an empty directory toasts No supported songs found', async () => {
    vi.spyOn(mockAdapter, 'pickDirectory').mockResolvedValue('/empty-folder');
    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add Folder' }));
    });

    expect(useSourceStore.getState().sources).toHaveLength(0);
    expect(await screen.findByText('No supported songs found')).toBeDefined();
  });
});
