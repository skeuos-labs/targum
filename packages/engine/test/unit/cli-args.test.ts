import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseCliArgs, type CliCommand } from '../../src/cli/args.js';
import {
  disambiguateFileName,
  formatCliWarning,
  sanitizeFileName,
} from '../../src/cli/utils.js';

describe('Filename sanitization & utilities', () => {
  describe('sanitizeFileName', () => {
    it('preserves clean filenames', () => {
      expect(sanitizeFileName('Amazing Grace')).toBe('Amazing Grace');
      expect(sanitizeFileName('Song 123')).toBe('Song 123');
      expect(sanitizeFileName('Holy, Holy, Holy')).toBe('Holy, Holy, Holy');
    });

    it('strips illegal filename characters', () => {
      // [/\\:*?"<>|]
      expect(sanitizeFileName('Song/With\\Slash:Colon*Star?Question"Quote<Less>Greater|Pipe')).toBe(
        'SongWithSlashColonStarQuestionQuoteLessGreaterPipe',
      );
    });

    it('strips control characters', () => {
      expect(sanitizeFileName('Title\u0000With\u001fControl\u007fChars')).toBe(
        'TitleWithControlChars',
      );
    });

    it('trims leading and trailing spaces and dots', () => {
      expect(sanitizeFileName('  .My Song Title.  ')).toBe('My Song Title');
      expect(sanitizeFileName('...Another Song...')).toBe('Another Song');
      expect(sanitizeFileName('  Song.With.Dots  ')).toBe('Song.With.Dots');
    });

    it('falls back to "untitled" when sanitized string is empty', () => {
      expect(sanitizeFileName('')).toBe('untitled');
      expect(sanitizeFileName('   ')).toBe('untitled');
      expect(sanitizeFileName('...')).toBe('untitled');
      expect(sanitizeFileName(':::???*')).toBe('untitled');
      expect(sanitizeFileName('  /\\*?  ')).toBe('untitled');
    });
  });

  describe('disambiguateFileName', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-disambiguate-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns direct path when target does not exist', () => {
      const result = disambiguateFileName(tmpDir, 'Song', '.pro');
      expect(result).toBe(path.resolve(tmpDir, 'Song.pro'));
    });

    it('handles extension without leading dot', () => {
      const result = disambiguateFileName(tmpDir, 'Song', 'pro');
      expect(result).toBe(path.resolve(tmpDir, 'Song.pro'));
    });

    it('appends sequential counter (2) when file exists', () => {
      fs.writeFileSync(path.join(tmpDir, 'Song.pro'), 'data');

      const result = disambiguateFileName(tmpDir, 'Song', '.pro');
      expect(result).toBe(path.resolve(tmpDir, 'Song (2).pro'));
    });

    it('appends sequential counter (3) when (2) also exists', () => {
      fs.writeFileSync(path.join(tmpDir, 'Song.pro'), 'data');
      fs.writeFileSync(path.join(tmpDir, 'Song (2).pro'), 'data');

      const result = disambiguateFileName(tmpDir, 'Song', '.pro');
      expect(result).toBe(path.resolve(tmpDir, 'Song (3).pro'));
    });
  });

  describe('formatCliWarning', () => {
    it('formats warning message with uppercase severity and code', () => {
      const formatted = formatCliWarning({
        code: 'VPC_TAG_UNMAPPED',
        severity: 'warn',
        message: 'Unmapped tag detected',
      });
      expect(formatted).toBe('[WARN] (VPC_TAG_UNMAPPED) Unmapped tag detected');
    });

    it('formats info severity warning', () => {
      const formatted = formatCliWarning({
        code: 'INFO_CODE',
        severity: 'info',
        message: 'Informational message',
      });
      expect(formatted).toBe('[INFO] (INFO_CODE) Informational message');
    });

    it('formats error severity warning', () => {
      const formatted = formatCliWarning({
        code: 'ERR_CODE',
        severity: 'error',
        message: 'Error message',
      });
      expect(formatted).toBe('[ERROR] (ERR_CODE) Error message');
    });
  });
});

