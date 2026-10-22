# Show Converter — Desktop UX & Ergonomics Redesign Specification

**Date:** 2026-10-22  
**Status:** Approved by User  
**Target:** `apps/desktop`

---

## 1. Intent & User Persona

- **Primary Persona:** Worship technician preparing for Sunday service.
    - **Core Goal:** Import a set of presentation files, spot-check lyrics quickly, and export to the target presentation format (default ProPresenter 7 `.pro`).
    - **Success Moment:** Clicks **Export (N songs)**, observes progress, receives batch completion summary with success counts, and optionally opens output folder.
- **Secondary Persona:** Media librarian converting batches/archives of files.
    - **Core Goal:** Dump directory of 20+ songs, select all / none / subset, export in bulk with collision and naming controls.
- **Visual Feel & Hierarchy:**
    - Initial experience: Calm, focused, and minimal (inspired by Linear / Things desktop apps). No empty sidebars or multi-pane chrome on first launch.
    - In-use experience: Contextually dense desktop media tool ergonomically suited for batch manipulation, lyric inspection, slide preview, and export tuning.

---

## 2. Two-Stage Layout Architecture

The application transitions dynamically between two distinct stages based on whether sources are loaded (`sources.length === 0` vs `sources.length > 0`):

### Stage 1: Import Stage (Empty State)

When no files are loaded into `sourceStore`:

- **TopBar:** Slim custom header with brand title, theme selector (light/dark/system), and native window controls.
- **Main View:** Centered, spacious drop zone with:
    - Headline: `Drop songs to convert`
    - Concise supported formats line:  
      `ProPresenter .pro/.pro6 · VideoPsalm .vpc/.json · FreeShow .show · Plain Text .txt · PowerPoint .pptx`
    - Clickable drop target area (click triggers native file picker `pickFiles()`).
    - Secondary text action buttons: `Add Files` and `Add Folder`.
- **Suppressed Chrome:** No `SourcesSidebar`, no `ExportSidebar`, no `StatusBar`, and no multi-tab empty review pane.

### Stage 2: Workbench Stage (≥ 1 Source File)

When files exist in `sourceStore`:

- **TopBar:**
    - Brand name `Show Converter` and version badge.
    - When Sources rail is collapsed: `Sources (N)` chip in the TopBar with click-to-expand.
    - Theme selector and native window controls.
- **Sources Rail (Left):**
    - Always visible by default; collapsible via a chevron in the rail header.
    - User collapse preference remembered (persisted in localStorage / UI state).
    - Header: `Sources · N files`, `n/n selected` badge, compact text actions `Select all` and `Select none`.
    - Song selection checkboxes always accessible for batch operations. Collapsing or expanding never clears or alters the active song selection.
- **Center Review Workspace:**
    - Primary Tab Bar: `Content` (default), `Details`, and `⋯` (Overflow Menu).
    - **Content Tab:**
        - Header: Format badge, song title & filename breadcrumb, severity-aware warning chip, segmented control `Structure | Projection` (Structure default), and `Copy lyrics` button (available in both Structure and Projection modes).
        - `Structure` view: Lyrics spine with colored section tags and slide text blocks.
        - `Projection` view: 16:9 aspect-ratio slide preview cards preserving full formatting.
        - Warning chip: Displays severity count (`info`, `warn`, `error`). Clicking opens the **Warnings Sheet/Modal** without navigating away from the Content tab.
    - **Details Tab:**
        - Dedicated view for deliberate metadata editing (Title, Author, CCLI, Copyright, Language, Theme, Notes).
        - Metrics strip (source format, section count, slide count).
        - Arrangement flow visualization card.
    - **`⋯` Overflow Menu:**
        - `Full Diagnostics` (opens diagnostics sheet).
        - `Raw JSON AST` (opens JSON inspection viewer).
