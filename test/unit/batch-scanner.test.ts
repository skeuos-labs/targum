import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanBatchInputs } from '../../src/batch/scanner.js';
import type {
  BatchConvertOptions,
  BatchItemResult,
  BatchProgressCallback,
  BatchSummary,
  CollisionPolicy,
} from '../../src/batch/types.js';

describe('Batch Types', () => {
  it('exports valid TypeScript types and interfaces', () => {
    const policy: CollisionPolicy = 'rename';
    expect(['rename', 'skip', 'overwrite', 'error']).toContain(policy);

    const options: BatchConvertOptions = {
      inputs: ['input.pro'],
      to: 'pptx',
      outDir: './out',
      recursive: true,
      onCollision: 'overwrite',
      combine: true,
      combineName: 'CombinedDeck',
      libraryName: 'MainLibrary',
      strict: true,
    };
    expect(options.inputs).toEqual(['input.pro']);
    expect(options.to).toBe('pptx');

    const item: BatchItemResult = {
      sourcePath: '/path/song.pro',
      sourceFormat: 'pro',
      presentationTitle: 'Song Title',
      outputPath: '/out/Song Title.pptx',
      status: 'success',
      warnings: [],
    };
    expect(item.status).toBe('success');

    const summary: BatchSummary = {
      totalFiles: 1,
      totalSongs: 1,
      successCount: 1,
      skippedCount: 0,
      failedCount: 0,
      warningCount: 0,
      items: [item],
      combinedOutputPath: '/out/CombinedDeck.pptx',
      durationMs: 120,
    };
    expect(summary.totalFiles).toBe(1);

    const progressCallback: BatchProgressCallback = (p) => {
      expect(p.currentFile).toBe(1);
    };
    progressCallback({
      currentFile: 1,
      totalFiles: 1,
      sourcePath: 'song.pro',
      status: 'success',
    });
  });
});

