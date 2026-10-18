# Show Converter — Phase 2 Batch Processing Design Specification

**Date:** 2026-10-18  
**Status:** Draft / Pending Review  
**Author:** Show Converter Engineering  

---

## 1. Executive Summary & Goals

Phase 2 introduces batch import and export orchestration around `show-converter-engine`. Batch processing allows users to convert multiple individual files, entire directories of songs, and multi-presentation archives without repeating manual conversion commands.

### Core Goals
1. **Zero Logic Duplication:** Batch orchestration is a pure layer around the conversion pipeline (`src/pipeline/`). It never duplicates format parsing, canonical transformation, or serialization code.
2. **Flexible Input Aggregation:** Accepts multiple file paths, directories, and optional recursive directory traversal (`-r, --recursive`).
3. **Combined & Individual Export Modes:**
   - **Combined Deck (PowerPoint):** All songs merged into a single `.pptx` deck where each song is organized into a native PowerPoint section (`<p14:sectionLst>`), beginning with a dedicated title cover slide.
   - **Combined Songbook (VideoPsalm / FreeShow):** All presentations merged into a single multi-song `.vpc` or `.show` archive (`--combine`).
   - **Individual Presentations (Default):** Every presentation exported to its own standalone file.
4. **ProPresenter Library-Style Output:** Support `--library <name>` to package exported presentations into a named library folder alongside an ordered `rv.data.Playlist` protobuf file (`<name>.proplaylist`).
5. **Data Safety & Deterministic Collision Handling:** Configurable collision policies (`rename`, `skip`, `overwrite`, `error`) defaulting to safe auto-incrementing filenames (`Song (2).ext`). Silent overwrites are forbidden.
6. **Fault Tolerance & Progress Reporting:** Single-file errors do not abort the queue. Progress lines stream to `stderr`, and a final summary table or clean JSON payload is emitted to `stdout`.

### Non-Goals
- GUI / Desktop application integration (deferred to Phase 3).
- Remote network downloads or cloud sync.
- Non-presentation file conversion (video, audio, PDF).

---

## 2. Batch Engine Architecture & Module Layout

The batch engine lives in `src/batch/` and is exported from the root `src/index.ts`. It is consumed by both the CLI and the upcoming Phase 3 desktop GUI.

```text
src/
├── batch/
│   ├── index.ts               # Public batch API exports
│   ├── types.ts               # Batch options, progress, item results, summary
│   ├── scanner.ts             # File and folder scanner with recursive option
│   ├── collision.ts           # Collision detection, policies, rename resolution
│   ├── orchestrator.ts        # Main batchConvert execution engine
│   └── playlist.ts            # ProPresenter .proplaylist Protobuf generator
├── formats/
│   └── pptx/
│       └── codec.ts           # Updated with native <p14:sectionLst> support
└── cli/
    ├── args.ts                # Updated with batch flags (--combine, --recursive, etc.)
    └── commands/
        ├── batch.ts           # Dedicated batch CLI command handler
        └── convert.ts         # Updated to auto-detect folder inputs
```

---

## 3. Core Batch Engine Interfaces

### 3.1 Options & Results

```typescript
export type CollisionPolicy = "rename" | "skip" | "overwrite" | "error";

export interface BatchConvertOptions {
  /** Input files and/or directory paths */
  inputs: string[];
  /** Target format ID (e.g. 'pro', 'vpc', 'show', 'txt', 'pptx') */
  to: FormatId;
  /** Output directory */
  outDir: string;
  /** Recursive directory scan for folder inputs (default: false) */
  recursive?: boolean;
  /** Collision handling policy (default: 'rename') */
  onCollision?: CollisionPolicy;
  /** Combine all songs into a single target file/archive when supported */
  combine?: boolean;
  /** Specific name for combined file or ProPresenter library folder */
  combineName?: string;
  /** ProPresenter library-style export with playlist */
  libraryName?: string;
  /** Treat warnings as errors in per-item results */
  strict?: boolean;
}

export interface BatchItemResult {
  sourcePath: string;
  sourceFormat: FormatId;
  presentationTitle: string;
  outputPath?: string;
  status: "success" | "skipped" | "failed";
  warnings: Warning[];
  error?: Error;
}

export interface BatchSummary {
  totalFiles: number;
  totalSongs: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  warningCount: number;
  items: BatchItemResult[];
  combinedOutputPath?: string;
  durationMs: number;
}

export type BatchProgressCallback = (progress: {
  currentFile: number;
  totalFiles: number;
  sourcePath: string;
  songCount?: number;
  status: "processing" | "success" | "skipped" | "failed";
  error?: Error;
}) => void;
```