describe('CLI argument parsing', () => {
  describe('help command', () => {
    it('handles --help flag', () => {
      const res = parseCliArgs(['--help']);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.command.kind).toBe('help');
        expect(res.command.text).toContain('Usage:');
      }
    });

    it('handles -h flag', () => {
      const res = parseCliArgs(['-h']);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.command.kind).toBe('help');
      }
    });

    it('handles help subcommand', () => {
      const res = parseCliArgs(['help']);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.command.kind).toBe('help');
      }
    });

    it('defaults to help when no arguments provided', () => {
      const res = parseCliArgs([]);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.command.kind).toBe('help');
      }
    });

    it('handles --help alongside subcommands', () => {
      const res = parseCliArgs(['convert', '--help']);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.command.kind).toBe('help');
      }
    });
  });

  describe('formats command', () => {
    it('parses formats subcommand without flags', () => {
      const res = parseCliArgs(['formats']);
      expect(res).toEqual({
        ok: true,
        command: { kind: 'formats', json: false },
      });
    });

    it('parses formats subcommand with --json', () => {
      const res = parseCliArgs(['formats', '--json']);
      expect(res).toEqual({
        ok: true,
        command: { kind: 'formats', json: true },
      });
    });

    it('rejects unexpected positional arguments', () => {
      const res = parseCliArgs(['formats', 'extra']);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('Unexpected argument: "extra"');
      }
    });
  });

  describe('inspect command', () => {
    it('parses inspect subcommand with input file', () => {
      const res = parseCliArgs(['inspect', 'song.pro']);
      expect(res).toEqual({
        ok: true,
        command: { kind: 'inspect', input: 'song.pro', json: false },
      });
    });

    it('parses inspect subcommand with --json flag', () => {
      const res = parseCliArgs(['inspect', 'song.pro', '--json']);
      expect(res).toEqual({
        ok: true,
        command: { kind: 'inspect', input: 'song.pro', json: true },
      });
    });

    it('rejects extra positional arguments', () => {
      const res = parseCliArgs(['inspect', 'song.pro', 'extra.pro']);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('Unexpected argument: "extra.pro"');
      }
    });

    it('fails when inspect is missing input file', () => {
      const res = parseCliArgs(['inspect']);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/input file/i);
      }
    });
  });

  describe('convert command', () => {
    it('parses convert subcommand with required flags', () => {
      const res = parseCliArgs(['convert', 'input.vpc', '-t', 'pro']);
      expect(res).toEqual({
        ok: true,
        command: {
          kind: 'convert',
          input: 'input.vpc',
          to: 'pro',
          force: false,
          strict: false,
          json: false,
        },
      });
    });

    it('parses all convert options with long flags', () => {
      const res = parseCliArgs([
        'convert',
        'input.vpc',
        '--to',
        'pro',
        '--out',
        'output.pro',
        '--force',
        '--strict',
        '--song',
        '1',
        '--split',
        'output-dir',
        '--json',
      ]);
      expect(res).toEqual({
        ok: true,
        command: {
          kind: 'convert',
          input: 'input.vpc',
          to: 'pro',
          out: 'output.pro',
          force: true,
          strict: true,
          song: '1',
          split: 'output-dir',
          json: true,
        },
      });
    });

    it('parses all convert options with short flags', () => {
      const res = parseCliArgs([
        'convert',
        'input.vpc',
        '-t',
        'pro',
        '-o',
        'output.pro',
        '-f',
      ]);
      expect(res).toEqual({
        ok: true,
        command: {
          kind: 'convert',
          input: 'input.vpc',
          to: 'pro',
          out: 'output.pro',
          force: true,
          strict: false,
          json: false,
        },
      });
    });

    it('fails when convert is missing input file', () => {
      const res = parseCliArgs(['convert']);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/input file/i);
      }
    });

    it('fails when convert is missing -t / --to flag', () => {
      const res = parseCliArgs(['convert', 'input.vpc']);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/--to|-t/i);
      }
    });

    it('rejects extra positional arguments with subcommand', () => {
      const res = parseCliArgs(['convert', 'a.vpc', 'b.vpc', '-t', 'pro']);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('Unexpected argument: "b.vpc"');
      }
    });

    it('normalizes "show" target format to "freeshow"', () => {
      const res = parseCliArgs(['convert', 'input.vpc', '-t', 'show']);
      expect(res.ok).toBe(true);
      if (res.ok && res.command.kind === 'convert') {
        expect(res.command.to).toBe('freeshow');
      }
    });
  });

  describe('root shorthand conversion', () => {
    it('parses input and -t as default convert command', () => {
      const res = parseCliArgs(['input.vpc', '-t', 'pro']);
      expect(res).toEqual({
        ok: true,
        command: {
          kind: 'convert',
          input: 'input.vpc',
          to: 'pro',
          force: false,
          strict: false,
          json: false,
        },
      });
    });

    it('parses shorthand with --to and other flags', () => {
      const res = parseCliArgs(['input.vpc', '--to', 'txt', '-o', 'out.txt', '-f', '--strict']);
      expect(res).toEqual({
        ok: true,
        command: {
          kind: 'convert',
          input: 'input.vpc',
          to: 'txt',
          out: 'out.txt',
          force: true,
          strict: true,
          json: false,
        },
      });
    });

    it('rejects extra positional arguments in root shorthand', () => {
      const res = parseCliArgs(['a.vpc', 'out.pro', '-t', 'pro']);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('Unexpected argument: "out.pro"');
      }
    });

    it('normalizes "show" target format to "freeshow" in shorthand', () => {
      const res = parseCliArgs(['input.vpc', '-t', 'show']);
      expect(res.ok).toBe(true);
      if (res.ok && res.command.kind === 'convert') {
        expect(res.command.to).toBe('freeshow');
      }
    });
  });

  describe('batch command', () => {
    it('parses batch command with required flags', () => {
      const res = parseCliArgs(['batch', 'input.vpc', '-t', 'pro', '-o', 'out-dir']);
      expect(res).toEqual({
        ok: true,
        command: {
          kind: 'batch',
          inputs: ['input.vpc'],
          to: 'pro',
          out: 'out-dir',
          recursive: false,
          onCollision: 'rename',
          strict: false,
          json: false,
        },
      });
    });

    it('parses multiple inputs in batch command', () => {
      const res = parseCliArgs([
        'batch',
        'file1.pro',
        'file2.vpc',
        'folder',
        '-t',
        'txt',
        '-o',
        'out',
      ]);
      expect(res.ok).toBe(true);
      if (res.ok && res.command.kind === 'batch') {
        expect(res.command.inputs).toEqual(['file1.pro', 'file2.vpc', 'folder']);
      }
    });

    it('parses bare --combine flag as boolean', () => {
      const res = parseCliArgs(['batch', 'folder', '-t', 'pptx', '-o', 'out', '--combine']);
      expect(res.ok).toBe(true);
      if (res.ok && res.command.kind === 'batch') {
        expect(res.command.combine).toBe(true);
        expect(res.command.combineName).toBeUndefined();
      }
    });

    it('parses --combine with deck name', () => {
      const res = parseCliArgs([
        'batch',
        'folder',
        '-t',
        'pptx',
        '-o',
        'out',
        '--combine',
        'SundayService',
      ]);
      expect(res.ok).toBe(true);
      if (res.ok && res.command.kind === 'batch') {
        expect(res.command.combine).toBe('SundayService');
        expect(res.command.combineName).toBe('SundayService');
      }
    });

    it('parses --combine=<name> syntax', () => {
      const res = parseCliArgs([
        'batch',
        'folder',
        '-t',
        'pptx',
        '-o',
        'out',
        '--combine=MyDeck',
      ]);
      expect(res.ok).toBe(true);
      if (res.ok && res.command.kind === 'batch') {
        expect(res.command.combine).toBe('MyDeck');
        expect(res.command.combineName).toBe('MyDeck');
      }
    });

    it('parses --library mapping to libraryName', () => {
      const res = parseCliArgs(['batch', 'folder', '-t', 'pro', '-o', 'out', '--library', 'MyLib']);
      expect(res.ok).toBe(true);
      if (res.ok && res.command.kind === 'batch') {
        expect(res.command.libraryName).toBe('MyLib');
      }
    });

    it('parses -r and --recursive flag', () => {
      const resShort = parseCliArgs(['batch', 'folder', '-t', 'pro', '-o', 'out', '-r']);
      expect(resShort.ok).toBe(true);
      if (resShort.ok && resShort.command.kind === 'batch') {
        expect(resShort.command.recursive).toBe(true);
      }

      const resLong = parseCliArgs(['batch', 'folder', '-t', 'pro', '-o', 'out', '--recursive']);
      expect(resLong.ok).toBe(true);
      if (resLong.ok && resLong.command.kind === 'batch') {
        expect(resLong.command.recursive).toBe(true);
      }
    });

    it('parses --on-collision policy', () => {
      const policies = ['rename', 'skip', 'overwrite', 'error'] as const;
      for (const policy of policies) {
        const res = parseCliArgs(['batch', 'folder', '-t', 'pro', '-o', 'out', '--on-collision', policy]);
        expect(res.ok).toBe(true);
        if (res.ok && res.command.kind === 'batch') {
          expect(res.command.onCollision).toBe(policy);
        }
      }
    });

    it('rejects invalid --on-collision policy', () => {
      const res = parseCliArgs(['batch', 'folder', '-t', 'pro', '-o', 'out', '--on-collision', 'invalid']);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/invalid --on-collision/i);
      }
    });

    it('maps -f / --force to onCollision "overwrite"', () => {
      const res = parseCliArgs(['batch', 'folder', '-t', 'pro', '-o', 'out', '-f']);
      expect(res.ok).toBe(true);
      if (res.ok && res.command.kind === 'batch') {
        expect(res.command.onCollision).toBe('overwrite');
      }
    });

    it('fails when batch is missing input file(s)', () => {
      const res = parseCliArgs(['batch', '-t', 'pro', '-o', 'out']);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/input file\(s\)/i);
      }
    });

    it('fails when batch is missing -t / --to flag', () => {
      const res = parseCliArgs(['batch', 'folder', '-o', 'out']);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/--to|-t/i);
      }
    });

    it('fails when batch is missing -o / --out flag', () => {
      const res = parseCliArgs(['batch', 'folder', '-t', 'pro']);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/--out|-o/i);
      }
    });

    it('rejects --combine with pro or txt format', () => {
      const resPro = parseCliArgs(['batch', 'folder', '-t', 'pro', '-o', 'out', '--combine']);
      expect(resPro.ok).toBe(false);
      if (!resPro.ok) {
        expect(resPro.error).toMatch(/combine/i);
      }

      const resTxt = parseCliArgs(['batch', 'folder', '-t', 'txt', '-o', 'out', '--combine']);
      expect(resTxt.ok).toBe(false);
      if (!resTxt.ok) {
        expect(resTxt.error).toMatch(/combine/i);
      }
    });

    it('rejects --library with target format other than pro', () => {
      const res = parseCliArgs(['batch', 'folder', '-t', 'pptx', '-o', 'out', '--library', 'Lib']);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/library/i);
      }
    });

    it('rejects --combine and --library together', () => {
      const res = parseCliArgs([
        'batch',
        'folder',
        '-t',
        'pro',
        '-o',
        'out',
        '--combine',
        '--library',
        'Lib',
      ]);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/mutually exclusive/i);
      }
    });

    it('rejects --combine option in convert command', () => {
      const res = parseCliArgs(['convert', 'file.vpc', '-t', 'pro', '--combine']);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/unknown option/i);
      }
    });
  });

  describe('error handling', () => {
    it('fails on unknown command', () => {
      const res = parseCliArgs(['unknown-command']);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/unknown command/i);
      }
    });

    it('fails on unknown option', () => {
      const res = parseCliArgs(['formats', '--unrecognized-flag']);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/unknown option/i);
      }
    });
  });
});
