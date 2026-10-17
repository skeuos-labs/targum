# CLI Milestone Acceptance Gate Report & Verification

**Project:** Show Converter Engine (`show-converter-engine`)  
**Milestone:** CLI Milestone — Command-Line Interface Utility  
**Date:** 2026-10-17  
**Status:** ACCEPTED (100% Passing, All Gate Criteria Satisfied)

---

## 1. Executive Summary

The CLI Milestone delivers a command-line interface (`show-converter`) for `show-converter-engine`. The CLI provides worship presentation conversion, inspection, and format cataloging from the terminal and shell scripts. It operates as a thin consumer of the headless conversion engine, implementing zero custom format codecs or intermediate transformations.

### Milestone Highlights
- **Zero New Dependencies:** Utilizes Node.js 20+ built-in `node:util.parseArgs`. No third-party CLI packages (`commander`, `yargs`, `meow`, etc.).
- **Strict Stream Separation:** Machine-parsable output and file paths emit exclusively to `stdout`; human progress, diagnostic traces, and non-fatal conversion warnings emit to `stderr`.
- **Data Safety Guarantees:** Refuses to overwrite existing files without explicit authorization (`--force` / `-f`), refuses in-place self-overwrite, and fails closed when converting multi-song containers into single-song formats.
- **Deterministic Automation Codes:** Emits standardized exit codes (`0`, `1`, `2`, `3`) enabling predictable scripting in continuous integration environments.
- **Comprehensive Test Coverage:** 15 dedicated E2E binary tests and 47 CLI unit tests across argument parsing and command execution (330 tests total across the project).

---

## 2. Command Execution Proof

### 2.1 TypeScript Compilation (`npm run build`)

Command executed:
```bash
npm run build
```

Console output:
```text
> show-converter-engine@1.0.0 build
> tsc
```

Result: **Clean compilation (0 errors, 0 warnings, exit code 0)**.

---

### 2.2 Complete Test Suite Execution (`npm test`)

Command executed:
```bash
npm test
```

