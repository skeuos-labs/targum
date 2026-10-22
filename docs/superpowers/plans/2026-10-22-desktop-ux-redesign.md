# Desktop UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the desktop shell into a two-stage calm-first UX: minimal Import stage when empty, Workbench with collapsible sources rail, Content/Details tabs, warnings sheet, and collapsible export drawer when files exist. Remove StatusBar.

**Architecture:** App.tsx becomes a stage router (`sources.length === 0` → `ImportStage`, else `Workbench` layout). New `uiStore` holds chrome state (rail collapse, drawer expand, active tab/segment, sheets, toast) with `sourcesRailCollapsed` persisted to `localStorage`. Pure helpers in `lib/` own export enablement, warning severity counts, and the import formats line. Existing view components are renamed/split to match the new tab model; export sidebar becomes a two-mode drawer. Platform adapter and engine stay untouched.

**Tech Stack:** React 19, Vite, TypeScript 5.x, Tailwind CSS 4, Base UI / shadcn primitives, Zustand, Vitest + React Testing Library, Tauri 2 shell.

**Spec:** `docs/superpowers/specs/2026-10-22-desktop-ux-redesign.md`

**Paths:** All paths relative to monorepo root `show-converter/` (the workspace package root containing `apps/` and `packages/`).

## Global Constraints

- File size: ≤ 400 lines per file; prefer ~200-line components. Pure logic in `src/lib/`.
- Stage switch is data-driven only: `sources.length === 0` → Import; `≥ 1` → Workbench. No wizard mode, no manual stage toggle.
- Import formats line (exact copy): `ProPresenter .pro/.pro6 · VideoPsalm .vpc/.json · FreeShow .show · Plain Text .txt · PowerPoint .pptx`
- Import headline (exact): `Drop songs to convert`
- Export block helpers (exact): `Select songs to export` / `Pick an output folder`
- Default export format remains `pro`. Default center tab `content`. Default segment `structure`.
- Engine `error`-severity warnings do NOT block export. No "Export anyway" interlock.
- StatusBar is removed entirely — no conditional resurrection.
- Collapse of sources rail or export drawer never mutates `selectedSongs` or export settings.
- Toast copy: `Imported N songs` (pluralize). Duration 2s, non-blocking.
- License MIT; no AI attribution in code comments.
- Existing compact control heights (h-7 xs buttons) stay inside panels.

## Review Focus

- Empty→Workbench transition: first file import must auto-select first source+song, land on Content/Structure, and show toast exactly once for the 0→N crossing (not on every later add).
- Rail collapse must not clear selection or change `selectedSourceId`; TopBar `Sources (N)` chip must re-expand the rail.
- Export disabled reasons must be mutually exclusive and actionable: zero selection preferred over missing folder; clicking expand with missing folder focuses the directory input.
- Warning chip must not auto-switch tabs; opening sheet/diagnostics keeps Content mounted underneath.
- Removing StatusBar / renaming tabs will break existing tests (`app`, `components`, `e2e-ui`) — each task updates its own tests; final task runs full suite.

---

### Task 1: uiStore + pure lib helpers

**Files:**
- Create: `apps/desktop/src/state/uiStore.ts`
- Create: `apps/desktop/src/lib/exportEligibility.ts`
- Create: `apps/desktop/src/lib/warningSummary.ts`
- Create: `apps/desktop/src/lib/importFormats.ts`
- Test: `apps/desktop/test/stores.test.ts` (append uiStore block)
- Test: `apps/desktop/test/lib-exportEligibility.test.ts`
- Test: `apps/desktop/test/lib-warningSummary.test.ts`
- Test: `apps/desktop/test/lib-importFormats.test.ts`

**Interfaces:**
- Consumes: `Warning` from `@show-converter/engine`; existing zustand patterns.
- Produces (later tasks rely on these exact names):
  - `useUiStore`: `{ sourcesRailCollapsed: boolean; exportDrawerExpanded: boolean; centerTab: 'content' | 'details'; contentSegment: 'structure' | 'projection'; warningsSheetOpen: boolean; jsonViewerOpen: boolean; toast: { id: number; message: string } | null; setSourcesRailCollapsed(v: boolean): void; toggleSourcesRail(): void; setExportDrawerExpanded(v: boolean): void; setCenterTab(t: 'content' | 'details'): void; setContentSegment(s: 'structure' | 'projection'): void; setWarningsSheetOpen(v: boolean): void; setJsonViewerOpen(v: boolean): void; showToast(message: string): void; clearToast(id?: number): void }`
  - `getExportBlockReason(selectedCount: number, outputDirectory: string): 'no-selection' | 'no-output-dir' | null`
  - `exportBlockMessage(reason: 'no-selection' | 'no-output-dir' | null): string | null` → `'Select songs to export'` | `'Pick an output folder'` | `null`
  - `summarizeWarnings(warnings: Warning[]): { info: number; warn: number; error: number; total: number }`
  - `IMPORT_FORMATS_LINE: string` and `IMPORT_HEADLINE: string` (exact strings from Global Constraints)

