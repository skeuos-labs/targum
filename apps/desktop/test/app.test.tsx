// @vitest-environment jsdom
import { render, screen, act, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AMAZING_GRACE, writePro } from '@skeuos-labs/mizmor';
import { MockPlatformAdapter, setPlatformAdapter } from '../src/platform';
import { useSourceStore } from '../src/state/sourceStore';
import { useUiStore } from '../src/state/uiStore';
import App from '../src/App';

describe('App', () => {
  let mockAdapter: MockPlatformAdapter;

  beforeEach(async () => {
    mockAdapter = new MockPlatformAdapter();
    setPlatformAdapter(mockAdapter);

    useSourceStore.getState().clearAll();
    useUiStore.setState({ toast: null });

    const bytes = writePro(AMAZING_GRACE);
    if (!bytes.ok) {
      throw bytes.error;
    }
    await mockAdapter.writeFile('/samples/one.pro', bytes.bytes);
    await mockAdapter.writeFile('/samples/two.pro', bytes.bytes);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders desktop shell header', () => {
    render(<App />);
    expect(screen.getByText('Targum')).toBeDefined();
  });

  it('renders Import stage copy when empty with no StatusBar remnants', () => {
    render(<App />);

    expect(screen.getByText('Drop songs to convert')).toBeDefined();
    expect(screen.queryByText(/^Ready$/i)).toBeNull();
    expect(screen.queryByText(/^\d+ files$/)).toBeNull();
    expect(screen.queryByText(/^\d+ songs$/)).toBeNull();
  });

  it('fires import toast only on 0->N crossing and auto-dismisses after ~2s', async () => {
    render(<App />);

    await act(async () => {
      await useSourceStore.getState().addFiles(['/samples/one.pro'], mockAdapter);
    });
    expect(await screen.findByText('Imported 1 song')).toBeDefined();

    // Later adds must not re-fire the toast
    await act(async () => {
      await useSourceStore.getState().addFiles(['/samples/two.pro'], mockAdapter);
    });
    expect(screen.queryByText('Imported 2 songs')).toBeNull();
    const toast = useUiStore.getState().toast;
    expect(toast === null || toast.message === 'Imported 1 song').toBe(true);

    await waitFor(
      () => {
        expect(screen.queryByText('Imported 1 song')).toBeNull();
      },
      { timeout: 4000 }
    );
  });

  it('re-import after Clear All resets centerTab and contentSegment to Content/Structure', async () => {
    render(<App />);

    await act(async () => {
      await useSourceStore.getState().addFiles(['/samples/one.pro'], mockAdapter);
    });
    await screen.findByText('Imported 1 song');

    // Move off the default view, then clear all sources
    await act(async () => {
      useUiStore.getState().setCenterTab('details');
      useUiStore.getState().setContentSegment('projection');
      useSourceStore.getState().clearAll();
    });
    expect(useSourceStore.getState().sources).toHaveLength(0);
    expect(screen.getByText('Drop songs to convert')).toBeDefined();

    // Re-import: workbench must open on Content / Structure (spec §4)
    await act(async () => {
      await useSourceStore.getState().addFiles(['/samples/one.pro'], mockAdapter);
    });
    await screen.findByText('Imported 1 song');

    expect(useUiStore.getState().centerTab).toBe('content');
    expect(useUiStore.getState().contentSegment).toBe('structure');
    expect(
      screen.getByRole('tab', { name: /content/i }).getAttribute('aria-selected')
    ).toBe('true');
    expect(
      screen
        .getByRole('button', { name: /^structure$/i })
        .getAttribute('aria-pressed')
    ).toBe('true');
  });
});