Console output:
```text
> show-converter-engine@1.0.0 pretest
> npm run build


> show-converter-engine@1.0.0 build
> tsc


> show-converter-engine@1.0.0 test
> vitest run


 RUN  v2.1.9 D:/Projects/claude-code-test/show-converter/show-converter

 ✓ test/unit/txt.test.ts (15 tests) 184ms
 ✓ test/unit/videopsalm-json.test.ts (22 tests) 298ms
 ✓ test/unit/freeshow.test.ts (25 tests) 1545ms
   ✓ FreeShow .show Codec > AMAZING_GRACE Round-Trip > serializes AMAZING_GRACE to FreeShow archive bytes and re-imports accurately 341ms
 ✓ test/unit/pro6.test.ts (11 tests) 469ms
   ✓ ProPresenter 6 XML Reader (parsePro6) > Real .pro6 asset fixture > parses Marble Flow ProPresenter Template.pro6 faithfully 329ms
 ✓ test/unit/pptx.test.ts (15 tests) 2187ms
   ✓ PowerPoint (.pptx) Text-Only OpenXML Codec > writePptx & AMAZING_GRACE Round-Trip > serializes AMAZING_GRACE to OpenXML PPTX and parses back with full fidelity 1174ms
   ✓ PowerPoint (.pptx) Text-Only OpenXML Codec > Numeric slide ordering (slide1, slide2 ... slide9, slide10) > preserves numeric ordering when slide count >= 10 565ms
 ✓ test/unit/canonical.test.ts (19 tests) 227ms
 ✓ test/unit/pipeline.test.ts (52 tests) 4341ms
   ✓ Format Detector (detectFormat) > Magic byte sniffing > detects ZIP packages (0x50, 0x4b) by inspecting archive contents 896ms
   ✓ Format Registry (FORMAT_REGISTRY) > Single vs Multi-presentation export enforcement > ProPresenter export fails closed if presentations.length !== 1 with exact error 919ms
   ✓ Pipeline Importer (importFile) > imports .pptx files into a canonical Library 569ms
   ✓ Pipeline Exporter (exportLibrary & exportPresentation) > exports library to .pptx format 309ms
 ✓ test/unit/cli-commands.test.ts (16 tests) 4679ms
   ✓ CLI Commands: formats, inspect, and convert > executeInspectCommand > outputs human-readable summary with 17 slides, 3 sections, title IZY for IZY-original.pro 1084ms
   ✓ CLI Commands: formats, inspect, and convert > executeInspectCommand > outputs valid canonical Library JSON when json: true for Cevam.vpc 493ms
   ✓ CLI Commands: formats, inspect, and convert > executeConvertCommand > converts single file (.pro -> .vpc) and creates output file with exitCode 0 440ms
   ✓ CLI Commands: formats, inspect, and convert > executeConvertCommand > refuses to overwrite existing file without --force (exitCode 3) and succeeds with --force (exitCode 0) 324ms
   ✓ CLI Commands: formats, inspect, and convert > executeConvertCommand > converts single presentation when --song 1 or --song <title> is specified 464ms
   ✓ CLI Commands: formats, inspect, and convert > executeConvertCommand > unpacks all presentations in multi-song file into separate files with --split <dir> 803ms
   ✓ CLI Commands: formats, inspect, and convert > executeConvertCommand > emits valid JSON summary on stdout when --json is passed for single-file and split conversions 765ms
 ✓ test/unit/propresenter-parse.test.ts (14 tests) 1657ms
   ✓ ProPresenter 7 Protobuf Reader > Exports > returns a valid protobuf Root from getProtoRoot 1160ms
 ✓ test/unit/cli-args.test.ts (31 tests) 113ms
 ✓ test/unit/videopsalm-vpc.test.ts (12 tests) 1491ms
   ✓ VideoPsalm VPC Archive Reader & Writer > parseVpc: Real fixture archives > parses Cevam.vpc (1 song, 47 slides) 592ms
   ✓ VideoPsalm VPC Archive Reader & Writer > writeVpc & Roundtrip: AMAZING_GRACE > writes AMAZING_GRACE and roundtrips via parseVpc 387ms
 ✓ test/unit/rtf.test.ts (25 tests) 32ms
 ✓ test/unit/fixture.test.ts (9 tests) 43ms
 ✓ test/corpus/corpus.test.ts (13 tests) 5045ms
   ✓ Real-World Corpus Import Suite > imports IZY-original.pro: 17 slides, 3 sections, title parsed 1088ms
   ✓ Real-World Corpus Import Suite > imports Cevam.vpc: 1 presentation, 47 slides, title parsed 644ms
   ✓ Real-World Corpus Import Suite > imports FFPM 2 - Antema.vpc: 274 presentations, 1,974 slides total 907ms
   ✓ Real-World Corpus Import Suite > imports Marble Flow ProPresenter Template.pro6: 24 slides, 1 section 386ms
   ✓ Real-World Corpus Import Suite > imports Hymn.pptx faithfully via importFile 317ms
   ✓ Real-World Corpus Cross-Conversion Suite > converts Cevam.vpc song 1 to .pro and re-imports with >= 90% token coverage 317ms
   ✓ Real-World Corpus Cross-Conversion Suite > converts IZY-original.pro to .txt, .show, and .pptx 731ms
 ✓ test/unit/propresenter-write.test.ts (6 tests) 1517ms
   ✓ ProPresenter 7 Protobuf Writer > Serialization of baseline AMAZING_GRACE fixture > produces valid Uint8Array output 1280ms
 ✓ test/roundtrip/matrix.test.ts (30 tests) 4347ms
   ✓ Cross-Format Round-Trip Matrix > preserves fidelity for pro -> vpc -> pro 1298ms
   ✓ Cross-Format Round-Trip Matrix > preserves fidelity for pptx -> txt -> pptx 500ms
   ✓ Cross-Format Round-Trip Matrix > Comprehensive round-trip matrix across all exportable format pairs > roundtrips pptx -> pro -> pptx with >= 95% token coverage 329ms
 ✓ test/unit/cli.test.ts (15 tests) 28367ms
   ✓ CLI Binary End-to-End Suite > prints help and exits 0 with --help flag 3468ms
   ✓ CLI Binary End-to-End Suite > formats command exits 0 and lists all 7 supported formats in human table 1638ms
   ✓ CLI Binary End-to-End Suite > formats --json outputs parseable JSON array of format definitions 1317ms
   ✓ CLI Binary End-to-End Suite > inspects presentation and outputs slide summary to stdout with exit 0 2358ms
   ✓ CLI Binary End-to-End Suite > inspects presentation with --json emitting valid canonical Library JSON 1879ms
   ✓ CLI Binary End-to-End Suite > converts presentation (.pro -> .vpc) via convert subcommand and writes target file 2073ms
   ✓ CLI Binary End-to-End Suite > converts presentation via root shorthand command (.pro -> .txt) and writes target file 1866ms
   ✓ CLI Binary End-to-End Suite > exits with code 3 when input file does not exist 1683ms
   ✓ CLI Binary End-to-End Suite > exits with code 3 when converting without -f if output file already exists 1818ms
   ✓ CLI Binary End-to-End Suite > exits with code 1 when --strict is passed on a file with formatting warnings 1803ms
   ✓ CLI Binary End-to-End Suite > exits with code 3 when required -t flag is missing in convert 1050ms
   ✓ CLI Binary End-to-End Suite > exits with code 2 when multi-song container is converted to single-song format without --split or --song 1418ms
   ✓ CLI Binary End-to-End Suite > unpacks 19 presentations into directory when multi-song container is converted with --split 2284ms
   ✓ CLI Binary End-to-End Suite > resolves output file inside existing directory when -o points to directory 1806ms
   ✓ CLI Binary End-to-End Suite > falls back to case-insensitive substring match for --song flag 1900ms

 Test Files  17 passed (17)
      Tests  330 passed (330)
   Start at  23:15:49
   Duration  46.29s (transform 15.99s, setup 0ms, collect 40.33s, tests 56.54s, environment 16ms, prepare 17.01s)
```