- [ ] **Step 1: Write failing tests for uiStore, exportEligibility, warningSummary, importFormats**

uiStore: default `sourcesRailCollapsed` reads `localStorage['show-converter.sourcesRailCollapsed']` (`'1'` → true, else false); `toggleSourcesRail` flips and persists; `setCenterTab`/`setContentSegment` accept only the two-value unions; `showToast` sets `{ id, message }`; `clearToast(id)` only clears matching id. Tests must `localStorage.clear()` + reset store state in `beforeEach` so the persisted flag does not leak across cases.

exportEligibility: `(0, '/out')` → `'no-selection'`; `(3, '')` → `'no-output-dir'`; `(0, '')` → `'no-selection'`; `(3, '/out')` → `null`. Messages match exact strings.

warningSummary: mixed `[{severity:'info'},{severity:'warn'},{severity:'warn'},{severity:'error'}]` → `{ info:1, warn:2, error:1, total:4 }`; `[]` → zeros.

importFormats: `IMPORT_HEADLINE === 'Drop songs to convert'`; `IMPORT_FORMATS_LINE` equals the Global Constraints line verbatim.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/lib-exportEligibility.test.ts test/lib-warningSummary.test.ts test/lib-importFormats.test.ts test/stores.test.ts`
Expected: FAIL (modules missing / new uiStore cases fail).

- [ ] **Step 3: Implement the four modules**

`uiStore`: zustand `create` + `persist`-style manual `localStorage` read on init and write in `setSourcesRailCollapsed` only. Keys: store key `ui`, localStorage key `show-converter.sourcesRailCollapsed`. Other chrome state not persisted.

`exportEligibility` / `warningSummary` / `importFormats`: pure functions and frozen string constants; no React imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: same vitest command as Step 2.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/state/uiStore.ts apps/desktop/src/lib/exportEligibility.ts apps/desktop/src/lib/warningSummary.ts apps/desktop/src/lib/importFormats.ts apps/desktop/test/stores.test.ts apps/desktop/test/lib-exportEligibility.test.ts apps/desktop/test/lib-warningSummary.test.ts apps/desktop/test/lib-importFormats.test.ts
git commit -m "feat(desktop): add uiStore and pure helpers for stage UX redesign"
```

---

### Task 2: Toast + ImportStage + App stage router (kill StatusBar)

**Files:**
- Create: `apps/desktop/src/components/import/ImportStage.tsx`
- Create: `apps/desktop/src/components/Toast.tsx`
- Modify: `apps/desktop/src/App.tsx` (stage router, remove StatusBar import/usage, toast on 0→N)
- Delete: `apps/desktop/src/components/StatusBar.tsx`
- Test: `apps/desktop/test/import-stage.test.tsx` (new)
- Modify: `apps/desktop/test/app.test.tsx` (remove StatusBar; assert Import stage copy)
- Modify: `apps/desktop/test/components.test.tsx` (remove StatusBar tests if present)
- Modify: `apps/desktop/test/e2e-ui.test.tsx` (empty-state copy; stage switch)

**Interfaces:**
- Consumes: `useSourceStore.addFiles/addDirectory`, `getPlatformAdapter`, `useUiStore.showToast`, `useDropTarget`, `DropOverlay`, `IMPORT_HEADLINE`, `IMPORT_FORMATS_LINE`.
- Produces: `ImportStage` (no props); `Toast` (no props — reads uiStore). App renders `ImportStage` when `sources.length === 0`, else current 3-pane row without StatusBar. Toast mounts once at App root.

- [ ] **Step 1: Write failing tests for ImportStage and stage routing**

import-stage.test.tsx:
- Renders headline `Drop songs to convert`, formats line, `Add Files`, `Add Folder`.
- Click `Add Files` calls `adapter.pickFiles` (mock) then `addFiles`; with mock returning a path already mounted in MockPlatformAdapter, App switches to workbench (sources rail visible) and toast text `Imported 1 song` appears (await).
- With `sources` already populated, `ImportStage` is not in the document.

