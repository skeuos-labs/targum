# Show Converter — Conversion Engine Rebuild Design Spec

**Date:** 2026-10-17  
**Status:** Draft / Pending Review  
**Author:** Show Converter Engineering  

---

## 1. Executive Summary & Goals

Rebuild the core conversion engine of Show Converter from the ground up in `./show-converter/`. The engine is pure TypeScript running in standard Node.js (ESM), completely isolated from any graphical interface, Tauri, or Electron desktop runtimes.

The conversion engine serves as the single source of truth for presentation file conversions across church presentation formats:
- **Primary conversion pair:** ProPresenter (`.pro`) and VideoPsalm (`.vpc`) in both directions.
- **Secondary formats:** ProPresenter 6 (`.pro6` import only), FreeShow (`.show`), TXT (`.txt`), and PowerPoint (`.pptx` text-only).

### Core Principles
1. **Single Package Architecture:** Single npm package (`show-converter-engine`) with isolated per-format handler directories under `src/formats/`.
2. **Canonical Mediation:** Formats convert to/from an intermediate canonical representation (`Presentation` / `Library`), preventing an $O(N^2)$ converter explosion.
3. **Fidelity & Diagnostics:** Content and metadata are preserved wherever possible. Unmapped attributes append structured `Warning` objects rather than throwing exceptions or discarding data silently.
4. **Clean-room Upstream Usage:** Clean-room implementation of FreeShow format mappings (GPL-3.0 isolation). Vendored ProPresenter schemas used under MIT license.
5. **Deterministic Testing:** Test-driven development with a public-domain canonical baseline fixture ("Amazing Grace") and a real-world sample corpus.

---

## 2. System Architecture & Directory Layout

### 2.1 File & Directory Structure

```text
show-converter/
├── .gitignore
├── package.json               # type: "module", scripts: build, test, lint
├── tsconfig.json              # strict: true, target: ES2022, moduleResolution: NodeNext
├── vitest.config.ts
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-10-17-conversion-engine-design.md
├── src/
│   ├── index.ts               # Public API: importFile, exportLibrary, exportPresentation, types
│   ├── canonical/             # Canonical data model & validators
│   │   ├── index.ts
│   │   ├── types.ts           # TypeScript interfaces (Presentation, Slide, Section, etc.)
│   │   ├── schema.ts          # Zod runtime schemas
│   │   ├── warnings.ts        # Warning factory, severity levels, diagnostic codes
│   │   ├── normalize.ts       # Text derivation, cross-reference integrity validation
│   │   └── id.ts              # UUID generator wrapper
│   ├── formats/               # Format-specific codecs
│   │   ├── propresenter/
│   │   │   ├── index.ts
│   │   │   ├── parse.ts       # .pro Protobuf reader
│   │   │   ├── write.ts       # .pro Protobuf writer (1080p, geometry, RTF)
│   │   │   ├── pro6.ts        # .pro6 XML reader
│   │   │   ├── rtf.ts         # RTF encoder/decoder
│   │   │   ├── root.ts        # Protobufjs Root loader
│   │   │   └── protoBundle.json # Precompiled 53 protobuf schemas (MIT)
│   │   ├── videopsalm/
│   │   │   ├── index.ts
│   │   │   ├── key.ts         # Universal hardcoded VPC_KEY
│   │   │   ├── vpc.ts         # .vpc AES-zip archive reader
│   │   │   ├── write.ts       # .vpc AES-zip archive writer
│   │   │   └── json.ts        # VideoPsalm custom JSON dialect parser/serializer
│   │   ├── freeshow/
│   │   │   ├── index.ts
│   │   │   └── codec.ts       # Clean-room .show JSON reader & writer
│   │   ├── txt/
│   │   │   ├── index.ts
│   │   │   └── codec.ts       # Section-marker lyric text reader & writer
│   │   └── pptx/
│   │       ├── index.ts
│   │       └── codec.ts       # Text-only PowerPoint reader & writer (jszip + xml)
│   ├── pipeline/              # Conversion pipeline & registry
│   │   ├── registry.ts        # Format definitions, capabilities matrix
│   │   ├── detector.ts        # Format sniffing (extensions + magic bytes)
│   │   └── convert.ts         # Pipeline orchestration functions
│   └── fixtures/
│       └── amazing-grace.ts   # Deterministic canonical baseline fixture
└── test/
    ├── unit/                  # Codec and model unit tests
    ├── roundtrip/             # Cross-format round-trip tests
    └── corpus/                # Real-world fixture tests against assets-for-testing-purpose
```

---

## 3. Canonical Presentation Model

### 3.1 Data Schema

All presentation data is normalized into an intermediate representation defined with Zod:

