# Conversion Engine (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a robust, pure TypeScript conversion engine for church worship presentations supporting ProPresenter (`.pro`, `.pro6`), VideoPsalm (`.vpc`, `.json`), FreeShow (`.show`), TXT, and PowerPoint (`.pptx`), with zero GUI or desktop framework dependencies.

**Architecture:** Single npm package (`show-converter-engine`) using an intermediate canonical model (`Presentation`, `Library`, `Slide`, `Section`) with Zod validation. Each format codec lives in an isolated directory under `src/formats/` implementing `importBytes` and/or `exportBytes`. A centralized pipeline and detector module mediates all conversions and collects structured non-fatal `Warning` diagnostics.

**Tech Stack:** Node.js 20+ (ESM), TypeScript 5.x, Vitest, Zod, protobufjs, @zip.js/zip.js, fast-xml-parser, jszip.

**Spec:** `docs/superpowers/specs/2026-10-17-conversion-engine-design.md`

## Global Constraints

- Runtime: Standard Node.js ESM. Zero Electron, Tauri, React, or DOM dependencies.
- Language & Typing: Strict TypeScript (`strict: true`, `noImplicitAny: true`, `target: ES2022`, `moduleResolution: NodeNext`).
- Result Pattern: Handlers return `Result<T>` (`{ ok: true, value: T, warnings: Warning[] } | { ok: false, error: Error }`). Unhandled exceptions never leak out of top-level APIs.
- VideoPsalm AES Key: Fixed universal string constant `VPC_KEY` in `src/formats/videopsalm/key.ts`. No prompt, no config file, no override parameter.
- ProPresenter 7 Contract: Default canvas `1920x1080`, full text box geometry (`bounds`, normalized 4-point rect path), font attributes (`Helvetica`, size 48), `isEnabled: true`, action `type: "ACTION_TYPE_PRESENTATION_SLIDE"`.
- FreeShow Provenance: Clean-room JSON mapping (MIT). Zero GPL-3.0 source code copied.
- License & Attribution: All code authored under MIT. No AI attribution or Claude references in Git commit author fields.

## Review Focus

- Malformed / corrupted input bytes in any format (e.g. truncated ZIP, bad Protobuf wire bytes, invalid XML): Must return `{ ok: false, error: Error }`, never unhandled crash or process exit.
- Empty presentations (zero slides, zero text): Must fail closed or serialize cleanly with warning, never throw `undefined` access errors.
- Non-Latin and accented character encodings (UTF-8, RTF hex escapes `\'xx`, CP1252): Must decode and round-trip without corruption.
- Multi-song container boundaries: Single-song exporters (`.pro`, `.pro6`) must reject multi-song libraries with an explicit error; multi-song exporters (`.vpc`, `.show`, `.pptx`) must serialize all songs cleanly.
- Dangling slide references in sections or arrangements: Must be detected, recorded as structured warnings (`SECTION_DANGLING_SLIDE`, `ARRANGEMENT_DANGLING_SLIDE`), and pruned safely during export.

---

### Task 1: Project Scaffolding & Tooling Setup

**Files:**
- Create: `show-converter/.gitignore`
- Create: `show-converter/package.json`
- Create: `show-converter/tsconfig.json`
- Create: `show-converter/vitest.config.ts`

**Interfaces:**
- Produces: Runnable Node.js ESM project with `npm test`, `npm run build`, and Vitest test runner.

- [ ] **Step 1: Write `.gitignore`**

```text
node_modules/
dist/
*.log
.DS_Store
```

- [ ] **Step 2: Write `package.json`**

Configure name `show-converter-engine`, type `module`, dependencies (`zod`, `protobufjs`, `@zip.js/zip.js`, `fast-xml-parser`, `jszip`), devDependencies (`typescript`, `@types/node`, `vitest`).

- [ ] **Step 3: Write `tsconfig.json` and `vitest.config.ts`**

Configure target `ES2022`, module `NodeNext`, moduleResolution `NodeNext`, strict `true`, outDir `dist`. Configure Vitest with Node environment.

- [ ] **Step 4: Install dependencies and verify environment**

Run: `npm install` inside `show-converter/`
Expected: Dependencies installed, lockfile generated.

