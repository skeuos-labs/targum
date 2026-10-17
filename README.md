# Show Converter Engine

Pure TypeScript conversion engine for worship presentations and church lyrics. Mediates conversions across formats using an intermediate canonical model without UI or desktop framework dependencies.

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
Runs Vitest across 14 test suites covering codecs, round-trip matrix, and real-world sample corpus.

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
