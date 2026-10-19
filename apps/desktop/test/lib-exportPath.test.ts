import { describe, it, expect } from 'vitest';
import { MockPlatformAdapter } from '../src/platform';
import { resolveAdapterOutputPath } from '../src/lib/exportPath';

describe('resolveAdapterOutputPath', () => {
  it('writes when path is free', async () => {
    const adapter = new MockPlatformAdapter();
    const tracked = new Set<string>();
    const r = await resolveAdapterOutputPath(adapter, '/out', 'Song', 'pro', 'rename', tracked);
    expect(r.action).toBe('write');
    expect(r.path).toBe('/out/Song.pro');
    expect(tracked.has('/out/Song.pro')).toBe(true);
  });

  it('skips existing file under skip policy', async () => {
    const adapter = new MockPlatformAdapter();
    await adapter.writeFile('/out/Song.pro', new Uint8Array([1]));
    const r = await resolveAdapterOutputPath(adapter, '/out', 'Song', 'pro', 'skip', new Set());
    expect(r.action).toBe('skip');
  });

  it('errors under error policy', async () => {
    const adapter = new MockPlatformAdapter();
    await adapter.writeFile('/out/Song.pro', new Uint8Array([1]));
    const r = await resolveAdapterOutputPath(adapter, '/out', 'Song', 'pro', 'error', new Set());
    expect(r.action).toBe('error');
    expect(r.error?.message).toContain('already exists');
  });

  it('renames with counter under rename policy', async () => {
    const adapter = new MockPlatformAdapter();
    await adapter.writeFile('/out/Song.pro', new Uint8Array([1]));
    const r = await resolveAdapterOutputPath(adapter, '/out', 'Song', 'pro', 'rename', new Set());
    expect(r.action).toBe('write');
    expect(r.path).toBe('/out/Song (2).pro');
  });

  it('tracks in-memory collisions even if file missing on disk', async () => {
    const adapter = new MockPlatformAdapter();
    const tracked = new Set(['/out/Song.pro']);
    const r = await resolveAdapterOutputPath(adapter, '/out', 'Song', 'pro', 'rename', tracked);
    expect(r.path).toBe('/out/Song (2).pro');
  });
});