- [ ] **Step 5: Run vitest to ensure runner works**

Run: `npx vitest run` inside `show-converter/`
Expected: 0 tests found / pass.

- [ ] **Step 6: Commit**

```bash
git add .gitignore package.json package-lock.json tsconfig.json vitest.config.ts
git commit -m "chore: scaffold project tooling, typescript and vitest configuration"
```

---

### Task 2: Canonical Presentation Model & Validators

**Files:**
- Create: `show-converter/src/canonical/id.ts`
- Create: `show-converter/src/canonical/warnings.ts`
- Create: `show-converter/src/canonical/types.ts`
- Create: `show-converter/src/canonical/schema.ts`
- Create: `show-converter/src/canonical/normalize.ts`
- Create: `show-converter/src/canonical/index.ts`
- Test: `show-converter/test/unit/canonical.test.ts`

**Interfaces:**
- Produces: `Presentation`, `Library`, `Slide`, `Section`, `Arrangement`, `Warning`, `parsePresentation()`, `validateReferences()`, `randomUUID()`.

- [ ] **Step 1: Write failing unit tests for canonical schemas and normalizer**

Test schema parsing, dangling slide detection, plain-text derivation from richText, and warnings creation.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/canonical.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `id.ts`, `warnings.ts`, `types.ts`, `schema.ts`, `normalize.ts`, and `index.ts`**

Implement UUID wrapper using `node:crypto.randomUUID()`. Implement Zod schemas matching Spec §3.1. Implement reference validator and text normalizer.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/canonical.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/canonical/ test/unit/canonical.test.ts
git commit -m "feat(canonical): implement canonical presentation schema and normalizers"
```

---

### Task 3: Deterministic Baseline Fixture ("Amazing Grace")

**Files:**
- Create: `show-converter/src/fixtures/amazing-grace.ts`
- Test: `show-converter/test/unit/fixture.test.ts`

**Interfaces:**
- Produces: `AMAZING_GRACE: Presentation`, public-domain baseline presentation (John Newton, 1779, CCLI 22025, 4 verses, 1 synthetic chorus, 9 slides, 2 arrangements).

- [ ] **Step 1: Write failing test verifying fixture structure**

Verify slide count (9), section count (5: 4 Verses + 1 Chorus), arrangements ("Standard" and "Short"), title, author, and CCLI.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/fixture.test.ts`
Expected: FAIL (fixture not defined).

- [ ] **Step 3: Implement `src/fixtures/amazing-grace.ts`**

Construct deterministic `Presentation` using `parsePresentation()`. Ensure all slide IDs are well-formed and referenced cleanly by sections and arrangements.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/fixture.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/fixtures/ test/unit/fixture.test.ts
git commit -m "test(fixture): add deterministic Amazing Grace baseline canonical fixture"
```

---

### Task 4: ProPresenter RTF Codec

**Files:**
- Create: `show-converter/src/formats/propresenter/rtf.ts`
- Test: `show-converter/test/unit/rtf.test.ts`

**Interfaces:**
- Produces: `encodeRtf(plainText: string): Uint8Array`, `decodeRtf(rtf: string): string`, `decodeRtfBytes(bytes: Uint8Array): string`.

- [ ] **Step 1: Write failing unit tests for RTF encoder and decoder**

Test plain text to RTF byte round-trip, Unicode and hex escapes (`\'xx`), line breaks (`\par`), font table headers, and stripping of control words.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/rtf.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/formats/propresenter/rtf.ts`**