Result: **17 test suites passed, 330 tests passed, 0 failures, 0 skipped**.

---

## 3. Verification of Acceptance Criteria

### 3.1 Formats Command (`formats`)
- **Criteria:** Lists all 7 formats with extensions, capabilities, and supports `--json` output.
- **Verification:**
  - `show-converter formats` displays tabular columns: Format ID, Format Name, Extensions, Import, Export.
  - `show-converter formats --json` outputs parseable JSON array of 7 format descriptor objects.
  - Verified by tests: `test/unit/cli.test.ts` ("formats command exits 0 and lists all 7 supported formats in human table", "formats --json outputs parseable JSON array of format definitions") and `test/unit/cli-commands.test.ts`.

### 3.2 Inspect Command (`inspect <file>`)
- **Criteria:** Inspects file structure, displays presentation title, slide count, section layout, and warnings. Supports `--json` for raw canonical dump.
- **Verification:**
  - `show-converter inspect file.pro` outputs file path, format, presentation count, title, metadata, slide total, and section slide breakdown.
  - `show-converter inspect file.pro --json` outputs complete canonical `Library` JSON on `stdout`.
  - Non-existent files exit with code `3` and diagnostic message on `stderr`.
  - Verified by tests: `test/unit/cli.test.ts` ("inspects presentation and outputs slide summary to stdout with exit 0", "inspects presentation with --json emitting valid canonical Library JSON") and `test/unit/cli-commands.test.ts`.

### 3.3 Convert Command with All Flags
- **Criteria:** Convert from source to target format (`-t, --to`). Support `-o`, `-f`, `--strict`, `--song`, `--split`, `--json`, and root shorthand.
- **Verification:**
  - `-t, --to <format>`: Enforces exportable target format (`pro`, `vpc`, `freeshow`, `txt`, `pptx`). Missing `-t` exits with code `3`.
  - `-o, --out <path>`: Writes to specified file or resolves default file name inside an existing target directory.
  - `-f, --force`: Refuses to overwrite existing files without `-f` (exit code `3`). Overwrites cleanly when `-f` is provided. Refuses in-place target == source overwrite.
  - `--strict`: Exits with code `1` when conversion succeeds but non-fatal formatting warnings occurred (e.g. `VPC_TAG_UNMAPPED`).
  - `--song <id>`: Extracts single song by 1-based index or case-insensitive title substring. Missing song query exits with code `3`.
  - `--split <dir>`: Creates directory and unpacks all songs into individual files with sanitized filenames and collision disambiguation.
  - `--json`: Emits conversion summary object (`{ ok: true, source, target, format, warnings }`) on `stdout`.
  - Root shorthand: `show-converter <input> -t <format>` correctly routes to `convert`.
  - Verified by 15 tests in `test/unit/cli.test.ts` and 16 tests in `test/unit/cli-commands.test.ts`.

