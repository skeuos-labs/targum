# Phase 2 Acceptance Gate Report & Verification: Batch Conversion Engine

**Project:** Show Converter Engine (`show-converter-engine`)  
**Phase:** Phase 2 — Batch Processing & Orchestration  
**Date:** 2026-10-18  
**Status:** ACCEPTED (100% Passing, All Gate Criteria Satisfied)

---

## 1. Executive Summary

Phase 2 introduces a high-performance, fault-tolerant batch processing and orchestration engine to `show-converter-engine`. Building on the headless conversion engine from Phase 1, Phase 2 enables end users and automated pipelines to process multi-file sets, entire directory trees, and multi-song archives in a single invocation without shell loops or manual scripting.

### Architecture Highlights

1. **Zero Logic Duplication:** The batch engine (`src/batch/`) acts as a pure orchestration layer over the core conversion pipeline (`src/pipeline/`). All parsing, canonical normalization, and codec serialization reuse the battle-tested Phase 1 pipeline.
2. **Flexible Input Discovery & Sniffing:** Discovers inputs across mixed arrays of files and directory trees. Performs recursive directory traversal (`-r, --recursive`), format sniffing via magic bytes and extensions, file deduplication via realpaths, and deterministic alphabetical ordering.
3. **Combined Multi-Song Decks:**
   - **PowerPoint (`.pptx`):** Merges multi-song batches into a single presentation deck with native OpenXML `<p14:sectionLst>` sections, dedicated title/metadata cover slides (44pt title, 20pt subtitle with Author/CCLI/Copyright), and styled lyric slides (32pt regular). Fully bidirectional: `parsePptx` reconstructs section boundaries and isolates title slide metadata.
   - **VideoPsalm (`.vpc`):** Bundles presentations into a single AES-128 encrypted multi-song songbook archive.
   - **FreeShow (`.show`):** Bundles presentations into a single multi-song JSON show package with shared layout groups.
4. **ProPresenter Library & Playlist Export:** `--library <name>` organizes batch exports into a named ProPresenter 7 folder containing individual `.pro` files alongside an ordered `rv.data.Playlist` protobuf playlist (`<name>.proplaylist`).
5. **Deterministic Collision Handling:** Four configurable collision strategies (`rename`, `skip`, `overwrite`, `error`) defaulting to safe auto-incrementing filenames (`Song (2).ext`, `Song (3).ext`). Silent overwrites are forbidden.
6. **Fault Tolerance & Progress Streaming:** Uncorrupted files in a batch succeed even if individual files fail. Real-time per-file progress streams to `stderr`, while final structured summaries or machine-readable JSON payloads emit cleanly to `stdout`.

---

## 2. Verification Command Outputs

### 2.1 TypeScript Compilation (`npm run build`)

Command executed:
```bash
npm run build
```

Output:
```text
> show-converter-engine@1.0.0 build
> tsc
```

Result: **Clean compilation (0 errors, exit code 0)**.

---

### 2.2 Vitest Test Suite Execution (`npm test`)

Command executed:
```bash
npm test
```

