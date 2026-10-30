// @vitest-environment jsdom
import './helpers/jsdomPolyfills';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { AMAZING_GRACE } from '@skeuos-labs/mizmor';
import { useSourceStore } from '../src/state/sourceStore';
import { useUiStore } from '../src/state/uiStore';
import { SourcesSidebar } from '../src/components/SourcesSidebar';
import { toProBytes, setupDesktopTest } from './helpers/componentHarness';
import type { MockPlatformAdapter } from '../src/platform';

describe('SourcesSidebar Component', () => {
  let mockAdapter: MockPlatformAdapter;

  beforeEach(async () => {
    mockAdapter = setupDesktopTest();
    const bytes = toProBytes(AMAZING_GRACE);
    await mockAdapter.writeFile('/test/Amazing Grace.pro', bytes);
    await useSourceStore.getState().addFiles(['/test/Amazing Grace.pro'], mockAdapter);
  });

  afterEach(() => {
    cleanup();
  });

  it('toggles song selection and displays source details', () => {
    render(<SourcesSidebar />);

    expect(screen.getByText('Amazing Grace.pro')).toBeDefined();
    expect(screen.getByText('Amazing Grace')).toBeDefined();

    const songCheckbox = screen.getByRole('checkbox', { name: /select song Amazing Grace/i });
    expect(songCheckbox).toBeDefined();
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
    const droppedFile = new File([bytes as unknown as BlobPart], 'SideDrop.pro', {
      type: 'application/octet-stream',
    });

    const { container } = render(<SourcesSidebar />);
    const asideEl = container.querySelector('aside')!;

    fireEvent.dragEnter(asideEl, { dataTransfer: { files: [droppedFile] } });
    expect(screen.getByText('Drop files to import')).toBeDefined();

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

