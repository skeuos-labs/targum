import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI_PATH = path.resolve(process.cwd(), 'dist/cli/index.js');
const ASSETS_DIR = path.resolve(
  import.meta.dirname,
  '../../../assets-for-testing-purpose',
);
const IZY_PRO = path.resolve(ASSETS_DIR, 'IZY-original.pro');
const FACADE_VPC = path.resolve(ASSETS_DIR, 'façade.vpc');
const TMP_DIR = path.resolve(process.cwd(), 'tmp-e2e');

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

describe('CLI Binary End-to-End Suite', () => {
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

  it('prints help and exits 0 with --help flag', () => {
    const res = runCli(['--help']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Show Converter — CLI worship presentation conversion utility');
    expect(res.stdout).toContain('Usage:');
    expect(res.stdout).toContain('Commands:');
    expect(res.stderr).toBe('');
  });

  it('formats command exits 0 and lists all 7 supported formats in human table', () => {
    const res = runCli(['formats']);
    expect(res.status).toBe(0);
    const expected = ['pro', 'pro6', 'vpc', 'json', 'freeshow', 'txt', 'pptx'];
    for (const fmt of expected) {
      expect(res.stdout).toContain(fmt);
    }
    expect(res.stderr).toBe('');
  });

  it('formats --json outputs parseable JSON array of format definitions', () => {
    const res = runCli(['formats', '--json']);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(7);
    expect(parsed.map((f: { id: string }) => f.id)).toEqual(
      expect.arrayContaining(['pro', 'pro6', 'vpc', 'json', 'freeshow', 'txt', 'pptx']),
    );
    expect(res.stderr).toBe('');
  });

  it('inspects presentation and outputs slide summary to stdout with exit 0', () => {
    const res = runCli(['inspect', IZY_PRO]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('File:');
    expect(res.stdout).toContain('IZY-original.pro');
    expect(res.stdout).toContain('Format: ProPresenter 7+ (pro)');
    expect(res.stdout).toContain('Total Slides: 17');
  });

  it('inspects presentation with --json emitting valid canonical Library JSON', () => {
    const res = runCli(['inspect', IZY_PRO, '--json']);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed).toHaveProperty('presentations');
    expect(Array.isArray(parsed.presentations)).toBe(true);
    expect(parsed.presentations[0].title).toBe('IZY');
  });

  it('converts presentation (.pro -> .vpc) via convert subcommand and writes target file', () => {
    const outFile = path.resolve(TMP_DIR, 'e2e.vpc');
    const res = runCli(['convert', IZY_PRO, '-t', 'vpc', '-o', outFile, '-f']);
    expect(res.status).toBe(0);
    expect(fs.existsSync(outFile)).toBe(true);
    expect(res.stdout).toContain(outFile);
  });

  it('converts presentation via root shorthand command (.pro -> .txt) and writes target file', () => {
    const outFile = path.resolve(TMP_DIR, 'e2e.txt');
    const res = runCli([IZY_PRO, '-t', 'txt', '-o', outFile, '-f']);
    expect(res.status).toBe(0);
    expect(fs.existsSync(outFile)).toBe(true);
    expect(res.stdout).toContain(outFile);
  });

  it('converts presentation using "show" alias for freeshow format and writes .show file', () => {
    const outFile = path.resolve(TMP_DIR, 'e2e.show');
    const res = runCli([IZY_PRO, '-t', 'show', '-o', outFile, '-f']);
    expect(res.status).toBe(0);
    expect(fs.existsSync(outFile)).toBe(true);
    expect(res.stdout).toContain(outFile);
  });

  it('exits with code 3 when input file does not exist', () => {
    const res = runCli(['inspect', 'missing-presentation-file.pro']);
    expect(res.status).toBe(3);
    expect(res.stderr).toContain('not found');
  });

  it('exits with code 3 when converting without -f if output file already exists', () => {
    const outFile = path.resolve(TMP_DIR, 'existing-output.vpc');
    fs.writeFileSync(outFile, 'pre-existing content');
    const res = runCli(['convert', IZY_PRO, '-t', 'vpc', '-o', outFile]);
    expect(res.status).toBe(3);
    expect(res.stderr).toContain(`Output file already exists: ${outFile}. Use --force / -f to overwrite.`);
  });

  it('exits with code 1 when --strict is passed on a file with formatting warnings', () => {
    const outFile = path.resolve(TMP_DIR, 'strict-warning.vpc');
    const res = runCli(['convert', IZY_PRO, '-t', 'vpc', '-o', outFile, '--strict', '-f']);
    expect(res.status).toBe(1);
    expect(fs.existsSync(outFile)).toBe(true);
    expect(res.stderr).toContain('VPC_TAG_UNMAPPED');
  });

  it('exits with code 3 when required -t flag is missing in convert', () => {
    const res = runCli(['convert', IZY_PRO]);
    expect(res.status).toBe(3);
    expect(res.stderr).toMatch(/--to|-t/i);
  });

  it('exits with code 2 when multi-song container is converted to single-song format without --split or --song', () => {
    const res = runCli([FACADE_VPC, '-t', 'pro']);
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('contains 19 songs, but target format "pro" only supports 1 song per file');
  });

  it('unpacks 19 presentations into directory when multi-song container is converted with --split', () => {
    const splitDir = path.resolve(TMP_DIR, 'split');
    const res = runCli([FACADE_VPC, '-t', 'pro', '--split', splitDir]);
    expect(res.status).toBe(0);
    expect(fs.existsSync(splitDir)).toBe(true);

    const files = fs.readdirSync(splitDir);
    expect(files.length).toBe(19);
    for (const f of files) {
      expect(f.endsWith('.pro')).toBe(true);
    }
  });

  it('resolves output file inside existing directory when -o points to directory', () => {
    const res = runCli(['convert', IZY_PRO, '-t', 'vpc', '-o', TMP_DIR, '-f']);
    expect(res.status).toBe(0);
    const expectedTarget = path.resolve(TMP_DIR, 'IZY-original.vpc');
    expect(fs.existsSync(expectedTarget)).toBe(true);
  });

  it('falls back to case-insensitive substring match for --song flag', () => {
    const outFile = path.resolve(TMP_DIR, 'song-match.pro');
    // Title in façade.vpc is "Mendrika ianao", query is substring "mendrika"
    const res = runCli([FACADE_VPC, '-t', 'pro', '--song', 'mendrika', '-o', outFile, '-f']);
    expect(res.status).toBe(0);
    expect(fs.existsSync(outFile)).toBe(true);
  });

  it('exits with code 3 when extra positional arguments are passed', () => {
    const resFormats = runCli(['formats', 'extra']);
    expect(resFormats.status).toBe(3);
    expect(resFormats.stderr).toContain('Unexpected argument: "extra"');

    const resInspect = runCli(['inspect', IZY_PRO, 'extra.pro']);
    expect(resInspect.status).toBe(3);
    expect(resInspect.stderr).toContain('Unexpected argument: "extra.pro"');

    const resConvert = runCli(['convert', IZY_PRO, 'extra.pro', '-t', 'vpc']);
    expect(resConvert.status).toBe(3);
    expect(resConvert.stderr).toContain('Unexpected argument: "extra.pro"');

    const resShorthand = runCli([IZY_PRO, 'extra.pro', '-t', 'vpc']);
    expect(resShorthand.status).toBe(3);
    expect(resShorthand.stderr).toContain('Unexpected argument: "extra.pro"');
  });
});
