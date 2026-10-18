# Phase 2 Batch Processing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a robust, fault-tolerant batch conversion orchestration engine (`src/batch/`) with multi-file/directory discovery, deterministic collision resolution, combined multi-song exports (PowerPoint sections, VideoPsalm/FreeShow songbooks), ProPresenter library & playlist generation, and CLI batch commands.

**Architecture:** Pure orchestration layer around `src/pipeline/` without duplicating codec logic. Scans and deduplicates files/directories; resolves collisions (`rename`, `skip`, `overwrite`, `error`); dispatches conversions either to individual files or combined master decks/archives; streams progress to `stderr`; outputs summary table or `--json` to `stdout`.

**Tech Stack:** Node.js 20+ (ESM), TypeScript 5.x, Vitest, `@zip.js/zip.js`, `protobufjs`, `fast-xml-parser`, `node:util.parseArgs`.

**Spec:** `docs/superpowers/specs/2026-10-18-batch-processing-design.md`

## Global Constraints

- Zero logic duplication: All format parsing and writing delegates strictly to `src/pipeline/` and `src/formats/`.
- Zero new runtime dependencies: Implemented using existing packages (`@zip.js/zip.js`, `fast-xml-parser`, `protobufjs`, `zod`) and Node.js built-ins.
- Data safety: Never overwrite existing files without explicit policy (`overwrite` or `-f`). Default collision policy is `rename` (`Song (2).ext`).
- Exit codes: `0` (100% success), `1` (warnings with `--strict`), `2` (one or more items failed), `3` (invalid arguments or missing input).
- Stream discipline: `stdout` holds output summary or `--json` array; `stderr` holds real-time progress logs and non-fatal warnings.
- License & Attribution: All code authored under MIT. Zero AI attribution in Git commit author fields.

## Review Focus

- Directory traversal with circular symlinks or duplicate paths: Must deduplicate paths by realpath without infinite loops.
- Corrupted file in large batch queue: Must record failure in summary, stream warning to stderr, and continue converting remaining items without aborting.
- Incompatible CLI flag combinations (`--combine` with `-t pro`, `--library` with `-t pptx`): Must fail closed immediately with exit code 3.
- Intra-batch duplicate song titles: When exporting multiple songs with identical names in `--split` or batch mode, must disambiguate safely even when `--force` is active.
- Empty directory input: Must report 0 files found and exit cleanly without crashing.

---

### Task 1: Batch Types, Scanner & Deduplication

**Files:**
- Create: `show-converter/src/batch/types.ts`
- Create: `show-converter/src/batch/scanner.ts`
- Test: `show-converter/test/unit/batch-scanner.test.ts`

**Interfaces:**
- Produces:
  - `BatchConvertOptions`, `BatchItemResult`, `BatchSummary`, `BatchProgressCallback`, `CollisionPolicy`.
  - `scanBatchInputs(inputs: string[], options?: { recursive?: boolean }): Promise<{ files: string[]; warnings: Warning[] }>`.

- [ ] **Step 1: Write failing unit tests for batch scanner**

Test single file paths, directories, recursive vs non-recursive scanning, filtering unsupported extensions, sorting alphabetically, and deduplicating identical paths.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/batch-scanner.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `src/batch/types.ts` and `src/batch/scanner.ts`**

Define TypeScript interfaces. Implement input resolution, `fs.promises.stat`, `fs.promises.readdir`, extension checking via `detectFormat`, realpath deduplication, and alphabetical sort.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/batch-scanner.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/batch/types.ts src/batch/scanner.ts test/unit/batch-scanner.test.ts
git commit -m "feat(batch): implement batch types and input scanner with recursive directory discovery"
```

---

### Task 2: Collision Policy & File Naming Engine

**Files:**
- Create: `show-converter/src/batch/collision.ts`
- Test: `show-converter/test/unit/batch-collision.test.ts`

**Interfaces:**
- Produces:
  - `resolveOutputPath(outDir: string, baseName: string, ext: string, policy: CollisionPolicy, trackedPaths: Set<string>): { action: "write" | "skip" | "error"; path: string; error?: Error }`.

- [ ] **Step 1: Write failing unit tests for collision resolution**

Test:
- `rename` policy: increments counter for existing files on disk AND for files already queued in current batch (`Song (2).ext`, `Song (3).ext`).
- `skip` policy: returns `action: "skip"` if file exists.
- `overwrite` policy: returns `action: "write"` even if file exists.
- `error` policy: returns `action: "error"` if file exists.
- Sanitizing illegal characters and empty titles.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/batch-collision.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/batch/collision.ts`**