---

## 4. Input Scanning & Discovery

`src/batch/scanner.ts`:
- Accepts an array of file paths and/or directory paths.
- File-Level Discovery: Scanner discovers and validates files on disk without performing expensive full-file decryption/decompression upfront.
- `totalFiles` in progress callbacks represents the count of discovered supported input files. Multi-song archives report their internal song count as soon as parsed by the orchestrator.
- For files: Sniffs format using `detectFormat(path, bytes)`. Unknown extensions/bytes are rejected with an explicit warning or skipped.
- For directories: Reads directory contents. If `recursive: true`, traverses subdirectories depth-first.
- Deduplication: Resolves absolute real paths to avoid scanning the same file multiple times via symlinks or redundant inputs.
- Deterministic Ordering: Input files are sorted alphabetically by path to ensure reproducible conversion sequences.

---

## 5. Collision Strategies & File Naming

`src/batch/collision.ts`:
- File names are sanitized via `sanitizeFileName(title)` to remove illegal characters (`[/\\:*?"<>|\u0000-\u001f\u007f]`).
- Empty titles fallback to `"untitled"`.
- Collision handling policies:
  1. `rename` (Default): If `<outDir>/<baseName>.<ext>` exists or was already generated in the current batch run, increments counter: `<baseName> (2).<ext>`, `<baseName> (3).<ext>`.
  2. `skip`: Leaves the existing file untouched, records item status as `"skipped"`.
  3. `overwrite`: Replaces existing file on disk.
  4. `error`: Fails the individual item with an error and records status as `"failed"`.

---

## 6. Output Modes & Specialized Format Handling

### 6.1 Individual File Mode (Default)
Each imported presentation produces its own file in `<outDir>`:
- Single-song source files produce 1 output file.
- Multi-song archives (e.g. `Hymnal.vpc`) unpack all contained songs into `<outDir>`.

### 6.2 Combined PowerPoint Mode (`--combine` with `-t pptx`)
All presentations in the batch are aggregated into a single PowerPoint deck:
- **Native OpenXML Sections:** In `ppt/presentation.xml`, a `<p14:sectionLst>` block defines one `<p14:section>` per song, referencing its starting slide ID and song title.
- **Title Slide per Song:** Each song begins with a dedicated title slide:
  - Title: 44pt bold, centered.
  - Subtitle: 20pt regular (Author, CCLI, Copyright) centered below.
  - Distinct visual layout from lyric slides.
- **Lyric Slides:** Subsequent slides display the song's verse/chorus lyrics (32pt regular, centered).
- **Bidirectional Section Support:**
  - `writePptx(library)`: Writes sections and title slides when `library.presentations.length > 1`.
  - `parsePptx(bytes)`: When `<p14:sectionLst>` is present, parses each section into its own `Presentation` object. The section's first slide is recognized as title/metadata slide if its text matches the section title or contains metadata headers (`Author:`, `CCLI:`), separating metadata from lyric slides.
- Output file: `<outDir>/<combineName ?? "Combined_Presentations">.pptx`.

### 6.3 Combined VideoPsalm & FreeShow Mode (`--combine` with `-t vpc` or `-t show`)
- **VideoPsalm (`.vpc`):** All presentations are assembled into a single `Library` and serialized into a single `.vpc` archive containing `library.json` encrypted with `VPC_KEY`.
- **FreeShow (`.show`):** All presentations are assembled into a single `.show` archive containing all presentation objects and referenced group definitions.

