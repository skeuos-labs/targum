// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUiStore } from '../src/state/uiStore';

describe('uiStore', () => {
  const STORAGE_KEY = 'targum.sourcesRailCollapsed';

  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({
      sourcesRailCollapsed: false,
      exportDrawerExpanded: false,
      centerTab: 'content',
      contentSegment: 'structure',
      warningsSheetOpen: false,
      jsonViewerOpen: false,
      toast: null,
    });
  });

  it('defaults to content tab, structure segment, collapsed rail, closed sheets', () => {
    const state = useUiStore.getState();
    expect(state.sourcesRailCollapsed).toBe(false);
    expect(state.exportDrawerExpanded).toBe(false);
    expect(state.centerTab).toBe('content');
    expect(state.contentSegment).toBe('structure');
    expect(state.warningsSheetOpen).toBe(false);
    expect(state.jsonViewerOpen).toBe(false);
    expect(state.toast).toBeNull();
  });

  it("reads sourcesRailCollapsed from localStorage on init ('1' → true, else false)", async () => {
    vi.resetModules();
    localStorage.setItem(STORAGE_KEY, '1');
    let fresh = await import('../src/state/uiStore');
    expect(fresh.useUiStore.getState().sourcesRailCollapsed).toBe(true);

    vi.resetModules();
    localStorage.removeItem(STORAGE_KEY);
    fresh = await import('../src/state/uiStore');
    expect(fresh.useUiStore.getState().sourcesRailCollapsed).toBe(false);
  });

  it('setSourcesRailCollapsed sets state and persists to localStorage', () => {
    useUiStore.getState().setSourcesRailCollapsed(true);
    expect(useUiStore.getState().sourcesRailCollapsed).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');

    useUiStore.getState().setSourcesRailCollapsed(false);
    expect(useUiStore.getState().sourcesRailCollapsed).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBe('1');
  });

  it('toggleSourcesRail flips and persists the flag', () => {
    expect(useUiStore.getState().sourcesRailCollapsed).toBe(false);

    useUiStore.getState().toggleSourcesRail();
    expect(useUiStore.getState().sourcesRailCollapsed).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');

    useUiStore.getState().toggleSourcesRail();
    expect(useUiStore.getState().sourcesRailCollapsed).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBe('1');
  });

  it('setCenterTab accepts only content/details', () => {
    useUiStore.getState().setCenterTab('details');
    expect(useUiStore.getState().centerTab).toBe('details');
    useUiStore.getState().setCenterTab('content');
    expect(useUiStore.getState().centerTab).toBe('content');
  });

  it('setContentSegment accepts only structure/projection', () => {
    useUiStore.getState().setContentSegment('projection');
    expect(useUiStore.getState().contentSegment).toBe('projection');
    useUiStore.getState().setContentSegment('structure');
    expect(useUiStore.getState().contentSegment).toBe('structure');
  });

  it('setExportDrawerExpanded, setWarningsSheetOpen, setJsonViewerOpen set flags', () => {
    useUiStore.getState().setExportDrawerExpanded(true);
    expect(useUiStore.getState().exportDrawerExpanded).toBe(true);
    useUiStore.getState().setExportDrawerExpanded(false);
    expect(useUiStore.getState().exportDrawerExpanded).toBe(false);

    useUiStore.getState().setWarningsSheetOpen(true);
    expect(useUiStore.getState().warningsSheetOpen).toBe(true);
    useUiStore.getState().setWarningsSheetOpen(false);
    expect(useUiStore.getState().warningsSheetOpen).toBe(false);

    useUiStore.getState().setJsonViewerOpen(true);
    expect(useUiStore.getState().jsonViewerOpen).toBe(true);
    useUiStore.getState().setJsonViewerOpen(false);
    expect(useUiStore.getState().jsonViewerOpen).toBe(false);
  });

  it('showToast sets { id, message } and replaces previous toast', () => {
    useUiStore.getState().showToast('Imported 3 songs');
    const first = useUiStore.getState().toast;
    expect(first).not.toBeNull();
    expect(first!.message).toBe('Imported 3 songs');
    expect(typeof first!.id).toBe('number');

    useUiStore.getState().showToast('Imported 5 songs');
    const second = useUiStore.getState().toast;
    expect(second!.message).toBe('Imported 5 songs');
    expect(second!.id).not.toBe(first!.id);
  });

  it('clearToast(id) only clears when id matches; clearToast() clears current', () => {
    useUiStore.getState().showToast('First toast');
    const firstId = useUiStore.getState().toast!.id;

    // Non-matching id leaves toast alone
    useUiStore.getState().clearToast(firstId + 1000);
    expect(useUiStore.getState().toast).not.toBeNull();
    expect(useUiStore.getState().toast!.message).toBe('First toast');

    // Matching id clears
    useUiStore.getState().clearToast(firstId);
    expect(useUiStore.getState().toast).toBeNull();

    // No id clears whatever is current
    useUiStore.getState().showToast('Second toast');
    useUiStore.getState().clearToast();
    expect(useUiStore.getState().toast).toBeNull();
  });
});
