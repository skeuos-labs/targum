import type { PlatformAdapter } from './adapter';
import { TauriPlatformAdapter } from './tauriAdapter';
import { MockPlatformAdapter } from './mockAdapter';

export * from './adapter';
export { TauriPlatformAdapter } from './tauriAdapter';
export { MockPlatformAdapter } from './mockAdapter';

let currentAdapter: PlatformAdapter | null = null;

export function getPlatformAdapter(): PlatformAdapter {
  if (currentAdapter) {
    return currentAdapter;
  }

  const isTauri =
    typeof window !== 'undefined' && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

  if (isTauri) {
    currentAdapter = new TauriPlatformAdapter();
  } else {
    currentAdapter = new MockPlatformAdapter();
  }

  return currentAdapter;
}

export function setPlatformAdapter(adapter: PlatformAdapter | null): void {
  currentAdapter = adapter;
}
