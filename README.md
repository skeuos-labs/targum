# Targum

Desktop utility for converting worship presentation files across formats (ProPresenter, VideoPsalm, FreeShow, PowerPoint, Plain Text), powered by Tauri 2, React 19, and the `@skeuos-labs/mizmor` presentation engine.

Part of the [Skeuos Labs](https://github.com/skeuos-labs) ecosystem.

---

## Supported Formats

| Format | Extension | Import | Export | Multi-Song | Notes |
|---|---|---|---|---|---|
| **ProPresenter 7** | `.pro` | Yes | Yes | Single | Protobuf, 1080p canvas, bounds geometry, RTF codec, `.proplaylist` export |
| **ProPresenter 6** | `.pro6` | Yes | No | Single | XML parsing, base64 RTF decoding |
| **VideoPsalm** | `.vpc` | Yes | Yes | Yes | AES-128 encrypted ZIP, universal format key, dialect repair, multi-song |
| **VideoPsalm JSON** | `.json` | Yes | No | Yes | Diagnostic import of unquoted JSON dialect |
| **FreeShow** | `.show` | Yes | Yes | Yes | Clean-room JSON format codec, layout groups, multi-song |
| **Plain Text** | `.txt` | Yes | Yes | Single | Section markers (`[Verse 1]`, `[Chorus]`), blank-line slide breaks |
| **PowerPoint** | `.pptx` | Yes | Yes | Multi-Song | OpenXML presentation package, 16:9 widescreen, `<p14:sectionLst>` sections |

---

## Quick Commands

```bash
# Run web preview dev server in browser
pnpm desktop:web

# Run desktop app in native Tauri dev mode (requires Rust & Tauri CLI)
pnpm desktop

# Build self-contained production desktop installer/binary
pnpm desktop:build
```

### Architecture Overview

```text
┌────────────────────────────────────────────────────────┐
│               React 19 Frontend Webview                │
│                                                        │
│  ┌───────────────────────┐   ┌─────────────────────────┐ │
│  │   Zustand UI Stores   │   │ Import ⇄ Workbench UI   │ │
│  │ (source, export, theme│   │ (TopBar, Sources,       │ │
│  │                       │   │  Review, ExportDrawer)  │ │
│  └───────────┬───────────┘   └─────────────────────────┘ │
│              ▼                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │       Pure TypeScript Conversion Engine          │  │
│  │          (@show-converter/engine)                │  │
│  │ (In-memory parsing, canonical model, formatting) │  │
│  └───────────────────────────┬──────────────────────┘  │
│                              │                         │
│               Platform Adapter Abstraction             │
└──────────────────────────────┼─────────────────────────┘
                               │ IPC Bridges
┌──────────────────────────────▼─────────────────────────┐
│               Tauri 2 Rust Host Runtime                │
│  - @tauri-apps/plugin-dialog (Native file/dir picker)  │
│  - @tauri-apps/plugin-fs     (Binary filesystem I/O)   │
│  - @tauri-apps/plugin-opener (Open in file explorer)   │
│  - @tauri-apps/api/window    (Frameless drag/controls) │
└────────────────────────────────────────────────────────┘
```

1. **Pure TypeScript In-Webview Engine:** All parsing (Protobuf, XML, RTF, JSON), canonical normalization, format sniffing, and codec serialization execute entirely inside the webview JS runtime (`@show-converter/engine`). Zero conversion payloads traverse the Rust IPC boundary.
2. **Lightweight Tauri Native Bridges:** The Rust host remains lean and secure, providing OS integration via Tauri 2 official plugins for native file picker dialogs, binary file read/write, native directory opening, and frameless window control.
3. **Dual-Mode Platform Adapter (`PlatformAdapter`):** A clean interface layer that dynamically resolves to `TauriPlatformAdapter` inside Tauri webviews or `MockPlatformAdapter` / `WebPlatformAdapter` in browsers or CI test runners, allowing 100% of desktop UI behaviors and batch exports to be tested in automated React component tests without Rust dependencies.

### Desktop UI Guide

The shell has two stages — an empty **Import** drop screen and a loaded **Workbench** — plus a persistent TopBar:

1. **Import stage** (no sources loaded):
   - Drop screen headline **"Drop songs to convert"** with formats line; drop files/folders or use `Add Files` / `Add Folder`.
   - Supported path drops route files by extension and directories via recursive scan; a drop that finds nothing toasts **"No supported songs found"**.

2. **TopBar:** Sources chip (count; shown while the sources rail is collapsed — click to re-expand), theme toggle (Light / Dark / System), and frameless window controls (minimize, maximize/restore, close) with drag region.

3. **Sources rail** (left, collapsible):
   - `Add Files` / `Add Folder` pickers and HTML5/native drop targets.
   - Multi-song accordions for VideoPsalm `.vpc`, FreeShow `.show`, and PowerPoint `.pptx`.
   - Per-song checkboxes with **Select all** / **Select none** text actions and an `n/n` selected chip.

4. **Center (Content | Details | ⋯):**
   - **Content** tab with Structure / Projection segment (song spine or 16:9 slide cards), title, format badge, warning chip, and Copy lyrics.
   - **Details** tab with editable title and Author / CCLI / Copyright metadata cards.
   - Overflow (⋯) menu opens Full diagnostics and Raw JSON AST; first import after Clear All always lands on Content / Structure.

5. **Export drawer** (right, collapsible):
   - Collapsed peek: format chip (opens expanded settings), destination path or "No folder selected", pinned Export button with helper (`Select songs to export` / `Pick an output folder`).
   - Expanded: target format options, multi-song combine / library folder, collision policy, output directory.
   - Batch progress modal on export with per-item results; no status bar.

---

## CLI Usage

The package ships with an executable binary `show-converter` (Node.js 20+ zero external CLI dependencies using native `node:util.parseArgs`).

### Quick Start via `npx` or Global Install

```bash
# Run directly via npx without local installation
npx show-converter --help

# Or install globally
npm install -g show-converter-engine
show-converter --help
```

### 1. List Supported Formats (`formats`)

List all supported formats, extensions, and import/export capabilities:

```bash
show-converter formats
```

Sample output:
```text
Format ID  Format Name      Extensions  Import  Export
---------  ---------------  ----------  ------  ------
pro        ProPresenter 7+  .pro        Yes     Yes   
pro6       ProPresenter 6   .pro6       Yes     No    
vpc        VideoPsalm VPC   .vpc        Yes     Yes   
json       VideoPsalm JSON  .json       Yes     No    
freeshow   FreeShow         .show       Yes     Yes   
txt        Plain Text       .txt        Yes     Yes   
pptx       PowerPoint       .pptx       Yes     Yes   
```

For programmatic pipelines, pass `--json` to emit a parseable JSON array:
```bash
show-converter formats --json
```

Sample output:
```json
[
  {
    "id": "pro",
    "label": "ProPresenter 7+",
    "extensions": [
      ".pro"
    ],
    "canImport": true,
    "canExport": true
  },
  ...
]
```

---

### 2. Inspect Presentations (`inspect`)

Inspect the canonical presentation structure, metadata, slide counts, section layouts, and import warnings:

```bash
show-converter inspect WorshipSong.pro
```

Sample output:
```text
File: WorshipSong.pro
Format: ProPresenter 7+ (pro)
Presentations: 1

--- Presentation 1: Amazing Grace ---
Title: Amazing Grace
Author: John Newton
CCLI: 27136
Copyright: Public Domain
Total Slides: 4
Sections (2):
  - Verse 1: 2 slides
  - Verse 2: 2 slides
```

Dump the raw intermediate canonical `Library` representation as formatted JSON:
```bash
show-converter inspect WorshipSong.pro --json
```

---

### 3. Convert Presentations (`convert`)

Convert presentation files from any supported source format to any exportable target format:

```bash
show-converter convert <input> -t <format> [-o <out>] [-f] [--strict] [--song <id>] [--split <dir>] [--json]
```

#### Options Reference

| Flag | Description |
|---|---|
| `-t, --to <format>` | **Required.** Target format ID: `pro`, `vpc`, `freeshow`, `txt`, `pptx`. |
| `-o, --out <path>` | Destination file or directory path. Defaults to `./<input-basename>.<ext>`. |
| `-f, --force` | Overwrite existing output file (otherwise exits with code 3). |
| `--strict` | Strict mode: treat non-fatal formatting warnings as errors (exit code 1). |
| `--song <index\|title>` | Select single song from multi-song container (1-based index or title substring). |
| `--split <dir>` | Unpack multi-song container into separate files inside `<dir>`. |
| `--json` | Output structured conversion summary on `stdout`. |

#### Root Shorthand

The `convert` subcommand is the default action and may be omitted:

```bash
# Equivalent to: show-converter convert WorshipSong.pro -t vpc
show-converter WorshipSong.pro -t vpc

# Specify destination file path
show-converter WorshipSong.pro -t txt -o ./lyrics/WorshipSong.txt

# Target existing directory (resolves to ./dist/WorshipSong.pptx)
show-converter WorshipSong.pro -t pptx -o ./dist/ -f
```

---

### 4. Multi-Song Safety (`--split` and `--song`)

Songbook archives (such as VideoPsalm `.vpc` or FreeShow `.show`) frequently contain dozens or hundreds of songs. Formats such as ProPresenter 7 (`.pro`), Plain Text (`.txt`), and PowerPoint (`.pptx`) only hold a single presentation per file.

To prevent silent data loss, `show-converter` **fails closed** with exit code `2` if a multi-song source is converted to a single-song target without unpacking instructions:

```bash
# Fails with exit code 2:
show-converter Hymnal.vpc -t pro
# Error: Input "Hymnal.vpc" contains 274 songs, but target format "pro" only supports 1 song per file.
# Use --split <dir> to unpack all songs or --song <index|title> to convert one.
```

#### Option A: Unpack All Songs with `--split`
Unpacks every song into a distinct file within the specified directory. Song titles are automatically sanitized for file systems, and duplicate names receive numeric disambiguation (`Title (2).pro`):

```bash
show-converter Hymnal.vpc -t pro --split ./pro-library/
```

#### Option B: Extract a Single Song with `--song`
Extract a single song by its 1-based index or case-insensitive title search:

```bash
# Select by 1-based index
show-converter Hymnal.vpc -t pro --song 1 -o ./FirstSong.pro

# Select by title substring (case-insensitive)
show-converter Hymnal.vpc -t pro --song "amazing grace" -o ./Grace.pro
```

---

### 5. Batch Conversion (Phase 2)

Batch processing allows converting multiple individual files, entire directories of songs, and multi-presentation archives without manual per-file scripting.

#### 5.1 Directory Conversion Auto-Routing

When passing a directory to `convert`, the CLI automatically routes to the batch engine:

```bash
show-converter convert ./hymns_folder/ -t pro -o ./output/
```

#### 5.2 Dedicated Batch Command (`batch`)

Process one or more files, folders, or mixed sources:

```bash
show-converter batch <inputs...> -t <format> -o <outDir> [options]
```

Example converting mixed sources to plain text lyrics:
```bash
show-converter batch ./service_songs/*.vpc ./special.pro -t txt -o ./dist/lyrics/
```

#### 5.3 Recursive Directory Traversal (`-r, --recursive`)

Recursively traverse subdirectories depth-first, sniffing each file and skipping unsupported files:

```bash
show-converter batch ./archive/ -t pro -o ./converted/ -r
```

#### 5.4 Combined Multi-Song Output (`--combine [name]`)

Merge all discovered presentations into a single unified output file instead of unpacking individual files:

- **PowerPoint (`.pptx`):** Generates native OpenXML `<p14:sectionLst>` sections with one section per song, a dedicated title/metadata cover slide (44pt title, 20pt subtitle with Author, CCLI, Copyright), and styled lyric slides (32pt regular, centered).
- **VideoPsalm (`.vpc`):** Bundles all songs into a single AES-128 encrypted multi-song songbook archive.
- **FreeShow (`.show`):** Bundles all presentations into a single multi-song JSON package with shared layout groups.

```bash
# Combine entire hymn folder into a single structured PowerPoint deck with sections
show-converter batch ./hymns/ -t pptx -o ./service/ --combine "Sunday_Service_Deck"

# Combine into a VideoPsalm songbook archive
show-converter batch ./lyrics/*.txt -t vpc -o ./dist/ --combine "ChurchHymnal"
```

*Note: Incompatible target formats (`pro`, `txt`) fail closed with exit code 3.*

#### 5.5 ProPresenter Library Export (`--library <name>`)

Export presentations as a native ProPresenter 7 library directory accompanied by an ordered `rv.data.Playlist` protobuf file (`<name>.proplaylist`):

```bash
show-converter batch ./songs/ -t pro -o ./ProLibrary/ --library "SundaySetlist"
```

Generates:
```text
ProLibrary/
└── SundaySetlist/
    ├── Amazing Grace.pro
    ├── How Great Thou Art.pro
    └── SundaySetlist.proplaylist
```
This folder and playlist can be imported directly into ProPresenter 7 with play order preserved.

#### 5.6 Collision Handling Policies (`--on-collision`)

Prevent accidental overwrites with deterministic collision strategies:

| Policy | Behavior |
|---|---|
| `rename` (Default) | Automatically appends numeric disambiguation (`Song (2).pro`, `Song (3).pro`). |
| `skip` | Skips conversion if destination file exists on disk, recording item as `skipped`. |
| `overwrite` | Replaces existing file on disk (`-f, --force` is a CLI alias for overwrite). |
| `error` | Fails the item with an error, marking item as `failed` (exits with code 2). |

Example:
```bash
show-converter batch ./new_hymns/ -t pro -o ./library/ --on-collision skip
```

#### 5.7 Batch Command Options Reference

| Flag | Description |
|---|---|
| `-t, --to <format>` | **Required.** Target format ID: `pro`, `vpc`, `freeshow`, `txt`, `pptx`. |
| `-o, --out <outDir>` | **Required.** Output directory path. |
| `-r, --recursive` | Recursively scan directories for supported presentation files. |
| `--combine [name]` | Bundle all presentations into a single combined file (`pptx`, `vpc`, `show`). |
| `--library <name>` | Generate ProPresenter 7 library folder with `.proplaylist` (`pro` only). |
| `--on-collision <policy>` | Collision policy: `rename` (default), `skip`, `overwrite`, `error`. |
| `-f, --force` | Alias for `--on-collision overwrite`. |
| `--strict` | Treat warnings as errors; exits with code 1 if any warnings occur. |
| `--json` | Emit complete machine-readable `BatchSummary` JSON on `stdout`. |

---

### 6. Exit Codes

`show-converter` uses deterministic exit codes for shell scripts and CI/CD pipelines:

| Exit Code | Classification | Trigger Condition |
|:---:|---|---|
| **`0`** | **Success** | Operation completed successfully. Non-fatal warnings (if any) printed to `stderr`. |
| **`1`** | **Warning (Strict)** | Conversion succeeded, but non-fatal fidelity warnings occurred while `--strict` was active. Output file is still written. |
| **`2`** | **Engine / Conversion Error** | Import failure, corrupted archive, unsupported codec operation, multi-song collision without `--split`/`--song`, or one or more batch items failed. |
| **`3`** | **CLI / User Error** | Invalid or missing arguments, missing input file/directory, unexportable format ID, incompatible flags (e.g. `--combine` with `pro`), or output file already exists without `-f`. |

---

### 7. Streaming Discipline (`stdout` vs `stderr`)

The CLI strictly separates machine-readable data from human diagnostics:
- **`stdout`:** Dedicated exclusively to successful outputs. Emits either the path of the created file, the human-readable summary, or raw JSON when `--json` is passed. Safe for piping into `jq`, file redirects (`>`), or downstream scripts.
- **`stderr`:** Reserved for error messages (`[ERROR]`), user warnings, and non-fatal conversion diagnostics (`[WARN]`, `[INFO]`).

Example piping JSON output directly into `jq`:
```bash
show-converter formats --json | jq '.[].id'
```

---

## Setup & Installation

### Requirements
- **Node.js**: v20.0.0 or higher
- **npm**: v9.0.0 or higher

### Install dependencies
```bash
npm install
```

### Build TypeScript
```bash
npm run build
```
Compiled output emits to `./dist`.

### Run Test Suite
```bash
npm test
```
Runs Vitest across 23 test suites (427 tests) covering codecs, batch processing, CLI commands, round-trip matrix, and real-world sample corpus. Pretest automatically rebuilds TypeScript.

---

## Usage Guide

### 1. Direct File-to-File Conversion

Convert source file bytes directly into target format bytes:

```typescript
import { readFileSync, writeFileSync } from "node:fs";
import { convertFile } from "show-converter-engine";

// Read source file into Uint8Array
const sourceBytes = new Uint8Array(readFileSync("WorshipSong.vpc"));

// Convert from VideoPsalm (.vpc) to ProPresenter 7 (.pro)
const result = await convertFile(sourceBytes, "WorshipSong.vpc", "pro");

if (result.ok) {
  writeFileSync("WorshipSong.pro", result.bytes);
  console.log("Converted successfully. Warnings:", result.warnings);
} else {
  console.error("Conversion failed:", result.error.message);
}
```

---

### 2. Import File into Canonical Model

Import raw bytes into the intermediate `Library` and inspect presentations, sections, and slides:

```typescript
import { importFile } from "show-converter-engine";

const bytes = new Uint8Array(readFileSync("SundayService.show"));
const result = await importFile(bytes, "SundayService.show");

if (!result.ok) {
  throw result.error;
}

const library = result.value;
for (const presentation of library.presentations) {
  console.log(`Title: ${presentation.title}`);
  console.log(`Author: ${presentation.metadata.author ?? "Unknown"}`);
  console.log(`Sections: ${presentation.sections.map((s) => s.name).join(", ")}`);
  console.log(`Slide count: ${presentation.slides.length}`);

  for (const slide of presentation.slides) {
    const text = slide.items.map((i) => i.plainText).join("\n");
    console.log(`--- Slide (${slide.label ?? "no label"}) ---\n${text}`);
  }
}
```

---

### 3. Export Canonical Library to Target Format

Export canonical presentations to any supported output format:

```typescript
import { exportLibrary, exportPresentation } from "show-converter-engine";

// Export entire library (supports multi-song for .vpc and .show)
const vpcResult = await exportLibrary(library, "vpc");
if (vpcResult.ok) {
  writeFileSync("Songbook.vpc", vpcResult.bytes);
}

// Export single presentation to ProPresenter 7
const proResult = await exportPresentation(library.presentations[0]!, "pro");
if (proResult.ok) {
  writeFileSync("SingleSong.pro", proResult.bytes);
}
```

---

### 4. Format Sniffing & Auto-Detection

Detect presentation formats by file extension with magic-byte fallback:

```typescript
import { detectFormat } from "show-converter-engine";

const format = detectFormat("unknown-file", bytes);
console.log(`Detected format: ${format}`); // "pro" | "vpc" | "show" | "txt" | "pptx" | undefined
```

---

### 5. Programmatic Batch Conversion (`batchConvert`)

Convert sets of files and directories with progress streaming, collision policies, and combined output options:

```typescript
import {
  batchConvert,
  type BatchConvertOptions,
  type BatchSummary,
} from "show-converter-engine";

const options: BatchConvertOptions = {
  inputs: ["./hymns_folder/", "./special_song.vpc"],
  to: "pptx",                                  // Target format: "pro" | "vpc" | "freeshow" | "txt" | "pptx"
  outDir: "./output_decks/",
  recursive: true,                             // Deep directory scan
  combine: true,                               // Combine all presentations into one file
  combineName: "SundayServiceDeck",            // Output name (e.g. SundayServiceDeck.pptx)
  onCollision: "rename",                       // "rename" | "skip" | "overwrite" | "error"
  strict: false,
};

const summary: BatchSummary = await batchConvert(options, (progress) => {
  console.log(
    `[${progress.currentFile}/${progress.totalFiles}] ${progress.sourcePath} -> ${progress.status}`
  );
});

console.log(
  `Success: ${summary.successCount}/${summary.totalSongs} songs converted (${summary.durationMs}ms)`
);
if (summary.combinedOutputPath) {
  console.log(`Combined output generated: ${summary.combinedOutputPath}`);
}
```

---

## Canonical Data Model

All conversions normalize through typed Zod-validated structures:

```typescript
interface Presentation {
  id: string;                               // UUID v4
  title: string;
  sourceFormat: SourceFormat;
  metadata: {
    author?: string;
    copyright?: string;
    ccli?: string;
    notes?: string;
    originalFileName?: string;
  };
  sections: Array<{
    id: string;
    name: string;                           // "Verse 1", "Chorus", "Bridge", etc.
    color?: string;                         // Hex color (#rrggbb) if provided
    slideIds: string[];                     // Ordered IDs of slides in this section
  }>;
  arrangements: Array<{
    id: string;
    name: string;                           // e.g. "Default", "Standard"
    slideIds: string[];                     // Linear play order of slides
  }>;
  slides: Array<{
    id: string;
    label?: string;
    items: Array<{
      type: "text";
      plainText: string;
      richText?: Array<{ text: string; style?: Record<string, string> }>;
    }>;
  }>;
  warnings: Warning[];                      // Non-fatal fidelity loss diagnostics
}

interface Library {
  presentations: Presentation[];
}
```

---

## Diagnostic Warnings

Conversions return structured non-fatal diagnostics when format limitations prevent 1:1 mapping:

```typescript
interface Warning {
  code: string;                             // e.g. "VPC_TAG_UNMAPPED", "PRO_STYLES_NOT_EXTRACTED"
  severity: "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
}
```

Common diagnostic codes:
- `VPC_TAG_UNMAPPED`: Section name not in standard VideoPsalm tag list; preserved as named verse.
- `PRO_STYLES_NOT_EXTRACTED`: Source contained RTF formatting; plain text extracted.
- `PPTX_STYLES_NOT_EXTRACTED`: PowerPoint run styling omitted in text-only mode.
- `SECTION_DANGLING_SLIDE`: Reference to missing slide ID detected and safely pruned.

---

## Project Structure

```text
show-converter/
├── packages/
│   └── engine/                # Core conversion engine (@show-converter/engine)
│       ├── src/
│       │   ├── canonical/     # Canonical schema, types, warnings, normalizers
│       │   ├── formats/       # Codecs: propresenter, videopsalm, freeshow, txt, pptx
│       │   ├── batch/         # Batch engine, scanner, collision, playlist
│       │   ├── pipeline/      # Format registry, detector, convert orchestration
│       │   ├── cli/           # CLI interface (parseArgs, commands, streaming)
│       │   └── fixtures/      # Deterministic test fixtures ("Amazing Grace")
│       └── test/              # 23 test suites (unit, roundtrip, corpus)
├── apps/
│   └── desktop/               # Native desktop GUI app (@show-converter/desktop)
│       ├── src/
│       │   ├── components/    # TopBar, SourcesSidebar, ReviewWorkspace, ExportDrawer, ImportStage, Toast
│       │   ├── state/         # Zustand stores (sourceStore, exportStore, uiStore, themeStore, dndStore)
│       │   ├── platform/      # PlatformAdapter abstraction (Tauri, Mock, Web)
│       │   └── App.tsx        # Two-stage shell: Import stage → Workbench
│       ├── src-tauri/         # Tauri 2 Rust application host and OS bridges
│       └── test/              # Vitest + React Testing Library component & E2E tests
├── docs/                      # Phase 1, Phase 2, and Phase 3 milestone reports & specs
├── package.json               # Monorepo workspaces configuration
└── tsconfig.json
```

---

## License

MIT License. See [package.json](./package.json).
All third-party schemas and reverse-engineered format handlers comply with clean-room or vendored MIT terms. Zero GPL code included.