Implement lightweight, deterministic RTF tokenizer, font table handler, and plain text extractor/encoder.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/rtf.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/formats/propresenter/rtf.ts test/unit/rtf.test.ts
git commit -m "feat(propresenter): implement RTF text encoder and decoder"
```

---

### Task 5: ProPresenter 7 Protobuf Reader & Bundle Loader

**Files:**
- Create: `show-converter/src/formats/propresenter/protoBundle.json`
- Create: `show-converter/src/formats/propresenter/root.ts`
- Create: `show-converter/src/formats/propresenter/parse.ts`
- Test: `show-converter/test/unit/propresenter-parse.test.ts`

**Interfaces:**
- Consumes: `protoBundle.json` (vendored from greyshirtguy/ProPresenter7-Proto under MIT).
- Produces: `getProtoRoot(): Root`, `parsePro(bytes: Uint8Array, fileName?: string): Result<Presentation>`.

- [ ] **Step 1: Copy `protoBundle.json` and write failing tests for `parsePro`**

Test parsing real `.pro` fixtures from `assets-for-testing-purpose/` (`IZY-original.pro`, `Androany aloha.pro`). Test error handling on corrupt bytes.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/propresenter-parse.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `root.ts` and `parse.ts`**

Load `protoBundle.json` into protobufjs Root. Traverse `cues` -> `actions` -> `slide.presentation.baseSlide.elements`. Extract RTF lyrics using `decodeRtfBytes`. Reconstruct slides, sections, and metadata.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/propresenter-parse.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/formats/propresenter/ test/unit/propresenter-parse.test.ts
git commit -m "feat(propresenter): implement ProPresenter 7 Protobuf reader"
```

---

### Task 6: ProPresenter 7 Protobuf Writer

**Files:**
- Create: `show-converter/src/formats/propresenter/write.ts`
- Test: `show-converter/test/unit/propresenter-write.test.ts`

**Interfaces:**
- Consumes: `AMAZING_GRACE` fixture, `getProtoRoot()`, `encodeRtf()`.
- Produces: `writePro(presentation: Presentation): Result<{ bytes: Uint8Array, warnings: Warning[] }>`.

- [ ] **Step 1: Write failing tests for `writePro`**

Assert 1920x1080 slide size, bounds `{ origin: { x: 192, y: 270 }, size: { width: 1536, height: 540 } }`, 4-point rect path, Helvetica 48pt, `isEnabled: true`, `ACTION_TYPE_PRESENTATION_SLIDE`, and clean round-trip via `parsePro`.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/propresenter-write.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/formats/propresenter/write.ts`**

Map canonical slides, sections, and arrangements into PP7 Presentation message hierarchy matching verified reference contract.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/propresenter-write.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/formats/propresenter/write.ts test/unit/propresenter-write.test.ts
git commit -m "feat(propresenter): implement ProPresenter 7 Protobuf writer with 1080p geometry contract"
```

---

### Task 7: ProPresenter 6 XML Reader

**Files:**
- Create: `show-converter/src/formats/propresenter/pro6.ts`
- Create: `show-converter/src/formats/propresenter/index.ts`
- Test: `show-converter/test/unit/pro6.test.ts`

**Interfaces:**
- Produces: `parsePro6(bytes: Uint8Array, fileName?: string): Result<Presentation>`.

- [ ] **Step 1: Write failing test for `parsePro6`**

Test parsing `Marble Flow ProPresenter Template.pro6` from `assets-for-testing-purpose/` and synthetic XML snippets.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/pro6.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/formats/propresenter/pro6.ts` and `index.ts`**

Use `fast-xml-parser` to parse XML. Decode base64 RTF data from `RVDisplaySlide`. Map groups to sections and slides.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/pro6.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/formats/propresenter/pro6.ts src/formats/propresenter/index.ts test/unit/pro6.test.ts
git commit -m "feat(propresenter): implement ProPresenter 6 XML reader"
```

---

### Task 8: VideoPsalm JSON Dialect Codec

**Files:**
- Create: `show-converter/src/formats/videopsalm/json.ts`
- Test: `show-converter/test/unit/videopsalm-json.test.ts`

**Interfaces:**
- Produces: `parseLibraryJson(rawText: string, fileName?: string): Result<Library>`, `serializeDialect(value: unknown): string`.

- [ ] **Step 1: Write failing tests for VideoPsalm dialect parser and serializer**

Test unquoted property names, backslash-escaped quotes, tag-to-section mapping, and round-trip fidelity.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/videopsalm-json.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/formats/videopsalm/json.ts`**

Implement lenient JSON parser handling VideoPsalm quirks. Map `Tag` integers (1: Chorus, 2: Prechorus, 3: Bridge...) to section names. Implement `serializeDialect` producing VideoPsalm-compatible output.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/videopsalm-json.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/formats/videopsalm/json.ts test/unit/videopsalm-json.test.ts
git commit -m "feat(videopsalm): implement VideoPsalm JSON dialect parser and serializer"
```