app.test.tsx / e2e-ui updates:
- Replace `/drop presentation files to get started/i` expectation with `/Drop songs to convert/i`.
- Assert no StatusBar text (`Ready` / footer file counts) after load.
- Assert toast appears once on first import and clears after ~2s (use fake timers or waitFor unmount).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/import-stage.test.tsx test/app.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement ImportStage, Toast, App router; delete StatusBar**

ImportStage:
- Centered column, generous padding, drop target registered as dnd id `center` via `useDropTarget` (file + path handlers call `addFiles` / `addDirectory` as needed).
- Headline + formats line + large clickable drop area (click → `adapter.pickFiles()`).
- Secondary buttons `Add Files` / `Add Folder`.
- `DropOverlay` for `center`.
- No sidebars, no status bar.

Toast:
- Fixed bottom-center (or top-center) z-50 pill; reads `useUiStore.toast`; auto-clear after 2000ms via `useEffect` on toast id; `clearToast` on unmount path safe.

App.tsx:
- Keep existing native/HTML5 DnD effects.
- Track previous `sources.length` with `useRef`. When crossing `0 → N > 0`, `showToast(\`Imported ${N} ${N === 1 ? 'song' : 'songs'}\`)`.
- Layout:
  ```
  <div class="flex h-screen ...">
    <TopBar />
    {sources.length === 0 ? <ImportStage /> : (
      <div class="flex flex-1 overflow-hidden">
        <SourcesSidebar /><ReviewWorkspace /><ExportSidebar />
      </div>
    )}
    <BatchProgressModal />
    <Toast />
  </div>
  ```
- Remove `StatusBar` import and render. Delete `StatusBar.tsx`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/import-stage.test.tsx test/app.test.tsx test/e2e-ui.test.tsx`
Expected: PASS (e2e may still fail on later tab assertions — if only tab-label failures remain, fix the empty-state assertions now and leave tab assertions for Task 5; prefer green if cheap).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/import/ImportStage.tsx apps/desktop/src/components/Toast.tsx apps/desktop/src/App.tsx apps/desktop/test/import-stage.test.tsx apps/desktop/test/app.test.tsx apps/desktop/test/e2e-ui.test.tsx
git rm apps/desktop/src/components/StatusBar.tsx
git commit -m "feat(desktop): two-stage App shell with ImportStage and import toast"
```

---

### Task 3: TopBar Sources chip + slim chrome

**Files:**
- Modify: `apps/desktop/src/components/TopBar.tsx`
- Test: `apps/desktop/test/components.test.tsx` (TopBar cases)

**Interfaces:**
- Consumes: `useSourceStore.sources`, `useUiStore.sourcesRailCollapsed` + `toggleSourcesRail` / `setSourcesRailCollapsed(false)`.
- Produces: TopBar shows a `Sources (N)` button only when workbench AND rail collapsed; click expands rail. No breadcrumbs. Brand + version + theme + window controls unchanged.

- [ ] **Step 1: Write failing TopBar tests**

With `sources` length 3 and `sourcesRailCollapsed: true` → button `Sources (3)` present; click → `sourcesRailCollapsed` false. With collapsed false → chip absent. On Import stage (`sources: []`) → chip never shown even if collapsed true.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/components.test.tsx -t TopBar`
Expected: FAIL.

- [ ] **Step 3: Implement TopBar chip**

Insert between brand block and right controls: ghost/small button labeled `Sources (${sources.length})` when `sources.length > 0 && sourcesRailCollapsed`. `onClick` → `setSourcesRailCollapsed(false)`. Keep `data-tauri-drag-region` on header and brand group.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/components.test.tsx -t TopBar`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/TopBar.tsx apps/desktop/test/components.test.tsx
git commit -m "feat(desktop): TopBar Sources count chip when rail collapsed"
```

---

### Task 4: Sources rail collapse + header select controls

**Files:**
- Modify: `apps/desktop/src/components/SourcesSidebar.tsx`
- Test: `apps/desktop/test/components.test.tsx` (Sources rail cases)

**Interfaces:**
- Consumes: `useUiStore.sourcesRailCollapsed` / `toggleSourcesRail`; existing `sourceStore` selection APIs.
- Produces: When `sourcesRailCollapsed`, `SourcesSidebar` returns `null` (TopBar chip is the only affordance). When open: header row `Sources` + `N files` + `n/n selected` chip + text buttons `Select all` / `Select none` (disabled when `allSongKeys.length === 0`); chevron button `aria-label="Collapse sources rail"` calls `toggleSourcesRail`. Keep Add Files / Add Folder / Clear All. Remove old single "Select All (n/m)" checkbox row in favor of the two text actions + count chip (individual song checkboxes unchanged).

- [ ] **Step 1: Write failing Sources rail tests**

- `sourcesRailCollapsed: true` → `queryByText('Sources')` null (aside not rendered).
- Open with 2 sources / 4 songs, all selected → text `4/4 selected`, buttons `Select all` and `Select none` present.
- `Select none` → `selectedSongs.size === 0`; `Select all` → size 4.
- Collapse toggle → store true and aside unmounts; `selectedSongs` unchanged.
- No eligible songs (empty presentations sources or no sources) → Select all/none disabled.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/components.test.tsx -t Sources`
Expected: FAIL.

