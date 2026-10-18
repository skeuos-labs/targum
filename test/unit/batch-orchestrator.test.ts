import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AMAZING_GRACE } from '../../src/fixtures/amazing-grace.js';
import { parsePptx } from '../../src/formats/pptx/index.js';
import { getProtoRoot } from '../../src/formats/propresenter/index.js';
import { parseVpc, writeVpc } from '../../src/formats/videopsalm/index.js';
import { exportPresentation } from '../../src/pipeline/convert.js';
import { batchConvert } from '../../src/batch/orchestrator.js';
import type { BatchProgressCallback } from '../../src/batch/types.js';

describe('Batch Orchestrator Engine (batchConvert)', () => {
  let tempBaseDir: string;
  let tempInputDir: string;
  let tempOutputDir: string;

  beforeEach(async () => {
    tempBaseDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'batch-orchestrator-test-'));
    tempInputDir = path.join(tempBaseDir, 'inputs');
    tempOutputDir = path.join(tempBaseDir, 'outputs');
    await fs.promises.mkdir(tempInputDir, { recursive: true });
    await fs.promises.mkdir(tempOutputDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempBaseDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  async function createFixtureFiles(): Promise<{ file1: string; file2: string }> {
    const song1 = {
      ...AMAZING_GRACE,
      id: 'uuid-song-1',
      title: 'Amazing Grace',
    };
    const song2 = {
      ...AMAZING_GRACE,
      id: 'uuid-song-2',
      title: 'How Great Thou Art',
    };

    const exp1 = await exportPresentation(song1, 'pro');
    expect(exp1.ok).toBe(true);
    const file1 = path.join(tempInputDir, 'song1.pro');
    if (exp1.ok) {
      await fs.promises.writeFile(file1, exp1.value.bytes);
    }

    const exp2 = await exportPresentation(song2, 'vpc');
    expect(exp2.ok).toBe(true);
    const file2 = path.join(tempInputDir, 'song2.vpc');
    if (exp2.ok) {
      await fs.promises.writeFile(file2, exp2.value.bytes);
    }

    return { file1, file2 };
  }

  describe('Validation & Incompatible Flags', () => {
    it('throws error when outDir is missing', async () => {
      await expect(
        batchConvert({
          inputs: [tempInputDir],
          to: 'txt',
          outDir: '',
        })
      ).rejects.toThrow(/outDir|Output directory/i);
    });

    it('throws error when --combine is used with -t pro or -t txt', async () => {
      await expect(
        batchConvert({
          inputs: [tempInputDir],
          to: 'pro',
          outDir: tempOutputDir,
          combine: true,
        })
      ).rejects.toThrow(/--combine is only supported for pptx, vpc, and show formats/);

      await expect(
        batchConvert({
          inputs: [tempInputDir],
          to: 'txt',
          outDir: tempOutputDir,
          combine: true,
        })
      ).rejects.toThrow(/--combine is only supported for pptx, vpc, and show formats/);
    });

    it('throws error when --library is used with non-pro target format', async () => {
      await expect(
        batchConvert({
          inputs: [tempInputDir],
          to: 'pptx',
          outDir: tempOutputDir,
          libraryName: 'Hymns',
        })
      ).rejects.toThrow(/--library is only supported when target format is 'pro'/);
    });

    it('throws error when both --combine and --library are specified', async () => {
      await expect(
        batchConvert({
          inputs: [tempInputDir],
          to: 'pro',
          outDir: tempOutputDir,
          combine: true,
          libraryName: 'Hymns',
        })
      ).rejects.toThrow(/--combine and --library are mutually exclusive/);
    });
  });

  describe('Individual Mode (Default)', () => {
    it('converts folder of mixed files (.vpc, .pro) to individual .txt files', async () => {
      await createFixtureFiles();

      const summary = await batchConvert({
        inputs: [tempInputDir],
        to: 'txt',
        outDir: tempOutputDir,
      });

      expect(summary.totalFiles).toBe(2);
      expect(summary.totalSongs).toBe(2);
      expect(summary.successCount).toBe(2);
      expect(summary.failedCount).toBe(0);
      expect(summary.skippedCount).toBe(0);
      expect(summary.durationMs).toBeGreaterThanOrEqual(0);

      const out1 = path.join(tempOutputDir, 'Amazing Grace.txt');
      const out2 = path.join(tempOutputDir, 'How Great Thou Art.txt');
      expect(fs.existsSync(out1)).toBe(true);
      expect(fs.existsSync(out2)).toBe(true);

      const content1 = await fs.promises.readFile(out1, 'utf-8');
      expect(content1).toContain('Amazing grace');
    });

    it('unpacks multi-song container into individual files', async () => {
      const song1 = { ...AMAZING_GRACE, id: 's1', title: 'Song Alpha' };
      const song2 = { ...AMAZING_GRACE, id: 's2', title: 'Song Beta' };
      const vpcRes = await writeVpc([song1, song2]);
      expect(vpcRes.ok).toBe(true);
      if (vpcRes.ok) {
        await fs.promises.writeFile(path.join(tempInputDir, 'Multi.vpc'), vpcRes.value.bytes);
      }

      const summary = await batchConvert({
        inputs: [tempInputDir],
        to: 'txt',
        outDir: tempOutputDir,
      });

      expect(summary.totalFiles).toBe(1);
      expect(summary.totalSongs).toBe(2);
      expect(summary.successCount).toBe(2);
      expect(fs.existsSync(path.join(tempOutputDir, 'Song Alpha.txt'))).toBe(true);
      expect(fs.existsSync(path.join(tempOutputDir, 'Song Beta.txt'))).toBe(true);
    });
  });

  describe('Combined Mode (--combine)', () => {
    it('converts folder of files to combined PowerPoint deck with sections', async () => {
      await createFixtureFiles();

      const summary = await batchConvert({
        inputs: [tempInputDir],
        to: 'pptx',
        outDir: tempOutputDir,
        combine: true,
        combineName: 'ServiceDeck',
      });

      expect(summary.totalFiles).toBe(2);
      expect(summary.totalSongs).toBe(2);
      expect(summary.successCount).toBe(2);
      expect(summary.failedCount).toBe(0);

      const expectedCombinedPath = path.join(tempOutputDir, 'ServiceDeck.pptx');
      expect(summary.combinedOutputPath).toBe(expectedCombinedPath);
      expect(fs.existsSync(expectedCombinedPath)).toBe(true);

      const combinedBytes = await fs.promises.readFile(expectedCombinedPath);
      const parsed = await parsePptx(combinedBytes, 'ServiceDeck.pptx');
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.value.presentations.length).toBe(2);
        const titles = parsed.value.presentations.map((p) => p.title);
        expect(titles).toContain('Amazing Grace');
        expect(titles).toContain('How Great Thou Art');
      }
    });

    it('converts folder of files to combined VideoPsalm archive (.vpc)', async () => {
      await createFixtureFiles();

      const summary = await batchConvert({
        inputs: [tempInputDir],
        to: 'vpc',
        outDir: tempOutputDir,
        combine: true,
      });

      const expectedCombinedPath = path.join(tempOutputDir, 'Combined_Presentations.vpc');
      expect(summary.combinedOutputPath).toBe(expectedCombinedPath);
      expect(fs.existsSync(expectedCombinedPath)).toBe(true);

      const combinedBytes = await fs.promises.readFile(expectedCombinedPath);
      const parsed = await parseVpc(combinedBytes, 'Combined_Presentations.vpc');
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.value.presentations.length).toBe(2);
      }
    });
  });

  describe('ProPresenter Library Mode (--libraryName)', () => {
    it('exports to ProPresenter library folder with individual .pro files and .proplaylist', async () => {
      await createFixtureFiles();

      const summary = await batchConvert({
        inputs: [tempInputDir],
        to: 'pro',
        outDir: tempOutputDir,
        libraryName: 'SundayService',
      });

      expect(summary.totalFiles).toBe(2);
      expect(summary.totalSongs).toBe(2);
      expect(summary.successCount).toBe(2);

      const libDir = path.join(tempOutputDir, 'SundayService');
      expect(fs.existsSync(libDir)).toBe(true);

      const proFile1 = path.join(libDir, 'Amazing Grace.pro');
      const proFile2 = path.join(libDir, 'How Great Thou Art.pro');
      const playlistFile = path.join(libDir, 'SundayService.proplaylist');

      expect(fs.existsSync(proFile1)).toBe(true);
      expect(fs.existsSync(proFile2)).toBe(true);
      expect(fs.existsSync(playlistFile)).toBe(true);

      // Verify playlist protobuf
      const playlistBytes = await fs.promises.readFile(playlistFile);
      const root = getProtoRoot();
      const PlaylistType = root.lookupType('Playlist');
      const decoded = PlaylistType.decode(playlistBytes) as any;

      expect(decoded.name).toBe('SundayService');
      expect(decoded.items.items.length).toBe(2);
      const paths = decoded.items.items.map((it: any) => it.presentation.documentPath.relativePath);
      expect(paths).toContain('./Amazing Grace.pro');
      expect(paths).toContain('./How Great Thou Art.pro');
    });
  });

  describe('Fault Tolerance', () => {
    it('isolates corrupted file: reports 1 failure and converts valid files', async () => {
      await createFixtureFiles();
      // Corrupt file with invalid bytes
      const corruptFile = path.join(tempInputDir, 'corrupted.pro');
      await fs.promises.writeFile(corruptFile, Buffer.from([0x00, 0x11, 0x22, 0x33, 0x44]));

      const summary = await batchConvert({
        inputs: [tempInputDir],
        to: 'txt',
        outDir: tempOutputDir,
      });

      expect(summary.totalFiles).toBe(3);
      expect(summary.successCount).toBe(2);
      expect(summary.failedCount).toBe(1);
      expect(summary.skippedCount).toBe(0);

      const failedItem = summary.items.find((i) => i.status === 'failed');
      expect(failedItem).toBeDefined();
      expect(failedItem?.sourcePath).toBe(corruptFile);
      expect(failedItem?.error).toBeDefined();

      // Valid files converted successfully
      expect(fs.existsSync(path.join(tempOutputDir, 'Amazing Grace.txt'))).toBe(true);
      expect(fs.existsSync(path.join(tempOutputDir, 'How Great Thou Art.txt'))).toBe(true);
    });
  });

  describe('Collision Policies', () => {
    it('rename policy (default): auto-disambiguates colliding output filename', async () => {
      const { file1 } = await createFixtureFiles();
      // Pre-create output file
      const existingOut = path.join(tempOutputDir, 'Amazing Grace.txt');
      await fs.promises.writeFile(existingOut, 'ORIGINAL CONTENT');

      const summary = await batchConvert({
        inputs: [file1],
        to: 'txt',
        outDir: tempOutputDir,
        onCollision: 'rename',
      });

      expect(summary.successCount).toBe(1);
      const disambiguated = path.join(tempOutputDir, 'Amazing Grace (2).txt');
      expect(fs.existsSync(disambiguated)).toBe(true);
      expect(await fs.promises.readFile(existingOut, 'utf-8')).toBe('ORIGINAL CONTENT');
    });

    it('skip policy: skips writing file and records skipped status', async () => {
      const { file1 } = await createFixtureFiles();
      const existingOut = path.join(tempOutputDir, 'Amazing Grace.txt');
      await fs.promises.writeFile(existingOut, 'ORIGINAL CONTENT');

      const summary = await batchConvert({
        inputs: [file1],
        to: 'txt',
        outDir: tempOutputDir,
        onCollision: 'skip',
      });

      expect(summary.skippedCount).toBe(1);
      expect(summary.successCount).toBe(0);
      expect(await fs.promises.readFile(existingOut, 'utf-8')).toBe('ORIGINAL CONTENT');
      expect(fs.existsSync(path.join(tempOutputDir, 'Amazing Grace (2).txt'))).toBe(false);
    });

    it('overwrite policy: overwrites existing output file on disk', async () => {
      const { file1 } = await createFixtureFiles();
      const existingOut = path.join(tempOutputDir, 'Amazing Grace.txt');
      await fs.promises.writeFile(existingOut, 'ORIGINAL CONTENT');

      const summary = await batchConvert({
        inputs: [file1],
        to: 'txt',
        outDir: tempOutputDir,
        onCollision: 'overwrite',
      });

      expect(summary.successCount).toBe(1);
      const content = await fs.promises.readFile(existingOut, 'utf-8');
      expect(content).toContain('Amazing grace');
    });

    it('error policy: fails item when output file exists', async () => {
      const { file1 } = await createFixtureFiles();
      const existingOut = path.join(tempOutputDir, 'Amazing Grace.txt');
      await fs.promises.writeFile(existingOut, 'ORIGINAL CONTENT');

      const summary = await batchConvert({
        inputs: [file1],
        to: 'txt',
        outDir: tempOutputDir,
        onCollision: 'error',
      });

      expect(summary.failedCount).toBe(1);
      expect(summary.successCount).toBe(0);
      expect(summary.items[0]?.status).toBe('failed');
      expect(summary.items[0]?.error?.message).toMatch(/already exists/i);
    });

    it('intra-batch collision: renames second occurrence when two input files have same song title', async () => {
      const song = { ...AMAZING_GRACE, title: 'Same Song' };
      const exp1 = await exportPresentation(song, 'pro');
      const exp2 = await exportPresentation(song, 'vpc');
      if (exp1.ok && exp2.ok) {
        await fs.promises.writeFile(path.join(tempInputDir, 'a.pro'), exp1.value.bytes);
        await fs.promises.writeFile(path.join(tempInputDir, 'b.vpc'), exp2.value.bytes);
      }

      const summary = await batchConvert({
        inputs: [tempInputDir],
        to: 'txt',
        outDir: tempOutputDir,
        onCollision: 'rename',
      });

      expect(summary.successCount).toBe(2);
      expect(fs.existsSync(path.join(tempOutputDir, 'Same Song.txt'))).toBe(true);
      expect(fs.existsSync(path.join(tempOutputDir, 'Same Song (2).txt'))).toBe(true);
    });
  });

  describe('Progress Callback', () => {
    it('invokes onProgress callback during batch lifecycle', async () => {
      await createFixtureFiles();
      const events: Parameters<BatchProgressCallback>[0][] = [];
      const onProgress: BatchProgressCallback = (p) => {
        events.push({ ...p });
      };

      await batchConvert(
        {
          inputs: [tempInputDir],
          to: 'txt',
          outDir: tempOutputDir,
        },
        onProgress
      );

      expect(events.length).toBeGreaterThanOrEqual(4);
      // Processing events
      const processingEvents = events.filter((e) => e.status === 'processing');
      expect(processingEvents.length).toBe(2);
      expect(processingEvents[0]?.totalFiles).toBe(2);
      expect(processingEvents[0]?.currentFile).toBe(1);
      expect(processingEvents[1]?.currentFile).toBe(2);

      // Completion events
      const successEvents = events.filter((e) => e.status === 'success');
      expect(successEvents.length).toBe(2);
    });
  });
});
