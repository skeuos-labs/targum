# Show Converter — Phase 3 Desktop GUI Design Specification

**Date:** 2026-10-18  
**Status:** Draft / Pending Review  
**Author:** Show Converter Engineering  

---

## 1. Executive Summary & Goals

Phase 3 builds the graphical desktop application for Show Converter using Tauri 2, Vite, React 19, TypeScript, Tailwind CSS, and shadcn/ui components.

The GUI is a pure consumer of the verified engine and batch processing modules developed in Phases 1 and 2. It contains zero format parsing, zero model transformations, and zero custom serializers.

### Core Principles
1. **Engine as Single Source of Truth:** All parsing, canonical normalization, export generation, and batch orchestration are handled by `@show-converter/engine`. The GUI only reads files into `Uint8Array`, calls engine methods, and renders typed canonical data.
2. **Platform Abstraction & Headless Testing:** A `PlatformAdapter` interface wraps Tauri filesystem, dialog, and opener plugins. An in-memory fallback enables 100% automated component and state testing in Vitest + React Testing Library without a display server or Tauri runtime.
3. **Responsive 3-Column Worship Layout:**
   - **Left (`SourcesSidebar`):** Tree of imported files, song badges, file/folder add buttons, drag-and-drop zone.
   - **Center (`ReviewWorkspace`):** Song overview card (Title, Author, CCLI, Copyright), section color chips, structured warnings banner, and ProPresenter-style 16:9 visual slide grid.
   - **Right (`ExportSidebar`):** Target format picker, export mode (individual, combined deck, ProPresenter library), collision policy, destination folder, and Export action.
4. **Theme Support:** Dark, light, and system themes powered by Tailwind CSS tokens and persisted in `localStorage`.
5. **Frameless Custom Window:** Custom title bar with drag region, window minimize/maximize/close controls, and format badges.

---

## 2. Workspace & Monorepo Structure

The repository is structured as an npm workspace:

```text
show-converter/
├── package.json               # Root workspace config: ["packages/*", "apps/*"]
├── packages/
│   └── engine/                # Verified conversion engine & CLI (from Phases 1 & 2)
│       ├── package.json       # @show-converter/engine
│       └── src/
└── apps/
    └── desktop/               # Tauri 2 + React 19 UI
        ├── package.json       # @show-converter/desktop
        ├── vite.config.ts
        ├── index.html
        ├── src-tauri/         # Rust native shell (Tauri 2)
        │   ├── Cargo.toml
        │   ├── tauri.conf.json
        │   ├── src/main.rs
        │   └── capabilities/
        ├── src/
        │   ├── main.tsx
        │   ├── App.tsx
        │   ├── styles.css
        │   ├── components/
        │   │   ├── TopBar.tsx
        │   │   ├── StatusBar.tsx
        │   │   ├── SourcesSidebar.tsx
        │   │   ├── ReviewWorkspace.tsx
        │   │   ├── ExportSidebar.tsx
        │   │   ├── BatchProgressModal.tsx
        │   │   └── ui/        # shadcn components (button, card, dialog, badge, etc.)
        │   ├── state/
        │   │   ├── sourceStore.ts
        │   │   ├── exportStore.ts
        │   │   └── themeStore.ts
        │   ├── platform/
        │   │   ├── adapter.ts
        │   │   ├── tauriAdapter.ts
        │   │   └── mockAdapter.ts
        │   └── utils/
        └── test/              # Vitest + RTL component & store tests
```

---

## 3. Platform Adapter Contract

All native OS operations are isolated behind the `PlatformAdapter` interface:

