# CLI Milestone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a thin, robust CLI wrapper (`show-converter`) over `show-converter-engine` for inspecting formats, inspecting presentation files, and converting worship presentations with multi-song safety.

**Architecture:** Pure consumer of `src/pipeline/` using Node.js built-in `node:util.parseArgs`. Subcommands (`formats`, `inspect`, `convert`) with root shorthand defaulting to `convert`. Machine-readable payloads land on `stdout`, diagnostics and warnings land on `stderr`.

**Tech Stack:** Node.js 20+ (ESM), TypeScript 5.x, `node:util.parseArgs`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-17-cli-milestone-design.md`

## Global Constraints

- No external CLI frameworks: Use Node.js built-in `node:util.parseArgs`. Zero extra dependencies in `package.json`.
- Stream discipline: `stdout` strictly reserved for `--json` payloads or confirmed output paths. `stderr` for diagnostics, progress, and warnings.
- Data safety: Never overwrite existing output files without `--force` / `-f` (exit code `3`).
- Exit codes: `0` (clean success), `1` (warnings with `--strict`), `2` (conversion/import failure), `3` (CLI argument or file safety error).
- Multi-song safety: Multi-song containers converting to single-song formats (`.pro`, `.txt`, `.pptx`) fail closed unless `--split <dir>` or `--song <id>` is provided.
- Binary mapping: Binary entry point `src/cli/index.ts` compiled to `dist/cli/index.js` and registered in `package.json#bin`.
- Commit discipline: Clean commits, conventional commit messages, zero AI attribution in author fields.

## Review Focus

- Missing input file path: Must print error to stderr and exit with code 3 without unhandled exception stack traces.
- Target file collision without `--force`: Must refuse to overwrite existing file, report path on stderr, and exit with code 3.
- Multi-song file to single-song format without `--split`: Must exit code 2 and explain that input contains multiple songs.
- Strict warning escalation: When source generates non-fatal warnings and `--strict` is passed, must exit with code 1.
- Output path equals input path: Must detect in-place overwrite attempt, refuse, and exit with code 3.

---

### Task 1: CLI Argument Parser, Sanitization & Utilities

**Files:**
- Create: `show-converter/src/cli/utils.ts`
- Create: `show-converter/src/cli/args.ts`
- Test: `show-converter/test/unit/cli-args.test.ts`

**Interfaces:**
- Produces:
  - `parseCliArgs(argv: string[]): CliParsedCommand`
  - `sanitizeFileName(title: string): string`
  - `disambiguateFileName(dir: string, baseName: string, ext: string): string`
  - `formatCliWarning(w: Warning): string`

- [ ] **Step 1: Write failing unit tests for CLI argument parsing and filename utilities**

Test parsing subcommands (`formats`, `inspect`, `convert`), root shorthand conversion (`show-converter file.vpc -t pro`), flag parsing (`-t`, `-o`, `-f`, `--strict`, `--song`, `--split`, `--json`), filename sanitization (stripping `/ \ : * ? " < > |`), and collision disambiguation (`Song (2).pro`).

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/cli-args.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `src/cli/utils.ts` and `src/cli/args.ts`**

Use `node:util.parseArgs`. Implement filename sanitizer, collision counter, and warning formatter.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/cli-args.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli/ test/unit/cli-args.test.ts
git commit -m "feat(cli): implement CLI argument parser and file sanitization utilities"
```

---

### Task 2: `formats` and `inspect` Commands

**Files:**
- Create: `show-converter/src/cli/commands/formats.ts`
- Create: `show-converter/src/cli/commands/inspect.ts`
- Test: `show-converter/test/unit/cli-commands.test.ts`

**Interfaces:**
- Consumes: `FORMAT_REGISTRY`, `importFile` from `src/pipeline/index.js`, `parseCliArgs`.
- Produces:
  - `executeFormatsCommand(options: { json?: boolean }): { exitCode: number, stdout: string, stderr: string }`
  - `executeInspectCommand(options: { input: string, json?: boolean }): Promise<{ exitCode: number, stdout: string, stderr: string }>`

- [ ] **Step 1: Write failing unit tests for `formats` and `inspect` commands**

Test:
- `formats` outputs text table listing all 7 formats.
- `formats --json` outputs valid JSON array.
- `inspect <file>` outputs human-readable summary (Title, Author, CCLI, Sections with slide counts, Warnings).
- `inspect <file> --json` outputs raw canonical `Library` JSON on stdout.
- `inspect <non-existent-file>` returns exit code 3 and error on stderr.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/cli-commands.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `formats.ts` and `inspect.ts`**

Format listing reads `FORMAT_REGISTRY`. Inspect reads file bytes and delegates to `importFile`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/cli-commands.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/ test/unit/cli-commands.test.ts
git commit -m "feat(cli): implement formats and inspect commands"
```