Combine `sanitizeFileName` with disk checks and in-memory `Set<string>` collision tracking.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/batch-collision.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/batch/collision.ts test/unit/batch-collision.test.ts
git commit -m "feat(batch): implement collision policies and intra-batch filename disambiguation"
```

---

### Task 3: PowerPoint Multi-Song Combined Deck & Section Codec

**Files:**
- Modify: `show-converter/src/formats/pptx/codec.ts`
- Test: `show-converter/test/unit/pptx-sections.test.ts`

**Interfaces:**
- Consumes: `Library`, `writePptx`, `parsePptx`.
- Produces:
  - `writePptx(library: Library)`: Supports multi-presentation libraries by creating native `<p14:sectionLst>` sections in `presentation.xml` and distinct title slides (44pt bold title + 20pt subtitle).
  - `parsePptx(bytes: Uint8Array)`: Detects `<p14:sectionLst>` and groups slides into multiple `Presentation` objects in a `Library`, separating title slides from lyrics.

- [ ] **Step 1: Write failing unit tests for multi-song PowerPoint sections**

Test:
- Writing a multi-song `Library` (e.g. 2 songs, 3 slides each) produces valid PPTX bytes.
- Generated XML contains `<p14:sectionLst>` with 2 `<p14:section>` elements naming the songs.
- Each song starts with a title slide containing title and metadata.
- Reading back via `parsePptx` returns a `Library` with 2 distinct `Presentation` objects.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/pptx-sections.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `src/formats/pptx/codec.ts`**

In `writePptx`: If `library.presentations.length > 1`, generate title slides for each presentation, track slide IDs, and append `<p14:sectionLst>` under `<p:presentation><p:extLst>` with OpenXML namespaces `xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main"`.
In `parsePptx`: Check for `p14:sectionLst` or `p:sectionLst`. If found, partition slides by section into individual `Presentation` objects.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/pptx-sections.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/formats/pptx/codec.ts test/unit/pptx-sections.test.ts
git commit -m "feat(pptx): implement native OpenXML sections and title slides for multi-song decks"
```

---

### Task 4: ProPresenter `.proplaylist` Protobuf Generator

**Files:**
- Create: `show-converter/src/batch/playlist.ts`
- Test: `show-converter/test/unit/propresenter-playlist.test.ts`

**Interfaces:**
- Consumes: `getProtoRoot()` from `src/formats/propresenter/root.js`.
- Produces:
  - `generateProPlaylist(name: string, presentations: Array<{ title: string; uuid: string; relativePath: string }>): Uint8Array`.

- [ ] **Step 1: Write failing unit tests for playlist generator**

Test:
- Encoding playlist with 3 songs produces non-empty `Uint8Array`.
- Decoding raw bytes via `getProtoRoot().lookupType("Playlist")` asserts:
  - `name` matches playlist name.
  - `type` is `1` (`TYPE_PLAYLIST`).
  - `items.items` has 3 `PlaylistItem` elements with `type: 1` (`TYPE_PRESENTATION`).
  - `presentation.documentPath` has relative path and matching UUID.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/propresenter-playlist.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/batch/playlist.ts`**