- [ ] **Step 3: Implement rail collapse + header**

Restructure header:
```
[SOURCES · N files]          [n/n selected] [chevron]
[Add Files] [Add Folder] [Clear All]
[Select all] [Select none]
```
Wire `selectAllSongs(true|false)`. Early-return `null` when collapsed. Do not touch `selectedSongs` inside collapse handlers.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/components.test.tsx -t Sources`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/SourcesSidebar.tsx apps/desktop/test/components.test.tsx
git commit -m "feat(desktop): collapsible sources rail with select all/none header"
```

---

### Task 5: Center workspace Content | Details | ⋯ + warnings sheet + JSON modal

**Files:**
- Create: `apps/desktop/src/components/review/ContentTab.tsx`
- Create: `apps/desktop/src/components/review/ContentHeader.tsx`
- Create: `apps/desktop/src/components/review/StructureView.tsx` (from SectionsTab body, without Copy Lyrics)
- Create: `apps/desktop/src/components/review/ProjectionView.tsx` (from SlidesTab body)
- Create: `apps/desktop/src/components/review/DetailsTab.tsx` (from OverviewTab body)
- Create: `apps/desktop/src/components/review/WarningsSheet.tsx`
- Create: `apps/desktop/src/components/review/JsonViewerModal.tsx`
- Create: `apps/desktop/src/components/review/OverflowMenu.tsx`
- Modify: `apps/desktop/src/components/ReviewWorkspace.tsx` (new tabs, sheets)
- Delete: `apps/desktop/src/components/review/tabsRegistry.tsx`, `SectionsTab.tsx`, `SlidesTab.tsx`, `OverviewTab.tsx`, `WarningsTab.tsx`, `JsonTab.tsx`
- Test: `apps/desktop/test/review-tabs.test.tsx` (new)
- Modify: `apps/desktop/test/e2e-ui.test.tsx`, `apps/desktop/test/components.test.tsx` (tab labels, warnings sheet)

**Interfaces:**
- Consumes: `useUiStore` (`centerTab`, `contentSegment`, sheet flags); `summarizeWarnings`; `formatLyricsForCopy`, `useFlash`, existing Structure/Projection/Details cards.
- Produces:
  - Tab bar: `Content` | `Details` | overflow trigger `⋯` (`aria-label="More"`).
  - `ContentHeader` props: `{ format: string; fileName: string; songTitle: string; subtitle: string; warnings: Warning[]; onCopyReady?: never }` — header owns Copy lyrics via `formatLyricsForCopy` + `useFlash`; warning chip uses `summarizeWarnings` (label e.g. `2 warn · 1 error` or single-count form; click → `setWarningsSheetOpen(true)`); segment control `Structure | Projection` bound to `contentSegment`; `Copy lyrics` always visible in both segments.
  - `ContentTab` props: existing `ReviewTabProps`-compatible `{ source, song, slideToSection, warnings }`; renders header + StructureView or ProjectionView.
  - `DetailsTab`: metadata editor + metrics + arrangement (same cards as old OverviewTab).
  - `WarningsSheet`: modal listing every warning with code, severity badge (visual distinct per severity), message; footer note: export can proceed; `error` does not block. Close button. Also opened from overflow `Full diagnostics`.
  - `JsonViewerModal`: wraps JsonTreeNode + copy JSON (body of old JsonTab).
  - `OverflowMenu`: items `Full diagnostics`, `Raw JSON AST`.

- [ ] **Step 1: Write failing review tab tests**

