import { describe, it, expect, beforeEach } from 'vitest';
import {
  MockPlatformAdapter,
  getPlatformAdapter,
  setPlatformAdapter,
} from '../src/platform';

describe('PlatformAdapter', () => {
  let mock: MockPlatformAdapter;

  beforeEach(() => {
    mock = new MockPlatformAdapter();
    setPlatformAdapter(mock);
  });

  describe('MockPlatformAdapter File Operations', () => {
    it('writes and reads binary files', async () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      await mock.writeFile('/data/sample.bin', bytes);

      const readBack = await mock.readFile('/data/sample.bin');
      expect(readBack).toEqual(bytes);
    });

    it('throws when reading non-existent file', async () => {
      await expect(mock.readFile('/missing.txt')).rejects.toThrow('File not found');
    });

    it('checks file and directory existence correctly', async () => {
      expect(await mock.exists('/folder')).toBe(false);

      await mock.createDir('/folder');
      expect(await mock.exists('/folder')).toBe(true);

      expect(await mock.exists('/folder/file.txt')).toBe(false);
      await mock.writeFile('/folder/file.txt', new Uint8Array([42]));
      expect(await mock.exists('/folder/file.txt')).toBe(true);
    });

    it('handles readDir flat and recursive', async () => {
      await mock.writeFile('/project/file1.txt', new Uint8Array([1]));
      await mock.writeFile('/project/file2.txt', new Uint8Array([2]));
      await mock.writeFile('/project/nested/sub1.txt', new Uint8Array([3]));
      await mock.writeFile('/project/nested/deep/sub2.txt', new Uint8Array([4]));
      await mock.writeFile('/other/file3.txt', new Uint8Array([5]));

      const flatEntries = await mock.readDir('/project');
      expect(flatEntries).toEqual(['/project/file1.txt', '/project/file2.txt']);

      const flatWithOption = await mock.readDir('/project', { recursive: false });
      expect(flatWithOption).toEqual(['/project/file1.txt', '/project/file2.txt']);

      const recursiveEntries = await mock.readDir('/project', { recursive: true });
      expect(recursiveEntries).toEqual([
        '/project/file1.txt',
        '/project/file2.txt',
        '/project/nested/deep/sub2.txt',
        '/project/nested/sub1.txt',
      ]);
    });

    it('opens path and records call', async () => {
      await mock.openPath('/folder/file.txt');
      expect(mock.openedPaths).toContain('/folder/file.txt');
    });
  });

  describe('MockPlatformAdapter Dialogs', () => {
    it('returns configured picked files or null', async () => {
      expect(await mock.pickFiles()).toBeNull();

      mock.setMockPickedFiles(['/a.pro', '/b.pro']);
      expect(await mock.pickFiles({ filters: [{ name: 'ProPresenter', extensions: ['pro'] }] })).toEqual([
        '/a.pro',
        '/b.pro',
      ]);
    });

    it('returns configured picked directory or null', async () => {
      expect(await mock.pickDirectory()).toBeNull();

      mock.setMockPickedDirectory('/my/library');
      expect(await mock.pickDirectory({ title: 'Select Library' })).toBe('/my/library');
    });
  });

  describe('MockPlatformAdapter Window Controls', () => {
    it('tracks window minimize, maximize, toggleMaximize, and close', async () => {
      expect(mock.isMinimized).toBe(false);
      expect(mock.isMaximized).toBe(false);
      expect(mock.isClosed).toBe(false);

      await mock.window.minimize();
      expect(mock.isMinimized).toBe(true);

      await mock.window.maximize();
      expect(mock.isMaximized).toBe(true);
      expect(mock.isMinimized).toBe(false);

      await mock.window.toggleMaximize();
      expect(mock.isMaximized).toBe(false);

      await mock.window.toggleMaximize();
      expect(mock.isMaximized).toBe(true);

      await mock.window.close();
      expect(mock.isClosed).toBe(true);
    });
  });

  describe('getPlatformAdapter and setPlatformAdapter', () => {
    it('defaults to mock in Node / Vitest environment', () => {
      setPlatformAdapter(null as any);
      const adapter = getPlatformAdapter();
      expect(adapter).toBeInstanceOf(MockPlatformAdapter);
    });

    it('allows swapping adapter via setPlatformAdapter', () => {
      const customMock = new MockPlatformAdapter();
      setPlatformAdapter(customMock);
      expect(getPlatformAdapter()).toBe(customMock);
    });
  });
});