```typescript
export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface PlatformAdapter {
  /** Open native file picker (supports multiple files) */
  pickFiles(options?: { filters?: FileFilter[] }): Promise<string[] | null>;
  /** Open native directory picker */
  pickDirectory(options?: { title?: string }): Promise<string | null>;
  /** Read binary file from disk */
  readFile(path: string): Promise<Uint8Array>;
  /** Write binary file to disk */
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
  /** Read directory entries (returns paths of files inside) */
  readDir(path: string, options?: { recursive?: boolean }): Promise<string[]>;
  /** Check if path exists */
  exists(path: string): Promise<boolean>;
  /** Create directory recursively */
  createDir(path: string): Promise<void>;
  /** Open folder or file in OS file explorer */
  openPath(path: string): Promise<void>;
  /** Window control operations */
  window: {
    minimize(): Promise<void>;
    maximize(): Promise<void>;
    toggleMaximize(): Promise<void>;
    close(): Promise<void>;
  };
}
```

- In production (inside webview): `TauriPlatformAdapter` delegates to `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-opener`, and `@tauri-apps/api/window`.
- In tests & browser dev: `MockPlatformAdapter` stores files in an in-memory `Map<string, Uint8Array>` and mocks dialog responses.

---

## 4. UI Architecture & State Management

State is separated into three focused Zustand stores per Spec §7.2:

### 4.1 `sourceStore`
- `sources`: Array of imported source records:
  ```typescript
  interface SourceFile {
    id: string;
    path: string;
    name: string;
    format: FormatId;
    library: Library;
    warnings: Warning[];
    selectedSongId?: string;
  }
  ```
- `selectedSourceId`: Active file in the left sidebar.
- `selectedSongId`: Active presentation within the selected source file.
- `selectedSongs`: `Set<string>` (composite key `sourceId:songId`) allowing users to check/uncheck specific songs for targeted batch export. Defaults to all songs checked when files are added.
- Actions:
  - `addFiles(paths: string[])`: Reads bytes via adapter `readFile()`, imports via `importFile()`, appends to `sources`.
  - `addDirectory(dirPath: string, recursive?: boolean)`: Discovers files via adapter `readDir()`, imports matching presentation files.
  - `removeSource(id: string)`: Removes file from workspace.
  - `toggleSongSelection(sourceId: string, songId: string)`: Checks/unchecks a song for export.
  - `selectAllSongs(selected: boolean)`: Toggles all loaded songs in workspace.
  - `selectSong(sourceId: string, songId: string)`: Sets active song for inspection in center workspace.
  - `updateSongTitle(sourceId: string, songId: string, newTitle: string)`: Updates title of song in memory.
  - `clearAll()`: Resets workspace.

### 4.2 `exportStore`
- `targetFormat`: FormatId (`pro`, `vpc`, `show`, `txt`, `pptx`).
- `outputDirectory`: Destination folder path.
- `collisionPolicy`: `rename` | `skip` | `overwrite` | `error`.
- `combineMode`: boolean (for PPTX sections, VPC songbook, FreeShow archive).
- `combineName`: string (custom deck/songbook name).
- `libraryName`: string (for ProPresenter library folder export).
- `isExporting`: boolean.
- `progress`: `{ current: number, total: number, message: string }`.
- `lastSummary`: `BatchSummary | null`.
- **Export Execution Flow:**
  - Converts **in-memory** `Presentation` objects from `sourceStore` (reflecting any title edits or user song selections), preserving decoupling from disk re-reading.
  - For single or individual file exports: calls `exportPresentation()` / `exportLibrary()`, handles filename disambiguation/collision policies via `PlatformAdapter.exists()`, and writes bytes via `PlatformAdapter.writeFile()`.
  - For combined mode: combines selected presentations into a `Library` and calls `exportLibrary()`.
  - For ProPresenter library mode: writes `.pro` files into `<outputDirectory>/<libraryName>/` and generates `<libraryName>.proplaylist` via `generateProPlaylist()`.
  - Updates progress callbacks in real time, emits non-fatal warnings, and saves final `BatchSummary` to store.
- Actions:
  - `setTargetFormat(format: FormatId)`
  - `setOutputDirectory(path: string)`
  - `setCombineMode(combine: boolean, name?: string)`
  - `setLibraryName(name: string)`
  - `executeExport(selectedPresentations: Presentation[], adapter: PlatformAdapter)`: Orchestrates in-memory export pipeline, updates progress, and opens completion modal.