- Default `centerTab === 'content'`; tab triggers present: `Content`, `Details`.
- No tab labeled `Overview`, `Sections`, `Slides`, `Warnings`, or `Raw JSON` in the tab bar.
- Content header shows format badge, filename, song title, `Copy lyrics`, segment with `Structure` and `Projection`.
- Switch segment to Projection → 16:9 cards / `Projection Simulator` heading visible; Copy lyrics still present.
- Warning chip present when warnings exist; click opens dialog with warning message text; Content still mounted (song title still in DOM).
- Overflow → `Raw JSON AST` opens JSON viewer; `Full diagnostics` opens same warnings data.
- Details tab shows metadata editor heading.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/review-tabs.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement Content/Details/⋯ restructure**

- Extract StructureView (sections spine, no copy button), ProjectionView (unchanged grid), DetailsTab (MetadataEditorCard + metrics + ArrangementFlowCard).
- ContentHeader: breadcrumb + warning chip (`summarizeWarnings`) + segment + Copy lyrics (song-level, both modes).
- ReviewWorkspace: drive `Tabs` with `useUiStore.centerTab`; render ContentTab / DetailsTab; mount WarningsSheet + JsonViewerModal from uiStore flags; overflow menu sets those flags. Remove `REVIEW_TABS` registry usage.
- Delete obsolete tab files listed above. Keep `JsonTreeNode`, `MetadataEditorCard`, `ArrangementFlowCard`, `types.ts`.
- Use existing `ui/dialog` for sheets/modals (no new primitive required). OverflowMenu: simple absolute dropdown or Base UI Menu — must close on select and outside click.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/review-tabs.test.tsx test/components.test.tsx test/e2e-ui.test.tsx`
Expected: PASS (export-drawer tests in e2e may still lag until Task 6 — update only tab-related e2e assertions here; if e2e export assertions fail solely due to drawer UI, mark them to be fixed in Task 6 and keep this task's dedicated tests green).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/ apps/desktop/test/review-tabs.test.tsx apps/desktop/test/components.test.tsx apps/desktop/test/e2e-ui.test.tsx
git rm apps/desktop/src/components/review/tabsRegistry.tsx apps/desktop/src/components/review/SectionsTab.tsx apps/desktop/src/components/review/SlidesTab.tsx apps/desktop/src/components/review/OverviewTab.tsx apps/desktop/src/components/review/WarningsTab.tsx apps/desktop/src/components/review/JsonTab.tsx
git commit -m "feat(desktop): Content/Details tabs with Structure|Projection and warnings sheet"
```

---

### Task 6: Export drawer (peek + expanded) with enablement rules

**Files:**
- Create: `apps/desktop/src/components/export/ExportDrawer.tsx`
- Create: `apps/desktop/src/components/export/ExportPeek.tsx`
- Create: `apps/desktop/src/components/export/ExportSettings.tsx`
- Delete: `apps/desktop/src/components/ExportSidebar.tsx`
- Delete: `apps/desktop/src/components/export/ExportFooter.tsx` (absorbed into ExportPeek)
- Modify: `apps/desktop/src/App.tsx` (import `ExportDrawer` instead of `ExportSidebar`)
- Modify: `apps/desktop/src/components/export/FormatOptions.tsx` (unchanged API; used inside expanded)
- Test: `apps/desktop/test/export-drawer.test.tsx` (new)
- Modify: `apps/desktop/test/e2e-ui.test.tsx` and `components.test.tsx` for drawer queries

**Interfaces:**
- Consumes: `useExportStore`, `useSourceStore.selectedSongs`, `getExportBlockReason`, `exportBlockMessage`, `useUiStore.exportDrawerExpanded` / `setExportDrawerExpanded`.
- Produces:
  - `ExportDrawer` root: collapsed → `ExportPeek`; expanded → peek header row + `ExportSettings` + collapse control. Width `w-80`, border-l, matches old sidebar chrome.
  - Peek always shows: target format chip/label (default `ProPresenter` / `.pro`), destination status (truncated path or amber `No folder selected`), primary `Export (N songs)` button, expand chevron (`aria-label="Expand export settings"`).
  - `canExport = getExportBlockReason(selectedCount, outputDirectory) === null && !isExporting`.
  - Disabled helper under button (exact): `Select songs to export` or `Pick an output folder`.
  - Expanding with `no-output-dir`: focus output directory input (`ref` + `useEffect` or imperative focus on expand).
  - Expanded contents: FormatOptions grid, multi-song combine/library (existing visibility rules), collision select, output directory + Browse. Collapse preserves all store settings (no reset).
  - Export click → `executeExport(adapter)` unchanged.

