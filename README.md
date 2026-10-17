# Show Converter Engine

Pure TypeScript conversion engine and CLI utility for worship presentations and church lyrics. Mediates conversions across formats using an intermediate canonical model without UI or desktop framework dependencies.

---

## Supported Formats

| Format | Extension | Import | Export | Multi-Song | Notes |
|---|---|---|---|---|---|
| **ProPresenter 7** | `.pro` | Yes | Yes | Single | Protobuf, 1080p canvas, bounds geometry, RTF codec |
| **ProPresenter 6** | `.pro6` | Yes | No | Single | XML parsing, base64 RTF decoding |
| **VideoPsalm** | `.vpc` | Yes | Yes | Yes | AES-128 encrypted ZIP, universal format key, dialect repair |
| **VideoPsalm JSON** | `.json` | Yes | No | Yes | Diagnostic import of unquoted JSON dialect |
| **FreeShow** | `.show` | Yes | Yes | Yes | Clean-room JSON format codec, layout groups, multi-song |
| **Plain Text** | `.txt` | Yes | Yes | Single | Section markers (`[Verse 1]`, `[Chorus]`), blank-line slide breaks |
| **PowerPoint** | `.pptx` | Yes | Yes | Single | Text-only OpenXML presentation package, 16:9 widescreen |

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
    "name": "ProPresenter 7+",
    "extensions": [".pro"],
    "canImport": true,
    "canExport": true,
    "supportsMultiSong": false
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

### 5. Exit Codes

`show-converter` uses deterministic exit codes for shell scripts and CI/CD pipelines:

| Exit Code | Classification | Trigger Condition |
|:---:|---|---|
| **`0`** | **Success** | Operation completed successfully. Non-fatal warnings (if any) printed to `stderr`. |
| **`1`** | **Warning (Strict)** | Conversion succeeded, but non-fatal fidelity warnings occurred while `--strict` was active. Output file is still written. |
| **`2`** | **Engine / Conversion Error** | Import failure, corrupted archive, unsupported codec operation, or multi-song collision without `--split`/`--song`. |
| **`3`** | **CLI / User Error** | Invalid or missing arguments, missing input file, unexportable format ID, or output file already exists without `-f`. |

---

### 6. Streaming Discipline (`stdout` vs `stderr`)

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
Runs Vitest across 17 test suites (330 tests) covering codecs, CLI commands, round-trip matrix, and real-world sample corpus. Pretest automatically rebuilds TypeScript.

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
├── src/
│   ├── index.ts               # Public engine exports
│   ├── canonical/             # Canonical schema, types, warnings, normalizers
│   ├── formats/               # Format codecs (isolated directories)
│   │   ├── propresenter/      # .pro / .pro6 Protobuf and XML codecs, RTF codec
│   │   ├── videopsalm/        # .vpc AES ZIP codec, JSON dialect parser/serializer
│   │   ├── freeshow/          # .show clean-room JSON codec
│   │   ├── txt/               # .txt marker codec
│   │   └── pptx/              # .pptx OpenXML text-only codec
│   ├── pipeline/              # Format registry, detector, convert orchestration
│   └── fixtures/              # Deterministic test fixtures ("Amazing Grace")
├── test/
│   ├── unit/                  # Codec and canonical unit tests
│   ├── roundtrip/             # 20-pair cross-format roundtrip matrix tests
│   └── corpus/                # Real-world sample file verification suite
├── docs/                      # Phase 1 verification report and specifications
├── package.json
└── tsconfig.json
```

---

## License

MIT License. See [package.json](./package.json).
All third-party schemas and reverse-engineered format handlers comply with clean-room or vendored MIT terms. Zero GPL code included.
