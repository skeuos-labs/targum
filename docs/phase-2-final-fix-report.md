# Phase 2 Final Fix Report

## Overview

Resolution of findings identified during the final whole-branch review for Phase 2 batch processing and orchestration in `show-converter-engine`.

## Findings Resolved

### 1. PowerPoint Section Extension URI in `src/formats/pptx/codec.ts`
- **Issue**: The extension element URI in `writePptx` presentation XML referenced `{521415D9-36F7-43E2-8B97-042D7FB25576}`.
- **Fix**: Updated `<p:ext uri="...">` to the official Microsoft PowerPoint 2010 section extension GUID: `<p:ext uri="{521415D9-36F7-43E2-AB2F-B90AF26B5E84}">`.
- **Verification**: Verified via `test/unit/pptx-sections.test.ts` that generated OpenXML `ppt/presentation.xml` contains the official GUID.

### 2. Warning Propagation in Multi-Song `parsePptx` in `src/formats/pptx/codec.ts`
- **Issue**: The section-aware multi-song parsing loop in `parsePptx` hardcoded `warnings: []` on candidate presentations, failing to propagate formatting and empty-slide warnings.
- **Fix**:
  - Tracked text run formatting per slide with `anyFormatting ||= hadStyleRef.value`.
  - Tracked empty slides both per slide (`emptySlideWarnings.push(...)` with slide number and entry name) and at the section level (`hasEmptySlide`).
  - If `anyFormatting`, added `PPTX_STYLES_NOT_EXTRACTED` info warning.
  - If empty slides exist, added `PPTX_EMPTY_SLIDE` warn warning.
  - Attached these warnings to candidate presentation `warnings`, propagating them through `parsePresentation()` validation into the returned `Library.presentations` and library-level `warnings`.
- **Verification**: Added test `propagates PPTX_STYLES_NOT_EXTRACTED and PPTX_EMPTY_SLIDE warnings in multi-song parse` in `test/unit/pptx-sections.test.ts`.

### 3. Warning Multiplication & Fallbacks in `src/batch/orchestrator.ts`
- **Issue**:
  - In combined mode (`--combine`), export warnings were appended to every individual presentation's item result, multiplying export warnings by N (e.g. 50 duplicate warnings for a 50-song batch) and distorting `summary.warningCount` and CLI stderr.
  - `await fs.promises.mkdir(libDir, { recursive: true })` was executed inside the inner presentation loop when `--library` was active.
  - When a file failed import, fallback properties defaulted to `'unknown'` instead of using the filename and detected format.
- **Fix**:
  - In combined mode, attached export warnings once to the first presentation item (`i === 0 ? [...ref.warnings, ...expWarnings] : [...ref.warnings]`). Subsequent presentations keep their individual import warnings without multiplying export warnings.
  - Hoisted `mkdir(libDir)` before the main file loop when `options.libraryName` is set, creating the library directory once up front.
  - When an import fails on a file, used `path.parse(sourcePath).name` for `presentationTitle` fallback and `detectFormat(sourcePath, bytes)` for `sourceFormat` fallback.
- **Verification**: Added `does not multiply export warnings across items in combined mode` test in `test/unit/batch-orchestrator.test.ts` and verified `presentationTitle` and `sourceFormat` fallbacks on corrupt files.

### 4. Normalize Slashes & Remove Dead Fields in `src/batch/playlist.ts`
- **Issue**: `relativePath` in `Playlist.Presentation.DocumentPath` was not normalized across platforms (Windows backslashes preserved), and `destination: 1` was included despite not existing in the `PlaylistItem.Presentation` protobuf schema.
- **Fix**:
  - Normalized `relativePath` with `p.relativePath.replace(/\\/g, '/')` for cross-platform portability.
  - Removed dead `destination: 1` field from the protobuf object payload.
- **Verification**: Added test `normalizes backslashes to forward slashes in relativePath and omits dead destination field` in `test/unit/propresenter-playlist.test.ts`.

---

## Test & Build Verification

### TypeScript Build
```bash
npm run build
```
Result: 0 errors, exit code 0.

### Test Suite Execution
```bash
npm test
```
Result:
- **Test Files**: 23 passed (23)
- **Tests**: 430 passed (430)
- **Failures**: 0