Construct `rv.data.Playlist` message with `PlaylistItems` matching ProPresenter 7 specifications.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/propresenter-playlist.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/batch/playlist.ts test/unit/propresenter-playlist.test.ts
git commit -m "feat(propresenter): implement ProPresenter 7 playlist protobuf generator"
```

---

### Task 5: Core Batch Orchestrator Engine

**Files:**
- Create: `show-converter/src/batch/orchestrator.ts`
- Create: `show-converter/src/batch/index.ts`
- Modify: `show-converter/src/index.ts`
- Test: `show-converter/test/unit/batch-orchestrator.test.ts`

**Interfaces:**
- Consumes: `scanBatchInputs`, `resolveOutputPath`, `importFile`, `exportLibrary`, `exportPresentation`, `generateProPlaylist`.
- Produces:
  - `batchConvert(options: BatchConvertOptions, onProgress?: BatchProgressCallback): Promise<BatchSummary>`.

- [ ] **Step 1: Write failing unit tests for batch orchestrator**

Test:
- Converting folder of mixed files (`.vpc`, `.pro`) to `.txt` individual files in output directory.
- Converting folder of files to combined PowerPoint (`--combine`).
- Converting folder of files to combined VideoPsalm (`--combine`).
- Exporting to ProPresenter library folder with `.proplaylist` (`--library-style`).
- Fault tolerance: when 1 file is corrupted, others succeed; summary reports 1 failure and total successes; exit code logic.
- Progress callback invocations.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/batch-orchestrator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/batch/orchestrator.ts`, `src/batch/index.ts`, and update root `src/index.ts`**

Implement orchestrator workflow: scan inputs, import files, handle unpack vs combine, write outputs using collision policies, emit progress, and build `BatchSummary`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/batch-orchestrator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/batch/ src/index.ts test/unit/batch-orchestrator.test.ts
git commit -m "feat(batch): implement core batch conversion orchestrator engine"
```

---

### Task 6: CLI Batch Command & Folder Conversion Routing

**Files:**
- Create: `show-converter/src/cli/commands/batch.ts`
- Modify: `show-converter/src/cli/args.ts`
- Modify: `show-converter/src/cli/commands/convert.ts`
- Modify: `show-converter/src/cli/index.ts`
- Test: `show-converter/test/unit/cli-batch.test.ts`

**Interfaces:**
- Produces:
  - `show-converter batch <inputs...> -t <format> -o <outDir> [--combine] [--library <name>] [--recursive] [--on-collision <policy>]`.
  - Directory input auto-detection in `show-converter convert <dir> -t <format> -o <outDir>`.

- [ ] **Step 1: Write failing CLI tests for batch operations**

Use `child_process.spawnSync` to execute `node dist/cli/index.js`:
- `show-converter batch ./folder -t pro -o ./out` converts all files.
- `show-converter convert ./folder -t vpc -o ./out` auto-detects folder and delegates to batch.
- `show-converter batch ./folder -t pptx -o ./out --combine ServiceDeck` produces single combined PPTX with sections.
- Incompatible flags (`--combine -t pro`, `--library MyLib -t pptx`) fail closed with exit code 3.
- Partial failure exits with code 2.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/cli-batch.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `batch.ts`, update `args.ts`, `convert.ts`, and `index.ts`**

Add batch arguments parsing. Implement command runner streaming progress to `stderr` and summary/JSON to `stdout`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build && npx vitest run test/unit/cli-batch.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli/ test/unit/cli-batch.test.ts
git commit -m "feat(cli): add dedicated batch command and auto-detect folder inputs in convert"
```

---

### Task 7: Comprehensive Batch Verification & Milestone Report

**Files:**
- Modify: `show-converter/README.md`
- Create: `show-converter/docs/phase-2-report.md`

**Interfaces:**
- Produces: Updated documentation with batch commands and Phase 2 verification report.

- [ ] **Step 1: Run full test suite and build**

Run: `npm test && npm run build`
Expected: Clean compile, 100% test suites passing.

- [ ] **Step 2: Update `README.md` and write `docs/phase-2-report.md`**

Document batch usage examples, collision policies, combined outputs, and ProPresenter library export. Record test run metrics, coverage, and acceptance checklist.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/phase-2-report.md
git commit -m "docs: add Phase 2 batch documentation to README and generate milestone verification report"
```