describe('Batch Input Scanner (scanBatchInputs)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'batch-scanner-test-'));
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe('Scanning individual files', () => {
    it('discovers a single valid presentation file', async () => {
      const filePath = path.join(tempDir, 'song.pro');
      await fs.promises.writeFile(filePath, 'mock-pro-content');
      const canonicalPath = await fs.promises.realpath(filePath);

      const result = await scanBatchInputs([filePath]);

      expect(result.files).toEqual([canonicalPath]);
      expect(result.warnings).toEqual([]);
    });

    it('discovers multiple individual valid presentation files across supported extensions', async () => {
      const filePro = path.join(tempDir, 'file1.pro');
      const fileTxt = path.join(tempDir, 'file2.txt');
      const filePptx = path.join(tempDir, 'file3.pptx');

      await fs.promises.writeFile(filePro, 'pro');
      await fs.promises.writeFile(fileTxt, 'txt');
      await fs.promises.writeFile(filePptx, 'pptx');

      const expected = await Promise.all([
        fs.promises.realpath(filePro),
        fs.promises.realpath(fileTxt),
        fs.promises.realpath(filePptx),
      ]);
      expected.sort((a, b) => a.localeCompare(b));

      const result = await scanBatchInputs([filePro, fileTxt, filePptx]);

      expect(result.files).toEqual(expected);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('Scanning directory with flat files', () => {
    it('discovers all supported presentation files in a directory', async () => {
      const files = [
        'song.pro',
        'template.pro6',
        'hymnal.vpc',
        'library.json',
        'presentation.show',
        'lyrics.txt',
        'slides.pptx',
      ];

      for (const name of files) {
        await fs.promises.writeFile(path.join(tempDir, name), 'content');
      }

      const expected = await Promise.all(
        files.map((name) => fs.promises.realpath(path.join(tempDir, name)))
      );
      expected.sort((a, b) => a.localeCompare(b));

      const result = await scanBatchInputs([tempDir]);

      expect(result.files).toEqual(expected);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('Recursive vs non-recursive scanning', () => {
    it('discovers only top-level files when recursive is false or omitted', async () => {
      const rootFile = path.join(tempDir, 'root.pro');
      const subDir = path.join(tempDir, 'sub');
      const nestedFile = path.join(subDir, 'nested.pro');

      await fs.promises.writeFile(rootFile, 'root');
      await fs.promises.mkdir(subDir);
      await fs.promises.writeFile(nestedFile, 'nested');

      const rootCanonical = await fs.promises.realpath(rootFile);

      const resultDefault = await scanBatchInputs([tempDir]);
      expect(resultDefault.files).toEqual([rootCanonical]);

      const resultFalse = await scanBatchInputs([tempDir], { recursive: false });
      expect(resultFalse.files).toEqual([rootCanonical]);
    });

    it('discovers nested files across directory tree when recursive is true', async () => {
      const rootFile = path.join(tempDir, 'root.pro');
      const subDir = path.join(tempDir, 'sub');
      const nestedFile = path.join(subDir, 'nested.pro');
      const deepDir = path.join(subDir, 'deep');
      const deepFile = path.join(deepDir, 'deep.txt');

      await fs.promises.writeFile(rootFile, 'root');
      await fs.promises.mkdir(subDir);
      await fs.promises.writeFile(nestedFile, 'nested');
      await fs.promises.mkdir(deepDir);
      await fs.promises.writeFile(deepFile, 'deep');

      const expected = await Promise.all([
        fs.promises.realpath(rootFile),
        fs.promises.realpath(nestedFile),
        fs.promises.realpath(deepFile),
      ]);
      expected.sort((a, b) => a.localeCompare(b));

      const result = await scanBatchInputs([tempDir], { recursive: true });

      expect(result.files).toEqual(expected);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('Filtering unsupported files and emitting warnings', () => {
    it('rejects unsupported individual file inputs with BATCH_UNSUPPORTED_FILE warnings', async () => {
      const pdfFile = path.join(tempDir, 'document.pdf');
      const mp3File = path.join(tempDir, 'audio.mp3');

      await fs.promises.writeFile(pdfFile, '%PDF-1.4');
      await fs.promises.writeFile(mp3File, 'ID3');

      const result = await scanBatchInputs([pdfFile, mp3File]);

      expect(result.files).toEqual([]);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]?.code).toBe('BATCH_UNSUPPORTED_FILE');
      expect(result.warnings[0]?.severity).toBe('warn');
      expect(result.warnings[0]?.context).toEqual({ path: pdfFile });
      expect(result.warnings[1]?.code).toBe('BATCH_UNSUPPORTED_FILE');
      expect(result.warnings[1]?.severity).toBe('warn');
      expect(result.warnings[1]?.context).toEqual({ path: mp3File });
    });

    it('filters unsupported files inside directories without adding them to files', async () => {
      const validFile = path.join(tempDir, 'song.pro');
      const pdfFile = path.join(tempDir, 'notes.pdf');
      const pngFile = path.join(tempDir, 'cover.png');
      const mp3File = path.join(tempDir, 'track.mp3');

      await fs.promises.writeFile(validFile, 'pro');
      await fs.promises.writeFile(pdfFile, '%PDF-1.4');
      await fs.promises.writeFile(pngFile, 'PNG');
      await fs.promises.writeFile(mp3File, 'ID3');

      const validCanonical = await fs.promises.realpath(validFile);

      const result = await scanBatchInputs([tempDir]);

      expect(result.files).toEqual([validCanonical]);
      expect(result.warnings).toEqual([]);
    });

    it('keeps valid files while emitting warnings for unsupported files in mixed inputs', async () => {
      const validFile = path.join(tempDir, 'song.pro');
      const badFile = path.join(tempDir, 'notes.pdf');

      await fs.promises.writeFile(validFile, 'pro');
      await fs.promises.writeFile(badFile, '%PDF-1.4');

      const validCanonical = await fs.promises.realpath(validFile);

      const result = await scanBatchInputs([validFile, badFile]);

      expect(result.files).toEqual([validCanonical]);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.code).toBe('BATCH_UNSUPPORTED_FILE');
      expect(result.warnings[0]?.context).toEqual({ path: badFile });
    });
  });

  describe('Deduplication of redundant paths and symlinks', () => {
    it('deduplicates identical file paths specified multiple times', async () => {
      const filePath = path.join(tempDir, 'song.pro');
      await fs.promises.writeFile(filePath, 'pro');
      const canonical = await fs.promises.realpath(filePath);

      const result = await scanBatchInputs([filePath, filePath, filePath]);

      expect(result.files).toEqual([canonical]);
    });

    it('deduplicates equivalent relative and resolved paths', async () => {
      const filePath = path.join(tempDir, 'song.pro');
      await fs.promises.writeFile(filePath, 'pro');
      const canonical = await fs.promises.realpath(filePath);

      const redundantPath = path.join(tempDir, 'sub', '..', 'song.pro');

      const result = await scanBatchInputs([filePath, redundantPath]);

      expect(result.files).toEqual([canonical]);
    });

    it('deduplicates symlinks pointing to an already included file', async () => {
      const targetFile = path.join(tempDir, 'target.pro');
      const symlinkFile = path.join(tempDir, 'symlink.pro');

      await fs.promises.writeFile(targetFile, 'pro');
      await fs.promises.symlink(targetFile, symlinkFile, 'file');

      const targetCanonical = await fs.promises.realpath(targetFile);

      const result = await scanBatchInputs([targetFile, symlinkFile]);

      expect(result.files).toEqual([targetCanonical]);
    });

    it('avoids infinite recursion when directory contains cyclic symlinks', async () => {
      const subDir = path.join(tempDir, 'sub');
      const songFile = path.join(subDir, 'song.pro');
      const cyclicLink = path.join(subDir, 'cycle');

      await fs.promises.mkdir(subDir);
      await fs.promises.writeFile(songFile, 'pro');
      // Cyclic symlink sub/cycle -> tempDir
      await fs.promises.symlink(tempDir, cyclicLink, 'dir');

      const canonical = await fs.promises.realpath(songFile);

      const result = await scanBatchInputs([tempDir], { recursive: true });

      expect(result.files).toEqual([canonical]);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('Alphabetical sorting', () => {
    it('returns discovered files in deterministic alphabetical order', async () => {
      const names = ['zebra.pro', 'alpha.pro', 'mike.txt', 'bravo.show'];
      for (const name of names) {
        await fs.promises.writeFile(path.join(tempDir, name), 'content');
      }

      const expected = await Promise.all(
        names.map((name) => fs.promises.realpath(path.join(tempDir, name)))
      );
      expected.sort((a, b) => a.localeCompare(b));

      const scrambledInputs = [
        path.join(tempDir, 'zebra.pro'),
        path.join(tempDir, 'bravo.show'),
        path.join(tempDir, 'alpha.pro'),
        path.join(tempDir, 'mike.txt'),
      ];

      const result = await scanBatchInputs(scrambledInputs);

      expect(result.files).toEqual(expected);
    });
  });

  describe('Non-existent input path handling', () => {
    it('emits BATCH_INPUT_NOT_FOUND warning for missing files', async () => {
      const missingPath = path.join(tempDir, 'does-not-exist.pro');

      const result = await scanBatchInputs([missingPath]);

      expect(result.files).toEqual([]);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.code).toBe('BATCH_INPUT_NOT_FOUND');
      expect(result.warnings[0]?.severity).toBe('warn');
      expect(result.warnings[0]?.context).toEqual({ path: missingPath });
    });

    it('retains valid inputs while emitting warnings for missing ones', async () => {
      const validFile = path.join(tempDir, 'exists.pro');
      const missingPath = path.join(tempDir, 'missing.pro');

      await fs.promises.writeFile(validFile, 'pro');
      const canonical = await fs.promises.realpath(validFile);

      const result = await scanBatchInputs([validFile, missingPath]);

      expect(result.files).toEqual([canonical]);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.code).toBe('BATCH_INPUT_NOT_FOUND');
      expect(result.warnings[0]?.context).toEqual({ path: missingPath });
    });
  });

  describe('Empty directory handling', () => {
    it('returns empty files array and no warnings for empty directory', async () => {
      const emptySub = path.join(tempDir, 'empty');
      await fs.promises.mkdir(emptySub);

      const result = await scanBatchInputs([emptySub], { recursive: true });

      expect(result.files).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });
});