```typescript
export interface Presentation {
  id: string;                                // UUID v4
  title: string;
  sourceFormat: SourceFormat;
  metadata: Metadata;
  sections: Section[];
  arrangements: Arrangement[];
  slides: Slide[];
  warnings: Warning[];
  retained?: Record<string, unknown>;        // Non-standard source properties
}

export type SourceFormat =
  | "pro"
  | "pro6"
  | "vpc"
  | "json"
  | "freeshow"
  | "txt"
  | "pptx"
  | "unknown";

export interface Metadata {
  author?: string;
  copyright?: string;
  ccli?: string;
  notes?: string;
  language?: string;
  originalFileName?: string;
  songId?: string;
  themeName?: string;
}

export interface Section {
  id: string;
  name: string;                              // e.g., "Verse 1", "Chorus", "Bridge"
  color?: string;                            // Hex color string if provided by source
  slideIds: string[];                        // Ordered slide IDs belonging to this section
}

export interface Arrangement {
  id: string;
  name: string;                              // e.g., "Default", "Standard"
  slideIds: string[];                        // Linear play order of slides
}

export interface Slide {
  id: string;
  label?: string;                            // e.g., "V1.1", "Chorus"
  items: TextItem[];
}

export interface TextItem {
  type: "text";
  plainText: string;
  richText?: RichTextRun[];
  style?: Record<string, string>;
}

export interface RichTextRun {
  text: string;
  style?: Record<string, string>;
}

export interface Library {
  presentations: Presentation[];
}
```

### 3.2 Integrity & Normalization Rules
1. **Multi-Song Containers:** `Library` is the standard container for all conversions. Single-song formats (e.g. `.pro`) produce a `Library` containing one `Presentation`.
2. **Text Normalization:** When `richText` runs are present, `plainText` is derived by concatenating the run texts.
3. **Reference Validation:** Every slide ID in `sections[].slideIds` and `arrangements[].slideIds` must exist in `slides[]`. Dangling IDs produce a structured `Warning` and are pruned from the sequence during export.
4. **Ordering Guarantees:** Slide order in `slides[]` represents the canonical pool of slides. `arrangements[]` specifies playback sequence. If no arrangement is provided, an implicit linear arrangement over all slides is generated.

### 3.3 Diagnostic System
Failures and degradations are explicit:
- Fatal errors return `Result<T>` with `{ ok: false, error: Error }`. Handlers never throw unhandled exceptions.
- Non-fatal fidelity loss appends a `Warning`:
  ```typescript
  export interface Warning {
    code: string;                            // e.g. "VPC_TAG_UNMAPPED", "PRO_ARRANGEMENT_FLATTENED"
    severity: "info" | "warn" | "error";
    message: string;
    context?: Record<string, unknown>;
  }
  ```

---

## 4. Format Handlers & Codec Specifications

### 4.1 ProPresenter 7 (`.pro`)
- **Technology:** Protobuf decoding/encoding via vendored `protoBundle.json` (53 schemas, MIT license from `greyshirtguy/ProPresenter7-Proto`).
- **Reader (`parsePro`):**
  - Walks `cues[]` -> `actions[]` -> `slide.presentation.baseSlide.elements[]`.
  - Decodes RTF bytes in each text element into canonical text.
  - Reconstructs slide cues, labels, groups/sections, and metadata.
- **Writer (`writePro`):**
  - Target canvas: `1920x1080` (1080p).
  - Background: Black opaque background (`color.alpha: 1`).
  - Text geometry: Bounds `{ origin: { x: 192, y: 270 }, size: { width: 1536, height: 540 } }` with normalized rect path (4 points).
  - Styling: Helvetica 48pt regular, center-aligned (`alignment: 2`), `scaleBehavior: 2`.
  - RTF: Generates valid 7-bit ASCII RTF with font table (`\f0\fswiss Helvetica`).
  - ProPresenter 7 contract: Cue `isEnabled: true`, action `type: "ACTION_TYPE_PRESENTATION_SLIDE"`, base slide background alpha 1.
  - Multi-song rule: Fails closed if `library.presentations.length !== 1`.

### 4.2 ProPresenter 6 (`.pro6`)
- **Scope:** Import only.
- **Technology:** XML parsing via `fast-xml-parser`.
- **Reader (`parsePro6`):**
  - Parses `RVPresentationDocument` root.
  - Decodes base64-encoded RTF data strings from `RVDisplaySlide` elements.
  - Extracts group names, slide labels, and document metadata.

