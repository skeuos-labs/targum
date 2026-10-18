import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  convertFile,
  exportPresentation,
  importFile,
  type Presentation,
} from '../../src/index.js';
import { computeTokenCoverage } from '../helpers/token-coverage.js';

const ASSETS_DIR = resolve(
  import.meta.dirname,
  '../../../assets-for-testing-purpose'
);

function readAsset(fileName: string): Uint8Array {
  const filePath = resolve(ASSETS_DIR, fileName);
  if (!existsSync(filePath)) {
    throw new Error(`Asset file not found: ${filePath}`);
  }
  return new Uint8Array(readFileSync(filePath));
}

describe('Real-World Corpus Import Suite', () => {
  it('imports IZY-original.pro: 17 slides, 3 sections, title parsed', async () => {
    const bytes = readAsset('IZY-original.pro');
    const res = await importFile(bytes, 'IZY-original.pro');

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.presentations).toHaveLength(1);
    const pres = res.value.presentations[0]!;

    expect(pres.title).toBe('IZY');
    expect(pres.slides).toHaveLength(17);
    expect(pres.sections).toHaveLength(3);
  });

  it('imports Androany aloha.pro: 23 slides, 6 sections, title parsed', async () => {
    const bytes = readAsset('Androany aloha.pro');
    const res = await importFile(bytes, 'Androany aloha.pro');

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.presentations).toHaveLength(1);
    const pres = res.value.presentations[0]!;

    expect(pres.title).toBe('Androany aloha');
    expect(pres.slides).toHaveLength(23);
    expect(pres.sections).toHaveLength(6);
  });

  it('imports Thank You Jesus for The Blood.pro: 28 slides, 6 sections, title parsed', async () => {
    const bytes = readAsset('Thank You Jesus for The Blood.pro');
    const res = await importFile(bytes, 'Thank You Jesus for The Blood.pro');

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.presentations).toHaveLength(1);
    const pres = res.value.presentations[0]!;

    expect(pres.title).toBe('Thank You Jesus for The Blood');
    expect(pres.slides).toHaveLength(28);
    expect(pres.sections).toHaveLength(6);
  });

  it('imports Cevam.vpc: 1 presentation, 47 slides, title parsed', async () => {
    const bytes = readAsset('Cevam.vpc');
    const res = await importFile(bytes, 'Cevam.vpc');

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.presentations).toHaveLength(1);
    const pres = res.value.presentations[0]!;

    expect(pres.title).toBe('IZY');
    expect(pres.slides).toHaveLength(47);
  });

  it('imports façade.vpc: 19 presentations, 273 slides total', async () => {
    const bytes = readAsset('façade.vpc');
    const res = await importFile(bytes, 'façade.vpc');

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.presentations).toHaveLength(19);
    const totalSlides = res.value.presentations.reduce(
      (sum, p) => sum + p.slides.length,
      0
    );
    expect(totalSlides).toBe(273);

    for (const p of res.value.presentations) {
      expect(p.title).toBeTruthy();
      expect(p.slides.length).toBeGreaterThan(0);
    }
  });

  it('imports FFPM 2 - Antema.vpc: 274 presentations, 1,974 slides total', async () => {
    const bytes = readAsset('FFPM 2 - Antema.vpc');
    const res = await importFile(bytes, 'FFPM 2 - Antema.vpc');

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.presentations).toHaveLength(274);
    const totalSlides = res.value.presentations.reduce(
      (sum, p) => sum + p.slides.length,
      0
    );
    expect(totalSlides).toBe(1974);

    for (const p of res.value.presentations) {
      expect(p.title).toBeTruthy();
    }
  });

  it('imports Marble Flow ProPresenter Template.pro6: 24 slides, 1 section', async () => {
    const bytes = readAsset('Marble Flow ProPresenter Template.pro6');
    const res = await importFile(bytes, 'Marble Flow ProPresenter Template.pro6');

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.presentations).toHaveLength(1);
    const pres = res.value.presentations[0]!;

    expect(pres.title).toBe('Marble Flow ProPresenter Template');
    expect(pres.slides).toHaveLength(24);
    expect(pres.sections).toHaveLength(1);
  });

  it('imports IZY.txt: title and lyrics parsed', async () => {
    const bytes = readAsset('IZY.txt');
    const res = await importFile(bytes, 'IZY.txt');

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.presentations).toHaveLength(1);
    const pres = res.value.presentations[0]!;

    expect(pres.title).toBe("Izy mamatsy ahy isan'andro");
    expect(pres.slides.length).toBeGreaterThan(0);

    const allLyrics = pres.slides
      .flatMap((s) => s.items.map((i) => i.plainText))
      .join('\n');
    expect(allLyrics.length).toBeGreaterThan(0);
    expect(allLyrics).toContain('Jehovah Jireh');
  });

  if (existsSync(resolve(ASSETS_DIR, 'Hymn.pptx'))) {
    it('imports Hymn.pptx faithfully via importFile', async () => {
      const bytes = readAsset('Hymn.pptx');
      const res = await importFile(bytes, 'Hymn.pptx');

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.presentations).toHaveLength(2);
      const pres = res.value.presentations[0]!;
      expect(pres.title).toBe('How Great Thou Art');
      expect(pres.slides.length).toBeGreaterThan(0);
    });
  }
});