---

### Task 9: VideoPsalm VPC Archive Reader & Writer

**Files:**
- Create: `show-converter/src/formats/videopsalm/key.ts`
- Create: `show-converter/src/formats/videopsalm/vpc.ts`
- Create: `show-converter/src/formats/videopsalm/write.ts`
- Create: `show-converter/src/formats/videopsalm/index.ts`
- Test: `show-converter/test/unit/videopsalm-vpc.test.ts`

**Interfaces:**
- Produces: `VPC_KEY`, `parseVpc(bytes: Uint8Array, fileName?: string): Promise<Result<Library>>`, `writeVpc(presentations: Presentation[]): Promise<Result<{ bytes: Uint8Array, warnings: Warning[] }>>`.

- [ ] **Step 1: Write failing tests for VPC reader and writer**

Test parsing `Cevam.vpc` and `façade.vpc`. Test exporting `AMAZING_GRACE` to VPC and re-importing. Test error on corrupt archive.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/videopsalm-vpc.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `key.ts`, `vpc.ts`, `write.ts`, and `index.ts`**

Use `@zip.js/zip.js` with `VPC_KEY` for AES-128 ZIP decryption/encryption. Extract/inject JSON entry. Connect to `parseLibraryJson` and `serializeDialect`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/videopsalm-vpc.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/formats/videopsalm/ test/unit/videopsalm-vpc.test.ts
git commit -m "feat(videopsalm): implement VideoPsalm VPC AES-128 ZIP reader and writer"
```

---

### Task 10: FreeShow `.show` Codec

**Files:**
- Create: `show-converter/src/formats/freeshow/codec.ts`
- Create: `show-converter/src/formats/freeshow/index.ts`
- Test: `show-converter/test/unit/freeshow.test.ts`

**Interfaces:**
- Produces: `parseFreeShow(bytes: Uint8Array, fileName?: string): Promise<Result<Library>>`, `writeFreeShow(library: Library): Promise<Result<{ bytes: Uint8Array, warnings: Warning[] }>>`.

- [ ] **Step 1: Write failing tests for FreeShow import/export**

Test clean-room JSON mapping: slides, groups -> sections, title, author. Test export of `AMAZING_GRACE` and round-trip parsing.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/freeshow.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/formats/freeshow/codec.ts` and `index.ts`**

Clean-room FreeShow `.show` format parser and generator.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/freeshow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/formats/freeshow/ test/unit/freeshow.test.ts
git commit -m "feat(freeshow): implement clean-room FreeShow show codec"
```

---

### Task 11: TXT Lyric Marker Codec

**Files:**
- Create: `show-converter/src/formats/txt/codec.ts`
- Create: `show-converter/src/formats/txt/index.ts`
- Test: `show-converter/test/unit/txt.test.ts`

**Interfaces:**
- Produces: `parseTxt(bytes: Uint8Array, fileName?: string): Result<Library>`, `writeTxt(library: Library): Result<{ bytes: Uint8Array, warnings: Warning[] }>`.

- [ ] **Step 1: Write failing tests for TXT codec**

Test parsing `IZY.txt` from `assets-for-testing-purpose/`. Test marker syntax (`[Verse 1]`, `[Chorus]`), double-break slide splitting, and formatted text output.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/txt.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/formats/txt/codec.ts` and `index.ts`**

Parse lyrics text with section headers. Generate structured lyric files with metadata comments.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/txt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/formats/txt/ test/unit/txt.test.ts
git commit -m "feat(txt): implement TXT lyric marker reader and writer"
```

---

### Task 12: PowerPoint Text-Only OpenXML Codec

**Files:**
- Create: `show-converter/src/formats/pptx/codec.ts`
- Create: `show-converter/src/formats/pptx/index.ts`
- Test: `show-converter/test/unit/pptx.test.ts`

**Interfaces:**
- Produces: `parsePptx(bytes: Uint8Array, fileName?: string): Promise<Result<Library>>`, `writePptx(library: Library): Promise<Result<{ bytes: Uint8Array, warnings: Warning[] }>>`.

- [ ] **Step 1: Write failing tests for PPTX text-only codec**

Test creating 16:9 `.pptx` from `AMAZING_GRACE`, parsing it back, and verifying slide and lyric text fidelity.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/pptx.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/formats/pptx/codec.ts` and `index.ts`**