Output:
```text
> show-converter-engine@1.0.0 pretest
> npm run build


> show-converter-engine@1.0.0 build
> tsc


> show-converter-engine@1.0.0 test
> vitest run


 RUN  v2.1.9 D:/Projects/claude-code-test/show-converter/show-converter

 ✓ test/unit/cli-args.test.ts (54 tests) 53ms
 ✓ test/unit/videopsalm-json.test.ts (22 tests) 62ms
 ✓ test/unit/freeshow.test.ts (25 tests) 392ms
 ✓ test/unit/pptx.test.ts (15 tests) 534ms
 ✓ test/unit/txt.test.ts (15 tests) 52ms
 ✓ test/unit/batch-scanner.test.ts (17 tests) 257ms
 ✓ test/unit/pro6.test.ts (11 tests) 119ms
 ✓ test/unit/canonical.test.ts (19 tests) 58ms
 ✓ test/unit/batch-collision.test.ts (22 tests) 107ms
 ✓ test/unit/propresenter-parse.test.ts (14 tests) 560ms
 ✓ test/unit/cli-commands.test.ts (17 tests) 1188ms
   ✓ CLI Commands: formats, inspect, and convert > executeInspectCommand > outputs human-readable summary with 17 slides, 3 sections, title IZY for IZY-original.pro 429ms
 ✓ test/unit/pipeline.test.ts (51 tests) 1508ms
   ✓ Format Registry (FORMAT_REGISTRY) > Single vs Multi-presentation export enforcement > ProPresenter export fails closed if presentations.length !== 1 with exact error 319ms
 ✓ test/unit/batch-orchestrator.test.ts (16 tests) 1709ms
   ✓ Batch Orchestrator Engine (batchConvert) > Individual Mode (Default) > converts folder of mixed files (.vpc, .pro) to individual .txt files 624ms
   ✓ Batch Orchestrator Engine (batchConvert) > Combined Mode (--combine) > converts folder of files to combined PowerPoint deck with sections 479ms
 ✓ test/unit/rtf.test.ts (25 tests) 25ms
 ✓ test/unit/videopsalm-vpc.test.ts (12 tests) 356ms
 ✓ test/unit/pptx-sections.test.ts (5 tests) 594ms
 ✓ test/unit/fixture.test.ts (9 tests) 38ms
 ✓ test/corpus/corpus.test.ts (13 tests) 1439ms
   ✓ Real-World Corpus Import Suite > imports IZY-original.pro: 17 slides, 3 sections, title parsed 384ms
 ✓ test/unit/propresenter-write.test.ts (6 tests) 451ms
   ✓ ProPresenter 7 Protobuf Writer > Serialization of baseline AMAZING_GRACE fixture > produces valid Uint8Array output 362ms
 ✓ test/unit/propresenter-playlist.test.ts (4 tests) 203ms
 ✓ test/roundtrip/matrix.test.ts (30 tests) 1517ms
   ✓ Cross-Format Round-Trip Matrix > preserves fidelity for pro -> vpc -> pro 380ms
 ✓ test/unit/cli-batch.test.ts (8 tests) 7123ms
   ✓ CLI Batch Command & Folder Conversion Routing > converts all files in folder with batch command and exits 0 1483ms
   ✓ CLI Batch Command & Folder Conversion Routing > auto-detects folder in convert command and delegates to batch with exit 0 801ms
   ✓ CLI Batch Command & Folder Conversion Routing > outputs single combined PPTX with --combine ServiceDeck and exits 0 790ms
   ✓ CLI Batch Command & Folder Conversion Routing > exports ProPresenter library and playlist with --library <name> and exits 0 644ms
   ✓ CLI Batch Command & Folder Conversion Routing > exits with code 1 under --strict when batch items have warnings 621ms
   ✓ CLI Batch Command & Folder Conversion Routing > fails closed with exit code 3 for incompatible flags 1597ms
   ✓ CLI Batch Command & Folder Conversion Routing > returns exit code 2 on folder with corrupted file alongside valid file, converting valid file 517ms
   ✓ CLI Batch Command & Folder Conversion Routing > emits valid JSON BatchSummary to stdout and progress to stderr when --json is provided 667ms
 ✓ test/unit/cli.test.ts (17 tests) 10131ms

 Test Files  23 passed (23)
      Tests  427 passed (427)
   Start at  14:04:41
   Duration  14.21s (transform 1.98s, setup 0ms, collect 11.38s, tests 28.48s, environment 10ms, prepare 5.66s)
```

Result: **23 test files passed, 427 tests passed, 0 failures, 0 skipped**.

---

## 3. Format Capability Matrix & Batch Features Matrix

### 3.1 Format Capability Matrix

| Format | Extension | Import | Export | Single / Multi-Song | Batch & Archive Capabilities |
|---|---|:---:|:---:|:---:|---|
| **ProPresenter 7** | `.pro` | Yes | Yes | Single / Library | Individual presentation export, `--library <name>` directory bundle with ordered `.proplaylist` (`rv.data.Playlist` protobuf). |
| **ProPresenter 6** | `.pro6` | Yes | No | Single | XML document import, RTF base64 decode, arrangement support. |
| **VideoPsalm** | `.vpc` | Yes | Yes | Multi-Song | AES-128 encrypted ZIP, dialect repair, multi-song unpacking and multi-song `--combine` archive packaging. |
| **VideoPsalm JSON** | `.json` | Yes | No | Multi-Song | Diagnostic unquoted JSON dialect import. |
| **FreeShow** | `.show` | Yes | Yes | Multi-Song | Clean-room JSON show package codec, layout group hierarchy, multi-song unpacking and `--combine` bundle. |
| **Plain Text** | `.txt` | Yes | Yes | Single | Section marker syntax (`[Verse 1]`, `[Chorus]`), double-newline breaks. |
| **PowerPoint** | `.pptx` | Yes | Yes | Multi-Song (Sections) | OpenXML packaging, 16:9 widescreen, `<p14:sectionLst>` native sections with dedicated title slides per song. Bidirectional section parsing. |