- [ ] **Step 1: Write failing export drawer tests**

- Collapsed default (`exportDrawerExpanded: false`): format label visible, `Export 2 Songs` (or singular) visible, `No folder selected` amber text when dir empty, helper `Pick an output folder`, button disabled.
- Set `outputDirectory: '/out'` → helper gone, button enabled (2 selected).
- `selectedSongs` empty → helper `Select songs to export`, disabled even with folder set.
- Expand → Target Format heading, Collision Policy, Output Directory inputs visible; collapse → settings gone from DOM but `targetFormat` / `outputDirectory` store values unchanged.
- Expand with empty dir → output directory input is `document.activeElement` (or has focus attribute).
- Expand → collapse with folder set → peek still shows path.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/export-drawer.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement ExportDrawer / ExportPeek / ExportSettings**

Peek layout:
```
[chevron] Export
[format chip]           [Expand]
[destination status]
[Export (N songs)]
[helper if disabled]
```
Expanded: same shell, settings body replaces status-only rows; keep Export button pinned at bottom. Replace `ExportSidebar` usage in App with `ExportDrawer`. Delete `ExportFooter` and `ExportSidebar`. Keep `w-80` and `data-drop-target="export"` drop registration on the drawer root (preserve dnd id `export`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/export-drawer.test.tsx test/e2e-ui.test.tsx test/components.test.tsx test/app.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/ apps/desktop/src/App.tsx apps/desktop/test/export-drawer.test.tsx apps/desktop/test/e2e-ui.test.tsx apps/desktop/test/components.test.tsx
git rm apps/desktop/src/components/ExportSidebar.tsx apps/desktop/src/components/export/ExportFooter.tsx
git commit -m "feat(desktop): collapsible export drawer with enablement helpers"
```

---

### Task 7: Import selection focus + polish pass + full suite

**Files:**
- Modify: `apps/desktop/src/App.tsx` (only if focus/selection polish needs it)
- Modify: `apps/desktop/src/components/SourcesSidebar.tsx` (default-expand newly added source)
- Modify: `apps/desktop/src/components/import/ImportStage.tsx` (wording drift check)
- Test: modify `apps/desktop/test/e2e-ui.test.tsx` (full happy path)
- Test: modify `apps/desktop/test/stores.test.ts` if selection polish is store-level

**Interfaces:**
- Consumes: all prior task interfaces.
- Produces: verified behavior for the success moment: drop/import → Workbench Content/Structure, first source expanded + active, toast once, copy lyrics, warnings sheet, export 1-click when configured.

- [ ] **Step 1: Write/adjust failing happy-path e2e assertions**

e2e-ui.test.tsx full flow:
1. Render App → Import stage copy.
2. `addFiles` two real fixtures → workbench; sources listed; toast `Imported 2 songs`.
3. Content default; Structure visible (section names from fixture); Projection toggle works; Copy lyrics present.
4. Details tab shows metadata.
5. Export: set `outputDirectory`, format `txt` (as today), export → summary counts; failed items reported, never silent success.
6. StatusBar absent throughout; raw JSON only via overflow.

- [ ] **Step 2: Run e2e to verify failures or gaps**

Run: `npx vitest run test/e2e-ui.test.tsx`
Expected: FAIL on any remaining old queries.

- [ ] **Step 3: Implement polish fixes**

- `sourceStore.addFiles`: when appending, force `expandedSources` open for new ids — expansion state lives in SourcesSidebar today; move default-open for brand-new sources (`prev[id] === undefined` already defaults open — verify; if a source is added while collapsed in UI map, ensure new ids start open).
- Confirm ImportStage pickers and DnD both work; no references to deleted StatusBar/tabs remain (`rg` for `StatusBar|tabsRegistry|SectionsTab|OverviewTab|WarningsTab|JsonTab`).
- File sizes: any new file over ~300 lines gets a split before commit.

- [ ] **Step 4: Run full desktop test suite**

Run: `npx vitest run` from `apps/desktop/`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src apps/desktop/test
git commit -m "feat(desktop): polish import selection focus and green full suite"
```

---

## Non-goals / deferred (do not implement)

- Recent-files / last-output shortcuts on Import stage
- Stage transition animations
- Auto-blocking export on `error` severity
- Three-mode wizards
- Removing Projection or Details capability
- New Sheet shadcn primitive (use Dialog)