### 3.4 Deterministic Exit Codes
- **Criteria:** Strictly adheres to exit code contract:
  - `0`: Success without strict warnings.
  - `1`: Warning occurred under `--strict`.
  - `2`: Conversion/engine error (corrupt file, multi-song collision).
  - `3`: User invocation error (missing args, non-existent file, existing output without `-f`).
- **Verification:**
  - All exit code branches covered and asserted across `test/unit/cli.test.ts` and `test/unit/cli-commands.test.ts`.

### 3.5 Multi-Song Safety
- **Criteria:** Multi-song containers (`.vpc`, `.show`) targeting single-song formats (`.pro`, `.txt`, `.pptx`) must fail closed with exit code `2` unless `--split` or `--song` is explicitly supplied.
- **Verification:**
  - Converting `façade.vpc` (19 songs) to `pro` without `--split` or `--song` terminates with exit code `2` and descriptive instruction on `stderr`.
  - Converting with `--split` produces 19 distinct files in the target directory.
  - Converting with `--song` isolates exactly one presentation.
  - Verified by tests in `test/unit/cli.test.ts` and `test/unit/cli-commands.test.ts`.

### 3.6 Zero New External Dependencies
- **Criteria:** CLI must be implemented using Node 20+ native `node:util.parseArgs` without adding third-party CLI dependencies.
- **Verification:**
  - `package.json` inspection confirms dependencies remain unchanged from Phase 1 (`@zip.js/zip.js`, `fast-xml-parser`, `jsonrepair`, `protobufjs`, `zod`).
  - Zero CLI packages (`commander`, `yargs`, `meow`, `minimist`, etc.) added.

### 3.7 No Duplication of Engine Format Logic
- **Criteria:** CLI acts as a thin orchestration layer. All format sniffing, codec selection, import, export, and schema validation are delegated directly to `src/pipeline/` and `src/canonical/`.
- **Verification:**
  - `src/cli/commands/formats.ts` queries `SUPPORTED_FORMATS` from `src/pipeline/index.js`.
  - `src/cli/commands/inspect.ts` and `src/cli/commands/convert.ts` invoke `importFile`, `exportPresentation`, `exportLibrary`, and `getFormat`.
  - No custom parsing or format transformation exists within `src/cli/`.

---

## 4. Acceptance Gate Checklist

| Requirement | Status | Evidence |
|---|:---:|---|
| CLI binary entrypoint mapped in `package.json` | PASS | `"bin": { "show-converter": "./dist/cli/index.js" }` with executable shebang |
| Clean TypeScript compilation | PASS | `npm run build` exits 0 with 0 errors |
| Pretest script added to `package.json` | PASS | `"pretest": "npm run build"` compiles prior to testing |
| 100% test suite passing | PASS | 17 test suites, 330 tests passing, 0 failures |
| Native `node:util.parseArgs` implementation | PASS | `src/cli/args.ts` uses zero external dependencies |
| Formats command implementation | PASS | Tabular and JSON outputs verified |
| Inspect command implementation | PASS | Summary and canonical JSON outputs verified |
| Convert command with all flags | PASS | `-t`, `-o`, `-f`, `--strict`, `--song`, `--split`, `--json` verified |
| Root shorthand invocation | PASS | `show-converter <input> -t <format>` verified |
| Multi-song safety protection | PASS | Fails closed (exit code 2) without `--split`/`--song` |
| Deterministic exit codes (0, 1, 2, 3) | PASS | End-to-end verified across binary execution |
| Strict stream separation (`stdout` / `stderr`) | PASS | Validated in binary E2E suite |
| Comprehensive CLI usage documentation in README | PASS | Prominent "CLI Usage" section in `README.md` |
