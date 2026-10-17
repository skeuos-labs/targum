# CLI Final Fix Report

## Overview
Resolution of findings identified during the final whole-branch review for the CLI milestone.

## Findings Resolved

### 1. Reject Extra Positional Arguments in `src/cli/args.ts`
- **Formats subcommand (`formats`)**: Strictly permits 0 positional arguments. If additional arguments are provided (`positionals.length > 1`), returns `{ ok: false, error: 'Unexpected argument: "${positional}"' }`.
- **Inspect subcommand (`inspect`)**: Strictly requires exactly 1 positional argument (the target presentation file). Extra positional arguments (`positionals.length > 2`) return `{ ok: false, error: 'Unexpected argument: "${extra}"' }`.
- **Convert subcommand (`convert`)**: Strictly requires exactly 1 positional argument (the input presentation file). Extra positional arguments (`positionals.length > 2`) return `{ ok: false, error: 'Unexpected argument: "${extra}"' }`.
- **Root shorthand conversion**: When convert options are present without the `convert` keyword, strictly requires exactly 1 positional argument (`positionals.length > 1` returns `{ ok: false, error: 'Unexpected argument: "${extra}"' }`).
- **Tests Added**: Added unit tests in `test/unit/cli-args.test.ts` and end-to-end tests in `test/unit/cli.test.ts` verifying all extra positional variations are rejected with exit code 3.

### 2. Support `show` as Alias for `freeshow` Target Format
- **Normalization**: In `src/cli/commands/convert.ts` and `src/cli/args.ts`, normalized `-t` / `--to` target format string: if `options.to.toLowerCase() === 'show'`, mapped to `'freeshow'`.
- **Behavior**: Conversion commands accepting `-t show` now resolve to the FreeShow codec and default to `.show` extension, identical to `-t freeshow`.
- **Tests Added**: Added unit test in `test/unit/cli-commands.test.ts` and binary end-to-end test in `test/unit/cli.test.ts` validating `-t show` produces valid `.show` output.

### 3. Guard Top-Level CLI Execution in `src/cli/index.ts`
- **Entrypoint check**: Added `isMain` guard verifying `process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))` before invoking `main()`.
- **Safe Imports**: Importing `src/cli/index.ts` (or `dist/cli/index.js`) as a module no longer triggers CLI execution. Unhandled fatal rejections route through formatted stderr `[FATAL]` with exit code 2.

### 4. Align `README.md` Sample JSON for `formats --json`
- **Output Alignment**: Updated `README.md` sample output for `show-converter formats --json` to match runtime format definition schema: `id`, `label`, `extensions`, `canImport`, `canExport`.

## Verification Results
- **TypeScript Build**: `npm run build` completed without errors.
- **Test Suite**: `npm test` passed 17/17 test suites (339 tests passed, 0 failures).
