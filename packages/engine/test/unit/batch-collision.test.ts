import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type ResolvedOutputPath,
  resolveOutputPath,
} from '../../src/batch/collision.js';

describe('Batch Collision & Path Resolution (resolveOutputPath)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'batch-collision-test-'));
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe('rename policy (default)', () => {
    it('returns write action with direct path when no file exists and not tracked', () => {
      const tracked = new Set<string>();
      const result = resolveOutputPath(tempDir, 'Amazing Grace', '.pro', 'rename', tracked);

      const expectedPath = path.resolve(tempDir, 'Amazing Grace.pro');
      expect(result).toEqual({
        action: 'write',
        path: expectedPath,
      });
      expect(tracked.has(expectedPath)).toBe(true);
    });

    it('defaults policy to rename and trackedPaths to empty set when omitted', () => {
      const result = resolveOutputPath(tempDir, 'Default Song', '.pro');
      const expectedPath = path.resolve(tempDir, 'Default Song.pro');

      expect(result).toEqual({
        action: 'write',
        path: expectedPath,
      });
    });

    it('increments counter to (2) when file exists on disk', async () => {
      const baseFile = path.resolve(tempDir, 'Song.pro');
      await fs.promises.writeFile(baseFile, 'existing content');

      const tracked = new Set<string>();
      const result = resolveOutputPath(tempDir, 'Song', '.pro', 'rename', tracked);

      const expectedPath = path.resolve(tempDir, 'Song (2).pro');
      expect(result).toEqual({
        action: 'write',
        path: expectedPath,
      });
      expect(tracked.has(expectedPath)).toBe(true);
      expect(tracked.has(baseFile)).toBe(false);
    });

    it('increments counter to (3) when file and (2) exist on disk', async () => {
      await fs.promises.writeFile(path.resolve(tempDir, 'Song.pro'), '1');
      await fs.promises.writeFile(path.resolve(tempDir, 'Song (2).pro'), '2');

      const tracked = new Set<string>();
      const result = resolveOutputPath(tempDir, 'Song', '.pro', 'rename', tracked);

      const expectedPath = path.resolve(tempDir, 'Song (3).pro');
      expect(result).toEqual({
        action: 'write',
        path: expectedPath,
      });
      expect(tracked.has(expectedPath)).toBe(true);
    });

    it('increments counter for files already tracked in current batch', () => {
      const tracked = new Set<string>();
      const path1 = resolveOutputPath(tempDir, 'Hymn', '.txt', 'rename', tracked);
      const path2 = resolveOutputPath(tempDir, 'Hymn', '.txt', 'rename', tracked);
      const path3 = resolveOutputPath(tempDir, 'Hymn', '.txt', 'rename', tracked);

      expect(path1.path).toBe(path.resolve(tempDir, 'Hymn.txt'));
      expect(path2.path).toBe(path.resolve(tempDir, 'Hymn (2).txt'));
      expect(path3.path).toBe(path.resolve(tempDir, 'Hymn (3).txt'));

      expect(tracked.size).toBe(3);
      expect(tracked.has(path1.path)).toBe(true);
      expect(tracked.has(path2.path)).toBe(true);
      expect(tracked.has(path3.path)).toBe(true);
    });

    it('handles combination of disk existence and tracked batch collisions', async () => {
      await fs.promises.writeFile(path.resolve(tempDir, 'Track.pro'), 'disk-1');
      await fs.promises.writeFile(path.resolve(tempDir, 'Track (2).pro'), 'disk-2');

      const tracked = new Set<string>();
      // First in batch will collide with disk 1 and disk 2, taking (3)
      const res1 = resolveOutputPath(tempDir, 'Track', '.pro', 'rename', tracked);
      expect(res1.path).toBe(path.resolve(tempDir, 'Track (3).pro'));

      // Second in batch will collide with disk 1, disk 2, and tracked (3), taking (4)
      const res2 = resolveOutputPath(tempDir, 'Track', '.pro', 'rename', tracked);
      expect(res2.path).toBe(path.resolve(tempDir, 'Track (4).pro'));
    });
  });

  describe('skip policy', () => {
    it('returns skip action without error when target file exists on disk', async () => {
      const targetPath = path.resolve(tempDir, 'Existing.pro');
      await fs.promises.writeFile(targetPath, 'existing');

      const tracked = new Set<string>();
      const result = resolveOutputPath(tempDir, 'Existing', '.pro', 'skip', tracked);

      expect(result).toEqual({
        action: 'skip',
        path: targetPath,
      });
      expect(tracked.has(targetPath)).toBe(false);
    });

    it('returns skip action when path is in trackedPaths', () => {
      const targetPath = path.resolve(tempDir, 'Queued.pro');
      const tracked = new Set<string>([targetPath]);

      const result = resolveOutputPath(tempDir, 'Queued', '.pro', 'skip', tracked);

      expect(result).toEqual({
        action: 'skip',
        path: targetPath,
      });
      // trackedPaths is untouched
      expect(tracked.size).toBe(1);
    });

    it('returns write action when file does not exist', () => {
      const tracked = new Set<string>();
      const result = resolveOutputPath(tempDir, 'NewSong', '.pro', 'skip', tracked);

      const expectedPath = path.resolve(tempDir, 'NewSong.pro');
      expect(result).toEqual({
        action: 'write',
        path: expectedPath,
      });
      expect(tracked.has(expectedPath)).toBe(true);
    });
  });

  describe('overwrite policy', () => {
    it('returns write action with same path even when file exists on disk', async () => {
      const targetPath = path.resolve(tempDir, 'OverwriteMe.pro');
      await fs.promises.writeFile(targetPath, 'old content');

      const tracked = new Set<string>();
      const result = resolveOutputPath(tempDir, 'OverwriteMe', '.pro', 'overwrite', tracked);

      expect(result).toEqual({
        action: 'write',
        path: targetPath,
      });
      expect(tracked.has(targetPath)).toBe(true);
    });

    it('returns write action when path is already tracked in batch', () => {
      const targetPath = path.resolve(tempDir, 'Dup.pro');
      const tracked = new Set<string>([targetPath]);

      const result = resolveOutputPath(tempDir, 'Dup', '.pro', 'overwrite', tracked);

      expect(result).toEqual({
        action: 'write',
        path: targetPath,
      });
      expect(tracked.has(targetPath)).toBe(true);
    });

    it('returns write action when file does not exist', () => {
      const tracked = new Set<string>();
      const result = resolveOutputPath(tempDir, 'Fresh.pro', '.pro', 'overwrite', tracked);

      const expectedPath = path.resolve(tempDir, 'Fresh.pro.pro');
      expect(result.action).toBe('write');
      expect(tracked.has(expectedPath)).toBe(true);
    });
  });

  describe('error policy', () => {
    it('returns error action with Error when file exists on disk', async () => {
      const targetPath = path.resolve(tempDir, 'Protected.pro');
      await fs.promises.writeFile(targetPath, 'locked');

      const tracked = new Set<string>();
      const result = resolveOutputPath(tempDir, 'Protected', '.pro', 'error', tracked);

      expect(result.action).toBe('error');
      expect(result.path).toBe(targetPath);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe(`File already exists: "${targetPath}"`);
      expect(tracked.has(targetPath)).toBe(false);
    });

    it('returns error action when path is already in trackedPaths', () => {
      const targetPath = path.resolve(tempDir, 'Conflict.pro');
      const tracked = new Set<string>([targetPath]);

      const result = resolveOutputPath(tempDir, 'Conflict', '.pro', 'error', tracked);

      expect(result.action).toBe('error');
      expect(result.path).toBe(targetPath);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe(`File already exists: "${targetPath}"`);
      expect(tracked.size).toBe(1);
    });

    it('returns write action when file does not exist', () => {
      const tracked = new Set<string>();
      const result = resolveOutputPath(tempDir, 'Clean.pro', '.pro', 'error', tracked);

      expect(result.action).toBe('write');
      expect(result.error).toBeUndefined();
      expect(tracked.has(result.path)).toBe(true);
    });
  });

  describe('sanitizing illegal characters and empty titles', () => {
    it('strips illegal characters from baseName', () => {
      const result = resolveOutputPath(
        tempDir,
        'Song: Part 1 / 2? *cool* <wow> | "test"',
        '.pro',
        'rename'
      );

      const expectedPath = path.resolve(tempDir, 'Song Part 1  2 cool wow  test.pro');
      expect(result.path).toBe(expectedPath);
      expect(result.action).toBe('write');
    });

    it('falls back to "untitled" for empty baseName', () => {
      const result = resolveOutputPath(tempDir, '', '.pro', 'rename');
      const expectedPath = path.resolve(tempDir, 'untitled.pro');
      expect(result.path).toBe(expectedPath);
    });

    it('falls back to "untitled" for baseName consisting solely of spaces and dots', () => {
      const result = resolveOutputPath(tempDir, '   ...  ', '.pro', 'rename');
      const expectedPath = path.resolve(tempDir, 'untitled.pro');
      expect(result.path).toBe(expectedPath);
    });
  });

  describe('extension normalization', () => {
    it('normalizes extension without leading dot', () => {
      const result = resolveOutputPath(tempDir, 'Song', 'pro', 'rename');
      const expectedPath = path.resolve(tempDir, 'Song.pro');
      expect(result.path).toBe(expectedPath);
    });

    it('normalizes extension with leading dot', () => {
      const result = resolveOutputPath(tempDir, 'Song', '.pro', 'rename');
      const expectedPath = path.resolve(tempDir, 'Song.pro');
      expect(result.path).toBe(expectedPath);
    });

    it('handles empty extension', () => {
      const result = resolveOutputPath(tempDir, 'Song', '', 'rename');
      const expectedPath = path.resolve(tempDir, 'Song');
      expect(result.path).toBe(expectedPath);
    });
  });

  describe('intra-batch duplicate titles', () => {
    it('resolves 3 songs named "Verse" with rename policy into Verse.pro, Verse (2).pro, Verse (3).pro', () => {
      const tracked = new Set<string>();

      const res1 = resolveOutputPath(tempDir, 'Verse', '.pro', 'rename', tracked);
      const res2 = resolveOutputPath(tempDir, 'Verse', '.pro', 'rename', tracked);
      const res3 = resolveOutputPath(tempDir, 'Verse', '.pro', 'rename', tracked);

      expect(res1).toEqual({
        action: 'write',
        path: path.resolve(tempDir, 'Verse.pro'),
      });
      expect(res2).toEqual({
        action: 'write',
        path: path.resolve(tempDir, 'Verse (2).pro'),
      });
      expect(res3).toEqual({
        action: 'write',
        path: path.resolve(tempDir, 'Verse (3).pro'),
      });

      expect(tracked.has(res1.path)).toBe(true);
      expect(tracked.has(res2.path)).toBe(true);
      expect(tracked.has(res3.path)).toBe(true);
      expect(tracked.size).toBe(3);
    });
  });
});