describe('Real-World Corpus Cross-Conversion Suite', () => {
  it('converts IZY-original.pro to .vpc and re-imports with >= 90% token coverage', async () => {
    const izyBytes = readAsset('IZY-original.pro');
    const origImport = await importFile(izyBytes, 'IZY-original.pro');
    expect(origImport.ok).toBe(true);
    if (!origImport.ok) return;
    const origPres = origImport.value.presentations[0]!;

    // Convert .pro -> .vpc
    const vpcRes = await convertFile(izyBytes, 'IZY-original.pro', 'vpc');
    expect(vpcRes.ok).toBe(true);
    if (!vpcRes.ok) return;
    expect(vpcRes.value.bytes.byteLength).toBeGreaterThan(0);

    // Re-import from .vpc
    const reimported = await importFile(vpcRes.value.bytes, 'IZY-original.vpc');
    expect(reimported.ok).toBe(true);
    if (!reimported.ok) return;
    expect(reimported.value.presentations).toHaveLength(1);
    const convertedPres = reimported.value.presentations[0]!;

    // Verify token coverage >= 90%
    const coverage = computeTokenCoverage(origPres, convertedPres);
    expect(coverage).toBeGreaterThanOrEqual(0.9);
    expect(convertedPres.slides.length).toBeGreaterThan(0);
    expect(convertedPres.sections.length).toBeGreaterThan(0);
  });

  it('converts Cevam.vpc song 1 to .pro and re-imports with >= 90% token coverage', async () => {
    const cevamBytes = readAsset('Cevam.vpc');
    const cevamImport = await importFile(cevamBytes, 'Cevam.vpc');
    expect(cevamImport.ok).toBe(true);
    if (!cevamImport.ok) return;
    const song1 = cevamImport.value.presentations[0]!;

    // Convert song 1 to .pro via exportPresentation
    const proExport = await exportPresentation(song1, 'pro');
    expect(proExport.ok).toBe(true);
    if (!proExport.ok) return;
    expect(proExport.value.bytes.byteLength).toBeGreaterThan(0);

    // Re-import from .pro
    const proImport = await importFile(proExport.value.bytes, 'Cevam-song1.pro');
    expect(proImport.ok).toBe(true);
    if (!proImport.ok) return;
    expect(proImport.value.presentations).toHaveLength(1);
    const reimportedPres = proImport.value.presentations[0]!;

    // Verify token coverage >= 90%
    const coverage = computeTokenCoverage(song1, reimportedPres);
    expect(coverage).toBeGreaterThanOrEqual(0.9);
    expect(reimportedPres.slides.length).toBeGreaterThan(0);
    expect(reimportedPres.sections.length).toBeGreaterThan(0);
  });

  it('converts IZY-original.pro to .txt, .show, and .pptx', async () => {
    const izyBytes = readAsset('IZY-original.pro');

    // 1. Convert to .txt
    const txtRes = await convertFile(izyBytes, 'IZY-original.pro', 'txt');
    expect(txtRes.ok).toBe(true);
    if (!txtRes.ok) return;
    expect(txtRes.value.bytes.byteLength).toBeGreaterThan(0);

    const txtImport = await importFile(txtRes.value.bytes, 'IZY.txt');
    expect(txtImport.ok).toBe(true);
    if (txtImport.ok) {
      expect(txtImport.value.presentations[0]!.slides.length).toBeGreaterThan(0);
    }

    // 2. Convert to .show (FreeShow)
    const showRes = await convertFile(izyBytes, 'IZY-original.pro', 'freeshow');
    expect(showRes.ok).toBe(true);
    if (!showRes.ok) return;
    expect(showRes.value.bytes.byteLength).toBeGreaterThan(0);

    const showImport = await importFile(showRes.value.bytes, 'IZY.show');
    expect(showImport.ok).toBe(true);
    if (showImport.ok) {
      expect(showImport.value.presentations[0]!.slides.length).toBeGreaterThan(0);
    }

    // 3. Convert to .pptx (PowerPoint)
    const pptxRes = await convertFile(izyBytes, 'IZY-original.pro', 'pptx');
    expect(pptxRes.ok).toBe(true);
    if (!pptxRes.ok) return;
    expect(pptxRes.value.bytes.byteLength).toBeGreaterThan(0);

    const pptxImport = await importFile(pptxRes.value.bytes, 'IZY.pptx');
    expect(pptxImport.ok).toBe(true);
    if (pptxImport.ok) {
      expect(pptxImport.value.presentations[0]!.slides.length).toBeGreaterThan(0);
    }
  });

  it('handles non-fatal warnings cleanly without throwing or exiting', async () => {
    const izyBytes = readAsset('IZY-original.pro');
    const vpcRes = await convertFile(izyBytes, 'IZY-original.pro', 'vpc');

    expect(vpcRes.ok).toBe(true);
    if (vpcRes.ok) {
      expect(Array.isArray(vpcRes.warnings)).toBe(true);
      // Non-fatal warnings should have code, severity, message
      for (const w of vpcRes.warnings) {
        expect(w.code).toBeTruthy();
        expect(['info', 'warn', 'error']).toContain(w.severity);
        expect(w.message).toBeTruthy();
      }
    }
  });
});
