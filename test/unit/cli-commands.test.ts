import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { executeFormatsCommand } from '../../src/cli/commands/formats.js';
import { executeInspectCommand } from '../../src/cli/commands/inspect.js';

const ASSETS_DIR = path.resolve(
  import.meta.dirname,
  '../../../assets-for-testing-purpose',
);

const IZY_PRO_PATH = path.resolve(ASSETS_DIR, 'IZY-original.pro');
const CEVAM_VPC_PATH = path.resolve(ASSETS_DIR, 'Cevam.vpc');

describe('CLI Commands: formats and inspect', () => {
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
});