- **Export Drawer (Right):**
    - **Collapsed Peek (Default):**
        - Target format selector (default ProPresenter `.pro`).
        - Destination directory status (truncated path, or amber `No folder selected` notice).
        - Prominent `Export (N songs)` action button.
        - Chevron / toggle to expand full settings drawer.
    - **Expanded Drawer:**
        - Target format grid.
        - Multi-song options: Combine into single file (pptx, vpc, show), Library folder mode (pro).
        - Collision policy select: `Auto-rename`, `Skip existing`, `Overwrite`, `Error`.
        - Output directory input with browse button.
    - **Enablement & Validation Rules:**
        - Disabled when 0 songs selected with helper: `Select songs to export`.
        - Disabled when destination unset with helper: `Pick an output folder` (clicking expands drawer and focuses path input).
        - Routine export is 1-click when destination and format are set.
        - Collapsing drawer preserves all configured settings.
        - Engine `error`-severity warnings do NOT block export by default; output may be partial, which is explained in warnings diagnostics.
- **StatusBar:**
    - Removed entirely. Relevant counts live contextually in the Sources header and the Export button.
- **BatchProgressModal:**
    - Maintained for active export progress and terminal summary report with `Open Output Folder` action.

---

## 3. Component Hierarchy & File Seams

Adheres strictly to the modularity standard (< 400 lines per file, ~200 lines per component, pure helpers in `lib/`):

```text
apps/desktop/src/
├── App.tsx                               # Stage router: ImportView vs Workbench
├── components/
│   ├── TopBar.tsx                        # Header + window controls + collapsed rail count
│   ├── import/
│   │   └── ImportStage.tsx               # Minimal first-screen drop target & format hint
│   ├── source/
│   │   ├── SourcesSidebar.tsx            # Workbench left rail with collapse & select all/none
│   │   └── SourceList.tsx                # Accordion & song checkbox items
│   ├── review/
│   │   ├── ReviewWorkspace.tsx           # Center workspace coordinator with Content/Details tabs
│   │   ├── ContentHeader.tsx             # Breadcrumb, warning chip, Structure/Projection segment, Copy
│   │   ├── ContentTab.tsx                # Segmented container for Structure and Projection
│   │   ├── StructureView.tsx             # Lyrics spine & text blocks
│   │   ├── ProjectionView.tsx            # 16:9 projection simulator grid
│   │   ├── DetailsTab.tsx                # Metadata editor, metrics strip, arrangement flow
│   │   ├── WarningsSheet.tsx             # Contextual severity-aware diagnostics sheet
│   │   ├── JsonViewerModal.tsx           # AST JSON viewer modal/sheet from overflow
│   │   └── tabsRegistry.tsx              # Tab definitions & overflow menu items
│   ├── export/
│   │   ├── ExportDrawer.tsx              # Collapsible right drawer with peek & expanded views
│   │   ├── ExportPeek.tsx                # Compact 1-click export bar
│   │   ├── ExportSettings.tsx            # Full configuration panel
│   │   └── FormatOptions.tsx             # Target format picker
│   ├── BatchProgressModal.tsx            # Progress & terminal batch summary
│   ├── DropOverlay.tsx                   # Unified drop overlay
│   └── ui/                               # shadcn primitives
├── state/
│   ├── sourceStore.ts                    # Sources & selected songs
│   ├── exportStore.ts                    # Export settings & execution
│   ├── themeStore.ts                     # Light/dark/system theme
│   ├── dndStore.ts                       # Drag-and-drop hit testing
│   └── uiStore.ts                        # UI state: sources rail collapsed, export drawer expanded, etc.
└── lib/
    ├── formatLabels.ts
    ├── sectionStyle.ts
    ├── slideText.ts
    ├── lyrics.ts
    ├── exportPath.ts
    ├── exportItem.ts
    ├── useFlash.ts
    └── useSlideToSectionMap.ts
```

---

## 4. Toast & Transition Ergonomics

- On initial import from `ImportStage`:
    - Instant transition into `Workbench`.
    - First source file automatically selected and expanded.
    - First presentation active in `ContentTab` (`Structure` view).
    - 2-second non-blocking toast: `Imported N songs`.
- Export error reporting:
    - If any write fails during export, terminal summary surfaces itemized failure reasons without false success reports.