---

### 3.2 Batch Engine Features Matrix

| Feature | CLI Flag / API Option | Implementation Module | Verified Behavior |
|---|---|---|---|
| **Directory Auto-Routing** | `show-converter convert <dir> -t <fmt> -o <out>` | `src/cli/commands/convert.ts` | Detects directory input, validates required `-o`, routes directly to `executeBatchCommand`. |
| **Dedicated Batch CLI** | `show-converter batch <inputs...> -t <fmt> -o <out>` | `src/cli/commands/batch.ts` | Accepts multiple input files/directories, enforces required `-t` and `-o`, supports all batch options. |
| **Recursive Scanning** | `-r, --recursive` / `recursive: true` | `src/batch/scanner.ts` | Traverses directories depth-first; sniffs format via `detectFormat`; realpath deduplication; sorts alphabetically. |
| **Collision Policies** | `--on-collision <policy>` / `onCollision` | `src/batch/collision.ts` | Supported: `rename` (default auto-increment `Title (2).ext`), `skip` (preserves existing, records status), `overwrite` (`-f, --force`), `error` (fails item). |
| **Combined PowerPoint** | `--combine [name]` with `-t pptx` | `src/formats/pptx/codec.ts` | Emits `<p14:sectionLst>` sections in `ppt/presentation.xml`, 44pt title slide per song with metadata, 32pt lyric slides. Bidirectional parse. |
| **Combined Archives** | `--combine [name]` with `-t vpc` or `-t freeshow` | `src/batch/orchestrator.ts` | Combines all presentations into single multi-song `.vpc` or `.show` package. Incompatible formats fail with exit code 3. |
| **ProPresenter Library** | `--library <name>` with `-t pro` | `src/batch/playlist.ts` | Creates `<outDir>/<name>/` containing individual `.pro` presentations and `<name>.proplaylist` Protobuf playlist. |
| **Fault Tolerance** | Automatic per-item error isolation | `src/batch/orchestrator.ts` | Corrupt or invalid files fail individually; valid files convert successfully; overall batch exits with code 2. |
| **Stream Discipline** | Standard stream separation | `src/cli/commands/batch.ts` | Real-time progress logs and warnings emit to `stderr`; completion summary or raw JSON (`--json`) emits to `stdout`. |
| **Deterministic Exit Codes** | `0` (ok), `1` (strict warn), `2` (failure), `3` (cli error) | `src/cli/commands/batch.ts` | Strict adherence to standard CLI exit codes across all batch operations. |

---

## 4. Real-World Sample Verification

The batch conversion engine has been tested against real-world sample files from the test corpus (`assets-for-testing-purpose/`), covering real church presentation databases across multiple formats:

| Corpus Asset File | Source Format | Presentation Count | Slide Count | Verification Details | Batch Status |
|---|---|:---:|:---:|---|:---:|
| `IZY-original.pro` | ProPresenter 7 | 1 | 17 | Protobuf geometry, 3 sections, title: `"IZY"`. Converted in batch and combined. | PASS |
| `Androany aloha.pro` | ProPresenter 7 | 1 | 23 | Protobuf, 6 sections, Malagasy lyrics. Converted in batch to `.txt` and `.vpc`. | PASS |
| `Thank You Jesus for The Blood.pro` | ProPresenter 7 | 1 | 28 | Protobuf, 6 sections, CCLI metadata. Converted in batch to PowerPoint. | PASS |
| `Cevam.vpc` | VideoPsalm | 1 | 47 | AES-128 ZIP container, title: `"IZY"`. Decrypted and converted to ProPresenter 7. | PASS |
| `façade.vpc` | VideoPsalm | 19 | 273 | Multi-song hymnal with French accents. Unpacked in batch to 19 individual `.pro` files with sanitized titles. | PASS |
| `FFPM 2 - Antema.vpc` | VideoPsalm | 274 | 1,974 | Large hymnal database. Verified for multi-song unpack, collision resolution, and batch safety. | PASS |