### 6.4 ProPresenter Library-Style Output (`--library <name>`)
Organizes multiple presentations for ProPresenter 7:
1. Directory `<outDir>/<name>/` is created.
2. Each presentation is written as an individual `<name>/<title>.pro` file.
3. Generates `<outDir>/<name>/<name>.proplaylist` using Protobuf `rv.data.Playlist`:
   - `type: TYPE_PLAYLIST`
   - `name: <name>`
   - `items`: Uses `rv.data.Playlist.PlaylistItems` structure. Each item is a `PlaylistItem` (`type: 1` [TYPE_PRESENTATION]) containing `uuid` matching the presentation and `presentation.documentPath` pointing to `./<title>.pro` (`URL` with `local: 1`).
   - Users can drag this folder or playlist directly into ProPresenter 7.

---

## 7. CLI Command Extensions & Validation Rules

### 7.1 Auto-Detection in `convert`
If the input to `show-converter convert <input>` is a directory, it automatically routes to batch processing:
```bash
show-converter convert ./hymns_folder/ -t pro -o ./output/
```

### 7.2 Dedicated `batch` Command
```bash
show-converter batch <inputs...> -t <format> -o <outDir> [options]

Options:
  -t, --to <format>         Target format (required)
  -o, --out <outDir>        Output directory (required)
  -r, --recursive           Scan input directories recursively (default: false)
  --combine [name]          Bundle all songs into a single file (.pptx, .vpc, .show)
  --library <name>          Export as a ProPresenter library with playlist
  --on-collision <policy>   rename (default) | skip | overwrite | error
  --strict                  Exit code 1 if any item produces warnings
  --json                    Emit final summary as machine-readable JSON on stdout
  -f, --force               Alias for --on-collision overwrite
```

### 7.3 Flag Compatibility & Error Handling
Incompatible CLI options fail closed immediately with **exit code 3**:
1. `--combine` passed with non-combinable format (`-t pro`, `-t txt`):
   Error: `--combine is only supported for pptx, vpc, and show formats. For ProPresenter, use --library <name>.`
2. `--library` passed with non-pro format (e.g. `-t pptx`, `-t vpc`):
   Error: `--library is only supported when target format is 'pro'.`
3. Both `--combine` and `--library` passed simultaneously:
   Error: `--combine and --library are mutually exclusive.`

---

## 8. Exit Codes & Streaming Discipline

| Code | Meaning | Condition |
|---|---|---|
| `0` | **Success** | All batch items succeeded with zero failures. |
| `1` | **Warning (Strict)** | All items succeeded, but one or more had warnings and `--strict` was set. |
| `2` | **Partial / Batch Failure** | One or more items failed to convert. |
| `3` | **Invocation / CLI Error** | Invalid flags, missing output directory, unreadable inputs. |

- **`stderr`:** Real-time progress logs: `[1/48] Converting Amazing Grace.vpc -> Amazing Grace.pro (OK)`.
- **`stdout`:** Clean terminal completion summary table or strict `--json` object.

---

## 9. Testing Strategy

1. **Scanner Unit Tests (`test/unit/batch-scanner.test.ts`):**
   - Single files, directory paths, mixed inputs.
   - Recursive vs non-recursive directory traversal.
   - Filtering unsupported files, alphabetical sorting.
2. **Collision Unit Tests (`test/unit/batch-collision.test.ts`):**
   - Auto-incrementing counters (`Song (2).pro`, `Song (3).pro`).
   - `skip`, `overwrite`, `error` behaviors.
3. **PowerPoint Combined Section Tests (`test/unit/pptx-sections.test.ts`):**
   - Verifies `<p14:sectionLst>` generated in `ppt/presentation.xml`.
   - Verifies dedicated title slide per song with metadata.
   - Verifies slide sequence and text fidelity across multiple combined songs.
4. **ProPresenter Library & Playlist Tests (`test/unit/propresenter-playlist.test.ts`):**
   - Verifies folder `<name>/` created with `.pro` files.
   - Decodes `<name>.proplaylist` via protobuf `getProtoRoot().lookupType("Playlist")` and asserts cues match song UUIDs.
5. **Orchestrator End-to-End Tests (`test/unit/batch-orchestrator.test.ts`):**
   - Batch conversion of real corpus files (`assets-for-testing-purpose/`).
   - Mixed-format inputs in one batch.
   - Partial failure isolation (corrupt file alongside valid file).
6. **CLI Batch E2E Tests (`test/unit/cli-batch.test.ts`):**
   - Executing `show-converter batch ...` and `show-converter convert <folder> ...` via `spawnSync`.