### 4.3 `themeStore`
- `theme`: `'dark' | 'light' | 'system'`.
- `resolvedTheme`: `'dark' | 'light'`.
- Actions:
  - `setTheme(theme: Theme)`: Updates `localStorage`, applies/removes `.dark` class on `document.documentElement`.

---

## 5. UI Component Hierarchy & Interactions

### 5.1 `TopBar`
- Custom drag region (`data-tauri-drag-region`).
- App title with active version and format icon badge.
- Window controls (Minimize, Maximize/Restore, Close).
- Theme toggle dropdown (Dark, Light, System).

### 5.2 `SourcesSidebar` (Left)
- "Add Files" and "Add Folder" buttons triggering native pickers.
- Drag-and-drop backdrop for dropping presentation files directly.
- Accordion list of source files:
  - File icon + format badge (`.vpc`, `.pro`, `.show`, etc.).
  - Filename and song count badge (`47 songs`).
  - Expanding shows list of songs.
  - Clicking a song highlights it and loads it in the `ReviewWorkspace`.

### 5.3 `ReviewWorkspace` (Center)
- Empty state: clean illustration and "Drop presentation files to get started".
- Selected state:
  - **Overview Card:** Song Title (editable if desired), Author, CCLI #, Copyright notice, original format tag.
  - **Sections Bar:** Colored chips for each section (`Verse 1`, `Chorus`, `Bridge`), with slide count.
  - **Warnings Banner:** If import produced warnings (e.g. `PRO_STYLES_NOT_EXTRACTED`), renders an alert box listing non-fatal diagnostics.
  - **Slide Grid:** 16:9 cards laid out in a responsive CSS grid:
    - Card header: Section name with color indicator (`Verse 1`), slide number badge (`1/8`).
    - Card body: Centered lyrics formatted with high-contrast font, preserving line breaks.

### 5.4 `ExportSidebar` (Right)
- Target format selector grid (`ProPresenter`, `VideoPsalm`, `FreeShow`, `Text`, `PowerPoint`).
- Contextual export mode options:
  - If multiple songs selected: shows `--combine` toggle (for PowerPoint, VideoPsalm, FreeShow) or `--library` input (for ProPresenter).
- Collision policy selector (`Auto-rename`, `Skip existing`, `Overwrite`, `Error on collision`).
- Output path picker with "Browse..." button.
- Primary "Export" button with item count indicator (`Export 19 Songs`).

### 5.5 `BatchProgressModal` & `StatusBar`
- During export: modal dialog displays progress bar, currently converting song title, and elapsed time.
- Completion state: checkmark icon, success/skip/failure counts, duration, and "Open Output Folder" action button.
- Bottom status bar: displays total songs in workspace, active format, and ready status.

---

## 6. Testing & Acceptance Criteria

### 6.1 Test Strategy
- **Unit & Store Tests:** Vitest tests testing `sourceStore`, `exportStore`, and `themeStore` actions and state transitions.
- **Component Tests:** React Testing Library tests for `SourcesSidebar`, `ReviewWorkspace`, `ExportSidebar`, and `TopBar` with `MockPlatformAdapter`.
- **E2E Visual / Smoke:** Component test loading real sample files (`IZY-original.pro`, `façade.vpc`) through the UI pipeline, asserting rendered slide cards and lyrics.
- **Tauri Native Build:** `cargo check` and `npm run build` succeed in `apps/desktop/`.

### 6.2 Acceptance Gate for Phase 3
1. Desktop UI builds cleanly via `npm run build` and TypeScript typechecks.
2. 3-column layout renders correctly with dark and light themes.
3. Adding files and folders populates the source tree and parses canonical presentations.
4. Review workspace displays metadata, warnings, and 16:9 slide cards.
5. Export sidebar correctly configures format, combine mode, collision policy, and invokes the conversion engine.
6. Progress modal tracks batch operations and opens output directory upon completion.
7. Zero format conversion logic implemented in the UI layer.
