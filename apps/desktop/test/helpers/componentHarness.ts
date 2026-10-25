import { screen, fireEvent } from '@testing-library/react';
import { writePro, type Presentation } from '@show-converter/engine';
import { MockPlatformAdapter, setPlatformAdapter } from '../../src/platform';
import { useThemeStore } from '../../src/state/themeStore';
import { useSourceStore } from '../../src/state/sourceStore';
import { useUiStore } from '../../src/state/uiStore';
import { useExportStore } from '../../src/state/exportStore';

export function toProBytes(pres: Presentation): Uint8Array {
  const res = writePro(pres);
  if (!res.ok) {
    throw res.error;
  }
  return res.bytes;
}

/** Open a Base UI Select trigger and click the option with the given accessible name. */
export async function selectOption(
  triggerName: RegExp,
  optionName: string | RegExp
): Promise<void> {
  const trigger = screen.getByRole('combobox', { name: triggerName });
  fireEvent.click(trigger);
  const option = await screen.findByRole('option', { name: optionName });
  fireEvent.pointerDown(option);
  fireEvent.click(option);
}

/**
 * Fresh MockPlatformAdapter + reset source/ui/export/theme stores.
 * Call in beforeEach; returns the adapter for the test to use.
 */
export function setupDesktopTest(): MockPlatformAdapter {
  const mockAdapter = new MockPlatformAdapter();
  setPlatformAdapter(mockAdapter);

  useThemeStore.getState().setTheme('light');
  useSourceStore.getState().clearAll();
  useUiStore.getState().setSourcesRailCollapsed(false);
  useUiStore.setState({
    centerTab: 'content',
    contentSegment: 'structure',
    warningsSheetOpen: false,
    jsonViewerOpen: false,
    toast: null,
    exportDrawerExpanded: false,
  });
  useExportStore.setState({
    targetFormat: 'pro',
    outputDirectory: '/output',
    collisionPolicy: 'rename',
    combineMode: false,
    combineName: '',
    libraryName: '',
    isExporting: false,
    progress: { current: 0, total: 0, message: '' },
    lastSummary: null,
  });

  return mockAdapter;
}