Use `jszip` and XML generation/parsing to build standard OpenXML presentation package with one centered text box per slide.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/pptx.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/formats/pptx/ test/unit/pptx.test.ts
git commit -m "feat(pptx): implement text-only PowerPoint OpenXML reader and writer"
```

---

### Task 13: Format Registry, Detector & Conversion Pipeline

**Files:**
- Create: `show-converter/src/pipeline/detector.ts`
- Create: `show-converter/src/pipeline/registry.ts`
- Create: `show-converter/src/pipeline/convert.ts`
- Create: `show-converter/src/index.ts`
- Test: `show-converter/test/unit/pipeline.test.ts`

**Interfaces:**
- Produces: Public engine API:
  - `detectFormat(fileName: string, bytes: Uint8Array): FormatId | undefined`
  - `importFile(bytes: Uint8Array, fileName: string): Promise<Result<Library>>`
  - `exportLibrary(library: Library, formatId: FormatId): Promise<Result<{ bytes: Uint8Array, warnings: Warning[] }>>`
  - `convertFile(bytes: Uint8Array, sourceFileName: string, targetFormat: FormatId): Promise<Result<{ bytes: Uint8Array, warnings: Warning[] }>>`

- [ ] **Step 1: Write failing unit tests for format detection and pipeline orchestration**

Test extension detection, magic byte detection, routing to appropriate format handler, and error reporting for unknown formats.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/pipeline.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `detector.ts`, `registry.ts`, `convert.ts`, and public `src/index.ts`**

Wire all 6 format codecs into unified format registry. Implement sniffing and conversion orchestration.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/pipeline.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/ src/index.ts test/unit/pipeline.test.ts
git commit -m "feat(pipeline): implement format detector, registry, and public conversion pipeline"
```

---

### Task 14: Cross-Format Round-Trip Matrix & Real-World Corpus Suite

**Files:**
- Create: `show-converter/test/roundtrip/matrix.test.ts`
- Create: `show-converter/test/corpus/corpus.test.ts`

**Interfaces:**
- Validates: Full round-trip fidelity matrix (`pro -> vpc -> pro`, `vpc -> freeshow -> vpc`, `txt -> pro -> txt`) and all sample files in `assets-for-testing-purpose/`.

- [ ] **Step 1: Write round-trip matrix tests**

Write tests converting `AMAZING_GRACE` across all pairs of formats and verifying lyric retention >= 95%.

- [ ] **Step 2: Write corpus tests against all real sample files**

Parse and convert `IZY-original.pro`, `Androany aloha.pro`, `Thank You Jesus for The Blood.pro`, `Cevam.vpc`, `façade.vpc`, `FFPM 2 - Antema.vpc`, and `Marble Flow ProPresenter Template.pro6`.

- [ ] **Step 3: Run test suite**

Run: `npx vitest run test/roundtrip/matrix.test.ts test/corpus/corpus.test.ts`
Expected: All tests PASS with non-zero slide counts, verified token coverage, and zero unhandled exceptions.

- [ ] **Step 4: Commit**

```bash
git add test/roundtrip/ test/corpus/
git commit -m "test(corpus): add cross-format round-trip matrix and real-world sample verification suite"
```

---

### Task 15: Phase 1 Acceptance Gate Report & Verification

**Files:**
- Create: `show-converter/docs/phase-1-report.md`

**Interfaces:**
- Produces: Execution summary, full test output log, benchmark metrics, coverage summary, and gate checklist.

- [ ] **Step 1: Execute full test suite and typecheck**

Run: `npm run build && npx vitest run` inside `show-converter/`
Expected: TypeScript compile succeeds (0 errors), all test suites pass.

- [ ] **Step 2: Write `docs/phase-1-report.md`**

Document executed commands, test results (total tests, suites), verified sample metrics, token coverage, and known limitations.

- [ ] **Step 3: Commit**

```bash
git add docs/phase-1-report.md
git commit -m "docs: generate Phase 1 acceptance gate verification report"
```