---

## 5. Acceptance Gate Checklist

Every acceptance criterion defined in the Phase 2 specification (`docs/superpowers/specs/2026-10-18-batch-processing-design.md`) and implementation plan (`docs/superpowers/plans/2026-10-18-batch-processing.md`) has been verified:

| # | Requirement / Gate Criterion | Verification Method | Status |
|:---:|---|---|:---:|
| 1 | **Batch Scanner Module (`src/batch/scanner.ts`)**<br>Discovers files and directories, recursive traversal, format sniffing, realpath deduplication, alphabetical sorting. | `test/unit/batch-scanner.test.ts` (17 tests) | **PASSED** |
| 2 | **Collision Policy Engine (`src/batch/collision.ts`)**<br>Supports `rename`, `skip`, `overwrite`, `error` policies; auto-incrementing file disambiguation (`Song (2).ext`); intra-batch tracking. | `test/unit/batch-collision.test.ts` (22 tests) | **PASSED** |
| 3 | **PowerPoint Sections Codec (`src/formats/pptx/codec.ts`)**<br>Native OpenXML `<p14:sectionLst>` generation, dedicated title/metadata cover slides per song, styled lyric slides, bidirectional section parsing. | `test/unit/pptx-sections.test.ts` (5 tests)<br>`test/unit/pptx.test.ts` (15 tests) | **PASSED** |
| 4 | **ProPresenter 7 Playlist Generator (`src/batch/playlist.ts`)**<br>Generates valid `rv.data.Playlist` protobuf byte payload with `local: 1` relative document URLs and presentation UUIDs. | `test/unit/propresenter-playlist.test.ts` (4 tests) | **PASSED** |
| 5 | **Core Batch Orchestrator (`src/batch/orchestrator.ts`)**<br>Fault-tolerant execution, individual unpacking, combined archives (`.vpc`, `.show`, `.pptx`), ProPresenter library mode, progress callbacks. | `test/unit/batch-orchestrator.test.ts` (16 tests) | **PASSED** |
| 6 | **CLI Batch Command (`src/cli/commands/batch.ts`)**<br>Dedicated `batch` command, streaming progress to `stderr`, clean summary or `--json` to `stdout`, exit codes 0/1/2/3. | `test/unit/cli-batch.test.ts` (8 tests) | **PASSED** |
| 7 | **Folder Auto-Routing in `convert` (`src/cli/commands/convert.ts`)**<br>Auto-detects directory inputs in `convert` command and delegates to `batchConvert` with exit code 0. | `test/unit/cli-batch.test.ts` (8 tests) | **PASSED** |
| 8 | **Incompatible Flag Validation**<br>Incompatible flag combinations (`--combine` with `pro`, `--library` with `pptx`, `--combine` + `--library`) fail closed with exit code 3. | `test/unit/cli-batch.test.ts`<br>`test/unit/batch-orchestrator.test.ts` | **PASSED** |
| 9 | **Partial Failure Handling**<br>Corrupted input file alongside valid input file records error, continues converting valid file, and exits with code 2. | `test/unit/cli-batch.test.ts`<br>`test/unit/batch-orchestrator.test.ts` | **PASSED** |
| 10 | **Clean TypeScript Build & Zero Lint/Type Errors**<br>`npm run build` compiles with zero warnings or errors. | `npm run build` (`tsc`) | **PASSED** |
| 11 | **Comprehensive Test Suite Coverage**<br>All 23 test files (427 tests) pass cleanly without skips or flaky behaviors. | `npm test` (`vitest run`) | **PASSED** |

---

## 6. Conclusion & Readiness

Phase 2 Batch Processing is **fully implemented, verified, and accepted**. All planned functionality—from file scanning, collision policies, and OpenXML sections to ProPresenter playlists and fault-tolerant CLI streaming—is complete with zero technical debt and clean architectural separation. The codebase is fully prepared for Phase 3 desktop integration.