---

### Task 3: `convert` Command with Multi-Song Safety

**Files:**
- Create: `show-converter/src/cli/commands/convert.ts`
- Modify: `show-converter/test/unit/cli-commands.test.ts`

**Interfaces:**
- Consumes: `importFile`, `exportLibrary`, `exportPresentation`, `getFormat`, `sanitizeFileName`, `disambiguateFileName`.
- Produces:
  - `executeConvertCommand(options: ConvertCommandOptions): Promise<{ exitCode: number, stdout: string, stderr: string }>`

- [ ] **Step 1: Write failing unit tests for `convert` command**

Test:
- Single-song conversion (`.vpc` -> `.pro`) creates output file, exit code 0.
- Overwrite protection: Refuses existing output file unless `--force` passed (exit code 3).
- In-place overwrite rejection: Refuses if output path equals input path (exit code 3).
- Multi-song safety: Converting multi-song `.vpc` to `.pro` without `--split` or `--song` fails closed (exit code 2).
- `--song <id>`: Extracts single selected presentation to output file.
- `--split <dir>`: Unpacks all presentations in multi-song file into separate sanitized files in directory.
- `--strict`: Exits with code 1 when non-fatal warnings occur.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/cli-commands.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/cli/commands/convert.ts`**

Implement conversion execution, default output path determination, collision and overwrite checks, multi-song validation, `--split` loop, and exit code logic.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/cli-commands.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/convert.ts test/unit/cli-commands.test.ts
git commit -m "feat(cli): implement convert command with multi-song safety and split unpacker"
```

---

### Task 4: CLI Entrypoint, Binary Registration & E2E Integration Suite

**Files:**
- Create: `show-converter/src/cli/index.ts`
- Modify: `show-converter/package.json`
- Test: `show-converter/test/unit/cli.test.ts`

**Interfaces:**
- Produces: Executable CLI binary `show-converter` invoked via `node dist/cli/index.js` or `npx show-converter`.

- [ ] **Step 1: Write failing E2E tests for binary CLI invocation**

Use `child_process.spawnSync` to execute `node dist/cli/index.js`:
- Invoking with `--help` prints help and exits 0.
- Invoking `formats` lists formats.
- Invoking `inspect` on `assets-for-testing-purpose/IZY-original.pro` outputs presentation summary.
- Invoking `convert` on `IZY-original.pro -t vpc -o tmp/test.vpc` creates file and exits 0.
- Missing arguments exits with code 3.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run test/unit/cli.test.ts`
Expected: FAIL (binary / entrypoint not implemented).

- [ ] **Step 3: Implement `src/cli/index.ts` and update `package.json`**

Add shebang `#!/usr/bin/env node`. Wire argument parser and command dispatch. Handle top-level errors and exit codes cleanly. Add `"bin": { "show-converter": "./dist/cli/index.js" }` to `package.json`. Build via `npm run build`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build && npx vitest run test/unit/cli.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli/index.ts package.json test/unit/cli.test.ts
git commit -m "feat(cli): wire CLI binary entrypoint and add end-to-end integration tests"
```

---

### Task 5: Documentation & Milestone Verification Report

**Files:**
- Modify: `show-converter/README.md`
- Create: `show-converter/docs/cli-milestone-report.md`

**Interfaces:**
- Produces: Comprehensive CLI documentation in README and verification report verifying all acceptance criteria.

- [ ] **Step 1: Run full test suite and build**

Run: `npm run build && npm test`
Expected: Clean compile, 100% tests passing.

- [ ] **Step 2: Update `README.md` and write `docs/cli-milestone-report.md`**

Document CLI usage, options, command examples, exit codes, multi-song unpacking. Record test suite results and execution proof in report.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/cli-milestone-report.md
git commit -m "docs: add CLI usage guide to README and create CLI milestone verification report"
```
