import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AMAZING_GRACE } from '../../src/fixtures/amazing-grace.js';
import { parsePptx } from '../../src/formats/pptx/index.js';
import { exportPresentation } from '../../src/pipeline/convert.js';

const CLI_PATH = path.resolve(process.cwd(), 'dist/cli/index.js');
const TMP_DIR = path.resolve(process.cwd(), 'tmp-cli-batch-test');

function runCli(args: string[]) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
    env: { ...process.env },
  });
  if (result.error) {
    throw result.error;
  }
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

describe('CLI Batch Command & Folder Conversion Routing', () => {
  let testFolder: string;
  let outDir: string;

  beforeEach(async () => {
    if (fs.existsSync(TMP_DIR)) {
      fs.rmSync(TMP_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TMP_DIR, { recursive: true });

    testFolder = path.join(TMP_DIR, 'test-folder');
    outDir = path.join(TMP_DIR, 'out');
    fs.mkdirSync(testFolder, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    const song1 = {
      ...AMAZING_GRACE,
      id: 'song-1',
      title: 'Amazing Grace',
    };
    const song2 = {
      ...AMAZING_GRACE,
      id: 'song-2',
      title: 'How Great Thou Art',
    };

    const exp1 = await exportPresentation(song1, 'pro');
    if (exp1.ok) {
      fs.writeFileSync(path.join(testFolder, 'song1.pro'), exp1.value.bytes);
    }
    const exp2 = await exportPresentation(song2, 'vpc');
    if (exp2.ok) {
      fs.writeFileSync(path.join(testFolder, 'song2.vpc'), exp2.value.bytes);
    }
  });

  afterEach(() => {
    if (fs.existsSync(TMP_DIR)) {
      fs.rmSync(TMP_DIR, { recursive: true, force: true });
    }
  });

  it('converts all files in folder with batch command and exits 0', () => {
    const res = runCli(['batch', testFolder, '-t', 'pro', '-o', outDir]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Batch complete: 2/2 succeeded');
    expect(fs.existsSync(path.join(outDir, 'Amazing Grace.pro'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'How Great Thou Art.pro'))).toBe(true);
  });

  it('auto-detects folder in convert command and delegates to batch with exit 0', () => {
    const res = runCli(['convert', testFolder, '-t', 'txt', '-o', outDir]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Batch complete: 2/2 succeeded');
    expect(fs.existsSync(path.join(outDir, 'Amazing Grace.txt'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'How Great Thou Art.txt'))).toBe(true);
  });

  it('outputs single combined PPTX with --combine ServiceDeck and exits 0', async () => {
    const res = runCli([
      'batch',
      testFolder,
      '-t',
      'pptx',
      '-o',
      outDir,
      '--combine',
      'ServiceDeck',
    ]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Batch complete:');
    const combinedPath = path.join(outDir, 'ServiceDeck.pptx');
    expect(fs.existsSync(combinedPath)).toBe(true);

    const bytes = new Uint8Array(fs.readFileSync(combinedPath));
    const parsed = await parsePptx(bytes);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.presentations.length).toBe(2);
      expect(parsed.value.presentations.map((p) => p.title)).toContain('Amazing Grace');
      expect(parsed.value.presentations.map((p) => p.title)).toContain('How Great Thou Art');
    }
  });

  it('fails closed with exit code 3 for incompatible flags', () => {
    const resCombinePro = runCli([
      'batch',
      testFolder,
      '-t',
      'pro',
      '-o',
      outDir,
      '--combine',
    ]);
    expect(resCombinePro.status).toBe(3);
    expect(resCombinePro.stderr).toMatch(/combine/i);

    const resLibraryPptx = runCli([
      'batch',
      testFolder,
      '-t',
      'pptx',
      '-o',
      outDir,
      '--library',
      'Lib',
    ]);
    expect(resLibraryPptx.status).toBe(3);
    expect(resLibraryPptx.stderr).toMatch(/library/i);

    const resCombineAndLib = runCli([
      'batch',
      testFolder,
      '-t',
      'pro',
      '-o',
      outDir,
      '--combine',
      '--library',
      'Lib',
    ]);
    expect(resCombineAndLib.status).toBe(3);
    expect(resCombineAndLib.stderr).toMatch(/mutually exclusive/i);

    const resMissingOut = runCli(['batch', testFolder, '-t', 'pro']);
    expect(resMissingOut.status).toBe(3);
    expect(resMissingOut.stderr).toMatch(/--out|-o/i);

    const resMissingTo = runCli(['batch', testFolder, '-o', outDir]);
    expect(resMissingTo.status).toBe(3);
    expect(resMissingTo.stderr).toMatch(/--to|-t/i);
  });

  it('returns exit code 2 on folder with corrupted file alongside valid file, converting valid file', () => {
    const mixedFolder = path.join(TMP_DIR, 'mixed-folder');
    fs.mkdirSync(mixedFolder, { recursive: true });

    // Copy valid file
    fs.copyFileSync(
      path.join(testFolder, 'song1.pro'),
      path.join(mixedFolder, 'valid.pro'),
    );
    // Write corrupted file with recognized extension
    fs.writeFileSync(
      path.join(mixedFolder, 'corrupt.vpc'),
      'invalid-corrupt-data-not-a-vpc-archive',
    );

    const res = runCli(['batch', mixedFolder, '-t', 'txt', '-o', outDir]);
    expect(res.status).toBe(2);
    expect(res.stdout).toContain('1/2 succeeded');
    expect(res.stdout).toContain('1 failed');
    // Valid file must have converted
    expect(fs.existsSync(path.join(outDir, 'Amazing Grace.txt'))).toBe(true);
  });

  it('emits valid JSON BatchSummary to stdout when --json is provided', () => {
    const res = runCli(['batch', testFolder, '-t', 'txt', '-o', outDir, '--json']);
    expect(res.status).toBe(0);
    const summary = JSON.parse(res.stdout);
    expect(summary).toHaveProperty('totalFiles', 2);
    expect(summary).toHaveProperty('successCount', 2);
    expect(summary).toHaveProperty('failedCount', 0);
    expect(summary).toHaveProperty('skippedCount', 0);
    expect(summary).toHaveProperty('items');
    expect(Array.isArray(summary.items)).toBe(true);
    expect(summary.items.length).toBe(2);
  });
});
