# Show Converter — CLI Milestone Design Specification

**Date:** 2026-10-17  
**Status:** Draft / Pending Review  
**Author:** Show Converter Engineering  

---

## 1. Executive Summary & Goals

The CLI milestone builds a thin, robust command-line interface around `show-converter-engine`. The CLI is a pure consumer of the conversion engine; it implements zero format parsing, zero model transformations, and zero custom serializers.

### Core Principles
1. **Thin Consumer:** Delegates all sniffing, importing, exporting, and validation directly to the conversion engine (`src/pipeline/`).
2. **Zero Extra Dependencies:** Uses Node.js 20+ built-in `node:util.parseArgs` for argument parsing. No `commander`, `yargs`, or external CLI frameworks.
3. **Strict Stream Discipline:** Machine-readable output (`--json`) or output paths land on `stdout`. Human-readable progress, diagnostic messages, and non-fatal warnings land on `stderr`.
4. **Data Safety First:** Refuses to overwrite existing files unless explicitly authorized via `--force` / `-f`.
5. **Deterministic Exit Codes:** Meaningful process exit codes for scripts and CI automation.

---

## 2. Package Integration & Binary Entry Point

The CLI is integrated directly into the `show-converter-engine` package:
- Binary source: `src/cli/index.ts`
- Shebang: `#!/usr/bin/env node`
- Compiled output: `dist/cli/index.js`
- Executable mapping in `package.json`:
  ```json
  "bin": {
    "show-converter": "./dist/cli/index.js"
  }
  ```

---

## 3. Command Syntax & Options

### 3.1 Overview of Commands

```text
show-converter [command] [options]

Commands:
  convert <input> -t <format>    Convert input presentation to target format (default command)
  inspect <input>                Inspect presentation structure and metadata
  formats                        List all supported formats and capabilities
  help, --help, -h               Show help text
```

### 3.2 Root Shorthand

Running `show-converter <input> -t <format>` without an explicit subcommand defaults to `convert`.

### 3.3 Command Specifications

#### 1. `formats`
Lists supported formats, extensions, and import/export capabilities.
- **Flags:**
  - `--json`: Output as raw JSON array of format definitions.
- **Output (Human):**
  A clean terminal table showing Format ID, Display Name, Extensions, and Import/Export support.

#### 2. `inspect <input>`
Inspects an input file and displays its canonical presentation structure.
- **Arguments:**
  - `<input>`: Path to file to inspect.
- **Flags:**
  - `--json`: Output the entire canonical `Library` object as formatted JSON on `stdout`.
- **Output (Human, default):**
  - File name and detected format.
  - Number of presentations in library.
  - Per presentation: Title, Author, CCLI, Copyright, Section breakdown (with slide counts), and any warnings emitted during import.

#### 3. `convert <input> -t <format> [options]`
Converts a file to the target format.
- **Arguments:**
  - `<input>`: Path to input file.
- **Required Flags:**
  - `-t, --to <format>`: Target format ID (`pro`, `vpc`, `show`, `txt`, `pptx`).
- **Optional Flags:**
  - `-o, --out <path>`: Explicit output file path or directory.
    - If omitted: Defaults to `<input-basename>.<target-ext>` in current working directory.
  - `-f, --force`: Overwrite existing output file if it exists.
  - `--strict`: Treat warnings as errors; exit with code `1` if non-fatal warnings occur.
  - `--song <index|title>`: Select a single song from a multi-song source file (1-based index or case-insensitive title substring).
  - `--split <dir>`: When converting a multi-song file to a single-song target format (`.pro`, `.txt`, `.pptx`), unpack each song into an individual file inside `<dir>`.
  - `--json`: Output conversion summary as JSON on `stdout`.

---

## 4. Multi-Song Handling & Disambiguation

When a multi-song container (e.g. `Songbook.vpc` or multi-song `.show`) is targeted for a single-song format (`.pro`, `.txt`, `.pptx`):

1. **Default (No options given):**
   - The CLI fails closed with exit code `2`.
   - Explains that the input contains $N$ songs but target format only supports 1 song per file.
   - Recommends using `--split <dir>` to unpack all songs or `--song <id>` to pick one.

2. **`--song <index|title>`:**
   - Filters the canonical library down to the specified presentation and converts it to `<output-file>`.

3. **`--split <dir>`:**
   - Creates directory `<dir>` if it does not exist.
   - Converts each presentation into its own file inside `<dir>`.
   - File naming: `<sanitized-title>.<target-ext>`.
   - Path traversal and illegal filename characters (`/ \ : * ? " < > |`) are stripped.
   - Name collisions (e.g. duplicate titles) append a counter: `Title (2).pro`.

---

## 5. Exit Code Specification

| Code | Meaning | Condition |
|---|---|---|
| `0` | **Success** | Conversion or inspection completed with zero fatal errors. Non-fatal warnings printed to `stderr`. |
| `1` | **Warning (Strict)** | Conversion succeeded, but non-fatal fidelity warnings occurred and `--strict` was enabled. |
| `2` | **Conversion Failure** | Import failed, export failed, unmapped multi-song collision, or corrupted input file. |
| `3` | **User / CLI Error** | Invalid command-line arguments, missing input file, target file already exists without `--force`. |

---

## 6. Stream & Logging Hygiene

- **`stdout`:**
  - When `--json` is set: strictly valid JSON payload.
  - In normal `convert` mode: prints final output path or JSON summary upon success.
- **`stderr`:**
  - Error messages and diagnostics (`[ERROR] ...`).
  - Non-fatal warnings (`[WARN] ...`).
  - Interactive/human status messages.

---

## 7. Testing Strategy

The CLI test suite (`test/unit/cli.test.ts`) runs as part of `npm test`:
- Invokes compiled binary (`node dist/cli/index.js`) using Node's `child_process.spawnSync`.
- **Test Scenarios:**
  - `formats`: Verify stdout lists all 7 formats; verify `--json` emits valid JSON array.
  - `inspect`: Test inspecting `IZY-original.pro`, `Cevam.vpc`, and synthetic files. Test `--json` canonical dump.
  - `convert` basic: Convert `IZY-original.pro` to `.vpc`, `.txt`, `.pptx`. Verify exit code 0.
  - Overwrite protection: Converting when output exists exits with code 3. Passing `--force` / `-f` succeeds.
  - `--strict`: Converting a presentation with formatting warnings returns exit code 1 under `--strict`.
  - Multi-song safety: Converting `façade.vpc` to `.pro` without `--split` exits with code 2. With `--split out/`, verifies 19 distinct `.pro` files created.
  - Invalid arguments: Missing required `-t`, unknown flags, non-existent files exit with code 3.
