import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { executeConvertCommand } from '../../src/cli/commands/convert.js';
import { executeFormatsCommand } from '../../src/cli/commands/formats.js';
import { executeInspectCommand } from '../../src/cli/commands/inspect.js';

const ASSETS_DIR = path.resolve(
  import.meta.dirname,
  '../../../assets-for-testing-purpose',
);

const IZY_PRO_PATH = path.resolve(ASSETS_DIR, 'IZY-original.pro');
const CEVAM_VPC_PATH = path.resolve(ASSETS_DIR, 'Cevam.vpc');
const FACADE_VPC_PATH = path.resolve(ASSETS_DIR, 'façade.vpc');

describe('CLI Commands: formats, inspect, and convert', () => {
  describe('executeFormatsCommand', () => {
    it('outputs formatted text table listing all 7 formats', () => {
      const res = executeFormatsCommand({});

      expect(res.exitCode).toBe(0);
      expect(res.stderr).toBe('');

      // All 7 formats must be present
      const expectedFormats = [
        'pro',
        'pro6',
        'vpc',
        'json',
        'freeshow',
        'txt',
        'pptx',
      ];
      for (const fmt of expectedFormats) {
        expect(res.stdout).toContain(fmt);
      }

      // Headers and capability columns
      expect(res.stdout).toMatch(/format/i);
      expect(res.stdout).toMatch(/extension/i);
      expect(res.stdout).toMatch(/import/i);
      expect(res.stdout).toMatch(/export/i);
    });

    it('outputs valid JSON array when json: true', () => {
      const res = executeFormatsCommand({ json: true });

      expect(res.exitCode).toBe(0);
      expect(res.stderr).toBe('');

      const parsed = JSON.parse(res.stdout);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(7);

      for (const item of parsed) {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('label');
        expect(item).toHaveProperty('extensions');
        expect(Array.isArray(item.extensions)).toBe(true);
        expect(item).toHaveProperty('canImport');
        expect(typeof item.canImport).toBe('boolean');
        expect(item).toHaveProperty('canExport');
        expect(typeof item.canExport).toBe('boolean');
      }

      const ids = parsed.map((p: { id: string }) => p.id);
      expect(ids).toEqual([
        'pro',
        'pro6',
        'vpc',
        'json',
        'freeshow',
        'txt',
        'pptx',
      ]);
    });
  });

  describe('executeInspectCommand', () => {
    it('returns exitCode 3 and error on stderr for non-existent file', async () => {
      const missingFile = 'non-existent-presentation-file.pro';
      const res = await executeInspectCommand({ input: missingFile });

      expect(res.exitCode).toBe(3);
      expect(res.stdout).toBe('');
      expect(res.stderr).toBe(`File not found: ${missingFile}`);
    });

    it('outputs human-readable summary with 17 slides, 3 sections, title IZY for IZY-original.pro', async () => {
      const res = await executeInspectCommand({ input: IZY_PRO_PATH });

      expect(res.exitCode).toBe(0);
      expect(res.stdout).toContain(IZY_PRO_PATH);
      expect(res.stdout).toContain('IZY');
      expect(res.stdout).toContain('Copyright:');
      expect(res.stdout).toContain('17');
      expect(res.stdout).toContain('3');
      expect(res.stdout).toContain('Verse');
      expect(res.stdout).toContain('Chorus');
      expect(res.stdout).toContain('Tag');
    });

    it('outputs valid canonical Library JSON when json: true for Cevam.vpc', async () => {
      const res = await executeInspectCommand({
        input: CEVAM_VPC_PATH,
        json: true,
      });

      expect(res.exitCode).toBe(0);
      const parsed = JSON.parse(res.stdout);
      expect(parsed).toHaveProperty('presentations');
      expect(Array.isArray(parsed.presentations)).toBe(true);
      expect(parsed.presentations.length).toBeGreaterThanOrEqual(1);

      const pres = parsed.presentations[0];
      expect(pres).toHaveProperty('title', 'IZY');
      expect(pres).toHaveProperty('slides');
      expect(pres).toHaveProperty('sections');
    });

    it('returns exitCode 2 when importFile fails on corrupt/unrecognized file', async () => {
      const tempCorruptFile = path.resolve(
        import.meta.dirname,
        'temp-corrupt.unknown',
      );
      fs.writeFileSync(tempCorruptFile, Buffer.from([0x00, 0x11, 0x22, 0x33]));

      try {
        const res = await executeInspectCommand({ input: tempCorruptFile });
        expect(res.exitCode).toBe(2);
        expect(res.stdout).toBe('');
        expect(res.stderr).toContain(`Failed to import "${tempCorruptFile}"`);
      } finally {
        if (fs.existsSync(tempCorruptFile)) {
          fs.unlinkSync(tempCorruptFile);
        }
      }
    });
  });

  describe('executeConvertCommand', () => {
    const TMP_DIR = path.resolve(import.meta.dirname, 'tmp-convert-test');

    beforeEach(() => {
      if (fs.existsSync(TMP_DIR)) {
        fs.rmSync(TMP_DIR, { recursive: true, force: true });
      }
      fs.mkdirSync(TMP_DIR, { recursive: true });
    });

    afterEach(() => {
      if (fs.existsSync(TMP_DIR)) {
        fs.rmSync(TMP_DIR, { recursive: true, force: true });
      }
    });

    it('returns exitCode 3 when input file is not found', async () => {
      const res = await executeConvertCommand({
        input: 'missing-input.pro',
        to: 'vpc',
      });

      expect(res.exitCode).toBe(3);
      expect(res.stdout).toBe('');
      expect(res.stderr).toBe('Input file not found: missing-input.pro');
    });

    it('returns exitCode 3 when target format is unknown or unexportable', async () => {
      const resUnknown = await executeConvertCommand({
        input: IZY_PRO_PATH,
        to: 'unknown_format',
      });
      expect(resUnknown.exitCode).toBe(3);
      expect(resUnknown.stdout).toBe('');
      expect(resUnknown.stderr).toBe(
        'Unknown or unexportable target format: unknown_format',
      );

      const resUnexportable = await executeConvertCommand({
        input: IZY_PRO_PATH,
        to: 'json',
      });
      expect(resUnexportable.exitCode).toBe(3);
      expect(resUnexportable.stdout).toBe('');
      expect(resUnexportable.stderr).toBe(
        'Unknown or unexportable target format: json',
      );
    });

    it('converts single file (.pro -> .vpc) and creates output file with exitCode 0', async () => {
      const outVpc = path.resolve(TMP_DIR, 'izy.vpc');
      const res = await executeConvertCommand({
        input: IZY_PRO_PATH,
        to: 'vpc',
        out: outVpc,
      });

      expect(res.exitCode).toBe(0);
      expect(fs.existsSync(outVpc)).toBe(true);
      expect(res.stdout).toBe(outVpc);
    });

    it('accepts "show" as alias for freeshow format and converts successfully', async () => {
      const outShow = path.resolve(TMP_DIR, 'izy.show');
      const res = await executeConvertCommand({
        input: IZY_PRO_PATH,
        to: 'show',
        out: outShow,
      });

      expect(res.exitCode).toBe(0);
      expect(fs.existsSync(outShow)).toBe(true);
      expect(res.stdout).toBe(outShow);
    });

    it('refuses to overwrite existing file without --force (exitCode 3) and succeeds with --force (exitCode 0)', async () => {
      const outVpc = path.resolve(TMP_DIR, 'izy.vpc');
      const firstRes = await executeConvertCommand({
        input: IZY_PRO_PATH,
        to: 'vpc',
        out: outVpc,
      });
      expect(firstRes.exitCode).toBe(0);
      expect(fs.existsSync(outVpc)).toBe(true);

      const noForceRes = await executeConvertCommand({
        input: IZY_PRO_PATH,
        to: 'vpc',
        out: outVpc,
      });
      expect(noForceRes.exitCode).toBe(3);
      expect(noForceRes.stdout).toBe('');
      expect(noForceRes.stderr).toBe(
        `Output file already exists: ${outVpc}. Use --force / -f to overwrite.`,
      );

      const forceRes = await executeConvertCommand({
        input: IZY_PRO_PATH,
        to: 'vpc',
        out: outVpc,
        force: true,
      });
      expect(forceRes.exitCode).toBe(0);
      expect(fs.existsSync(outVpc)).toBe(true);
    });

    it('rejects in-place overwrite attempt when output equals input with exitCode 3', async () => {
      const res = await executeConvertCommand({
        input: IZY_PRO_PATH,
        to: 'pro',
        out: IZY_PRO_PATH,
      });

      expect(res.exitCode).toBe(3);
      expect(res.stdout).toBe('');
      expect(res.stderr).toBe('Target output path cannot equal source input path.');
    });

    it('fails closed with exitCode 2 when multi-song container is converted to single-song format without --split or --song', async () => {
      const res = await executeConvertCommand({
        input: FACADE_VPC_PATH,
        to: 'pro',
      });

      expect(res.exitCode).toBe(2);
      expect(res.stdout).toBe('');
      expect(res.stderr).toBe(
        `Input "${FACADE_VPC_PATH}" contains 19 songs, but target format "pro" only supports 1 song per file. Use --split <dir> to unpack all songs or --song <index|title> to convert one.`,
      );
    });

    it('converts single presentation when --song 1 or --song <title> is specified', async () => {
      const outSong1 = path.resolve(TMP_DIR, 'song1.pro');
      const resSong1 = await executeConvertCommand({
        input: FACADE_VPC_PATH,
        to: 'pro',
        out: outSong1,
        song: '1',
      });
      expect(resSong1.exitCode).toBe(0);
      expect(fs.existsSync(outSong1)).toBe(true);

      const outSongTitle = path.resolve(TMP_DIR, 'song-title.pro');
      const resSongTitle = await executeConvertCommand({
        input: FACADE_VPC_PATH,
        to: 'pro',
        out: outSongTitle,
        song: 'mendrika ianao',
      });
      expect(resSongTitle.exitCode).toBe(0);
      expect(fs.existsSync(outSongTitle)).toBe(true);

      const resMissingSong = await executeConvertCommand({
        input: FACADE_VPC_PATH,
        to: 'pro',
        song: 'NonExistentSongTitle',
      });
      expect(resMissingSong.exitCode).toBe(3);
      expect(resMissingSong.stdout).toBe('');
      expect(resMissingSong.stderr).toBe(
        `Song "NonExistentSongTitle" not found in ${FACADE_VPC_PATH}`,
      );
    });

    it('unpacks all presentations in multi-song file into separate files with --split <dir>', async () => {
      const splitDir = path.resolve(TMP_DIR, 'split-pro');
      const res = await executeConvertCommand({
        input: FACADE_VPC_PATH,
        to: 'pro',
        split: splitDir,
      });

      expect(res.exitCode).toBe(0);
      expect(fs.existsSync(splitDir)).toBe(true);

      const files = fs.readdirSync(splitDir);
      expect(files).toHaveLength(19);
      for (const file of files) {
        expect(file.endsWith('.pro')).toBe(true);
      }
    });

    it('exits with code 1 when non-fatal warnings occur and --strict is enabled', async () => {
      const outStrict = path.resolve(TMP_DIR, 'izy-strict.vpc');
      const res = await executeConvertCommand({
        input: IZY_PRO_PATH,
        to: 'vpc',
        out: outStrict,
        strict: true,
      });

      expect(res.exitCode).toBe(1);
      expect(fs.existsSync(outStrict)).toBe(true);
      expect(res.stderr).toContain('[INFO] (VPC_TAG_UNMAPPED)');
    });

    it('emits valid JSON summary on stdout when --json is passed for single-file and split conversions', async () => {
      const outJson = path.resolve(TMP_DIR, 'izy-json.vpc');
      const resSingle = await executeConvertCommand({
        input: IZY_PRO_PATH,
        to: 'vpc',
        out: outJson,
        json: true,
      });
      expect(resSingle.exitCode).toBe(0);
      const parsedSingle = JSON.parse(resSingle.stdout);
      expect(parsedSingle).toEqual({
        ok: true,
        source: IZY_PRO_PATH,
        target: outJson,
        format: 'vpc',
        warnings: expect.any(Array),
      });

      const splitJsonDir = path.resolve(TMP_DIR, 'split-json');
      const resSplit = await executeConvertCommand({
        input: FACADE_VPC_PATH,
        to: 'pro',
        split: splitJsonDir,
        json: true,
      });
      expect(resSplit.exitCode).toBe(0);
      const parsedSplit = JSON.parse(resSplit.stdout);
      expect(parsedSplit.ok).toBe(true);
      expect(parsedSplit.count).toBe(19);
      expect(parsedSplit.outDir).toBe(splitJsonDir);
      expect(parsedSplit.files).toHaveLength(19);
      expect(Array.isArray(parsedSplit.warnings)).toBe(true);
    });
  });
});