### 4.3 VideoPsalm (`.vpc` & `.json`)
- **Technology:** AES-128 ZIP handling via `@zip.js/zip.js`.
- **Encryption Key:** Universal hardcoded constant `VPC_KEY` embedded in `key.ts`:
  ```typescript
  export const VPC_KEY = String.raw`5$l(va\7N_0!',/:5?M0.(d_<8+5!Um2#~M@{5#2(C3]$'f|#:Y/}wG+-)Nt:x^8!Y.5Eq$)'7stk$y)\.~Tg=&<l`;
  ```
  No config files, no environment variables, no prompt, and no runtime override parameter.
- **Reader (`parseVpc`):**
  - Extracts `.json` entry from AES-protected ZIP.
  - Parses VideoPsalm JSON dialect (unquoted keys, escaped quotes).
  - Maps songs into canonical `Presentation` objects in a `Library`.
  - Maps tags to standard section names (`1: Chorus`, `2: Prechorus`, `3: Bridge`, `4: Tag`, `5: Intro`, `6: Outro`, `8: Instrumental`, `9: Other`).
- **Writer (`writeVpc`):**
  - Converts canonical `Presentation[]` into VideoPsalm songbook structure.
  - Serializes to VideoPsalm JSON dialect (unquoted keys).
  - Compresses into AES-encrypted ZIP archive with single `.json` entry.

### 4.4 FreeShow (`.show`)
- **Scope:** Clean-room import and export.
- **Technology:** Pure TypeScript JSON codec.
- **Reader (`parseFreeShow`):**
  - Maps FreeShow presentations, slides, and groups into canonical `Presentation`.
  - Strips UI-specific and render-specific metadata while preserving lyric text, section groups, and notes.
- **Writer (`writeFreeShow`):**
  - Generates valid `.show` presentation file structure with default 1080p canvas and standard text elements.

### 4.5 TXT (`.txt`)
- **Reader (`parseTxt`):**
  - Detects section markers (`[Verse 1]`, `[Chorus]`, `Verse:`, `Chorus:`).
  - Double line breaks separate slides within the active section.
  - Text without markers placed in default "Verse" section.
- **Writer (`writeTxt`):**
  - Writes presentation title, metadata block (Author, CCLI), and section-grouped slides separated by clean blank lines.

### 4.6 PowerPoint (`.pptx`)
- **Scope:** Text-only import and export.
- **Technology:** `jszip` + lightweight XML parser / generator.
- **Reader (`parsePptx`):**
  - Extracts `<a:t>` text runs from `ppt/slides/slide*.xml`.
  - Reconstructs one canonical slide per PowerPoint slide.
- **Writer (`writePptx`):**
  - Generates standard OpenXML presentation package.
  - 16:9 widescreen layout (`9144000` x `5143500` EMUs).
  - Single centered text frame per slide, white text on dark background.

---

## 5. Pipeline & Detection

### 5.1 Format Sniffing
`detectFormat(fileName: string, bytes: Uint8Array): FormatId | undefined`
1. Extension check: `.pro`, `.pro6`, `.vpc`, `.json`, `.show`, `.txt`, `.pptx`.
2. Magic byte sniffing fallback:
   - `0x50, 0x4b` (`PK`): `.vpc` or `.pptx` (disambiguated by archive contents).
   - `0x0a` (Protobuf tag 1): `.pro`.
   - First non-whitespace `{` or `[`: `.json` or `.show`.

### 5.2 Unified Pipeline API
```typescript
export async function importFile(
  bytes: Uint8Array,
  fileName: string
): Promise<ImportResult>;

export async function exportLibrary(
  library: Library,
  formatId: FormatId
): Promise<ExportResult>;

export async function convertFile(
  bytes: Uint8Array,
  sourceFileName: string,
  targetFormat: FormatId
): Promise<ExportResult>;
```

---

## 6. Testing Strategy & Acceptance Criteria

### 6.1 Baseline Canonical Fixture ("Amazing Grace")
- Public domain hymn (John Newton, 1779).
- Structure: Title, Author, CCLI (`22025`), 4 Verses (2 slides each), synthetic Chorus (1 slide).
- Arrangements:
  - "Full": V1 -> C -> V2 -> C -> V3 -> C -> V4 -> C.
  - "Short": V1 -> V4.
- Baseline assertions: Every exporter must successfully serialize this fixture; every paired importer must re-import it with identical slide and lyric counts.

### 6.2 Test Corpus (Real-world samples)
- **ProPresenter:** `IZY-original.pro`, `Androany aloha.pro`, `Thank You Jesus for The Blood.pro`.
- **VideoPsalm:** `Cevam.vpc` (single song), `façade.vpc` (19 songs), `FFPM 2 - Antema.vpc` (274 songs).
- **ProPresenter 6:** `Marble Flow ProPresenter Template.pro6`.
- **TXT:** `IZY.txt`.

### 6.3 Acceptance Gates for Phase 1
- **All 6 formats** pass isolated unit tests.
- **Round-trip verification:**
  - `pro -> canonical -> pro`: lyric token match >= 95%, 1080p canvas preserved, bounds and font attributes preserved.
  - `vpc -> canonical -> vpc`: song count and slide count 100% preserved.
  - `pro -> vpc -> pro`: cross-format lyric retention >= 90%.
- **Edge cases covered:**
  - Empty slides / empty presentations.
  - Accented and special characters (UTF-8 / ISO-8859 / RTF escape sequences).
  - Malformed ZIP archives and corrupted Protobuf payloads (must return typed errors, never crash).
- **Test execution:** 100% passing tests in `npm test` across all suites.
- **No GUI dependencies:** Zero references to React, Electron, Tauri, or browser DOM.
