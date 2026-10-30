// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { writePro, AMAZING_GRACE } from '@skeuos-labs/mizmor';
import { MockPlatformAdapter, setPlatformAdapter } from '../src/platform';
import { useSourceStore } from '../src/state/sourceStore';
import { useDndStore } from '../src/state/dndStore';
import App from '../src/App';

describe('DnD store', () => {
  beforeEach(() => {
    useDndStore.setState({
      mode: 'html5',
      dragging: false,
      target: null,
      targets: { sidebar: null, center: null, export: null },
    });
  });

  it('begin/end drag toggles exclusive target', () => {
    useDndStore.getState().beginDrag('sidebar');
    expect(useDndStore.getState().dragging).toBe(true);
    expect(useDndStore.getState().target).toBe('sidebar');

    useDndStore.getState().setTarget('center');
    expect(useDndStore.getState().target).toBe('center');

    useDndStore.getState().endDrag();
    expect(useDndStore.getState().dragging).toBe(false);
    expect(useDndStore.getState().target).toBeNull();
  });

  it('hitTest resolves registered rects (center preferred)', () => {
    useDndStore.getState().registerTarget('sidebar', {
      rect: { left: 0, top: 0, right: 320, bottom: 800 },
      pathsFor: () => [],
      filesFor: () => [],
    });
    useDndStore.getState().registerTarget('center', {
      rect: { left: 320, top: 0, right: 960, bottom: 800 },
      pathsFor: () => [],
      filesFor: () => [],
    });

    expect(useDndStore.getState().hitTest(10, 10)).toBe('sidebar');
    expect(useDndStore.getState().hitTest(500, 100)).toBe('center');
    expect(useDndStore.getState().hitTest(1000, 10)).toBeNull();
  });
});

describe('App native drag-drop (Tauri path via Mock adapter)', () => {
  let mock: MockPlatformAdapter;

  beforeEach(() => {
    mock = new MockPlatformAdapter();
    setPlatformAdapter(mock);
    useSourceStore.getState().clearAll();
    useDndStore.setState({
      mode: 'html5',
      dragging: false,
      target: null,
      targets: { sidebar: null, center: null, export: null },
    });
  });

  it('imports files on native drop event and clears overlay on leave', async () => {
    const res = writePro(AMAZING_GRACE);
    if (!res.ok) throw res.error;
    const path = '/drops/NativeDrop.pro';
    await mock.writeFile(path, res.bytes);

    render(<App />);

    act(() => {
      mock.simulateDragDrop({ type: 'enter', paths: [path] });
    });
    expect(useDndStore.getState().dragging).toBe(true);

    act(() => {
      mock.simulateDragDrop({ type: 'leave' });
    });
    expect(useDndStore.getState().dragging).toBe(false);

    act(() => {
      mock.simulateDragDrop({ type: 'enter', paths: [path] });
      mock.simulateDragDrop({ type: 'drop', paths: [path] });
    });

    await waitFor(() => {
      expect(useSourceStore.getState().sources.some((s) => s.name === 'NativeDrop.pro')).toBe(true);
    });
    expect(useDndStore.getState().dragging).toBe(false);
  });

  it('updates overlay target from over position hit-test', async () => {
    render(<App />);

    useDndStore.getState().registerTarget('center', {
      rect: { left: 0, top: 0, right: 100, bottom: 100 },
      pathsFor: () => [],
      filesFor: () => [],
    });

    act(() => {
      mock.simulateDragDrop({ type: 'enter', paths: [] });
      mock.simulateDragDrop({ type: 'over', position: { x: 50, y: 50 } });
    });
    expect(useDndStore.getState().target).toBe('center');

    act(() => {
      mock.simulateDragDrop({ type: 'over', position: { x: 500, y: 50 } });
    });
    expect(useDndStore.getState().target).toBeNull();

    act(() => {
      mock.simulateDragDrop({ type: 'leave' });
    });
  });
});

