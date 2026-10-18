# Phase 3 Desktop GUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a desktop application for Show Converter using Tauri 2, Vite, React 19, TypeScript, Tailwind CSS, and shadcn/ui components in a monorepo workspace.

**Architecture:** Monorepo with `packages/engine` (pure conversion engine and CLI) and `apps/desktop` (Tauri 2 + React 19 UI). The UI interacts with OS features exclusively through a typed `PlatformAdapter`, permitting headless testing in Vitest + React Testing Library with in-memory mocks. Conversions run directly in the webview via the verified engine APIs.

**Tech Stack:** Tauri 2 (Rust shell), React 19, Vite, TypeScript 5.x, Tailwind CSS, shadcn/ui, Zustand, Lucide React, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-18-desktop-gui-design.md`

## Global Constraints

- Workspace isolation: Monorepo layout with root `package.json` declaring workspaces `["packages/*", "apps/*"]`.
- Engine purity: Zero UI or desktop framework dependencies inside `packages/engine`.
- Business logic: All conversion logic in TypeScript via `packages/engine`; Rust shell provides only native OS window/fs/dialog bridges.
- Memory-first execution: UI exports in-memory `Presentation` objects from `sourceStore` without re-reading original files from disk.
- Theme support: Dark, light, and system modes with automatic OS sync and `localStorage` persistence.
- License & Attribution: All code authored under MIT. Zero AI attribution in Git commit author fields.

## Review Focus

- Long multi-song library import: Must render smoothly without freezing UI; song list must scroll cleanly with hundreds of songs.
- Multi-song selection state: Tri-state checkboxes in sidebar must accurately update export count and target only checked songs.
- ProPresenter slide preview: 16:9 aspect ratio and high contrast text formatting must remain intact on window resize.
- Native dialog cancellation: Cancelling file or folder picker must not clear existing workspace or throw uncaught promise rejection.
- Overwrite and collision policies in GUI: Export must respect user-selected collision policy (`rename`, `skip`, `overwrite`, `error`) via adapter checks.

---

### Task 1: Workspace Restructuring & Engine Package Migration

**Files:**
- Create: `show-converter/package.json` (root workspace config)
- Move / Restructure: Engine source into `show-converter/packages/engine/`
- Test: `show-converter/packages/engine/package.json`

**Interfaces:**
- Produces: Working npm workspace with `@show-converter/engine` running full test suite cleanly.

- [ ] **Step 1: Write root workspace `package.json`**

Configure workspaces: `["packages/*", "apps/*"]`. Move current engine files into `packages/engine/`. Update package name to `@show-converter/engine`.

- [ ] **Step 2: Run tests in `packages/engine/` to verify no breakage**

Run: `npm test` inside `packages/engine/`
Expected: 430/430 tests pass.

- [ ] **Step 3: Commit**

```bash
git add package.json packages/engine/
git commit -m "chore: migrate conversion engine to packages/engine in root workspace"
```

---

### Task 2: Desktop Shell Scaffolding (Tauri 2 + Vite + React 19 + Tailwind + shadcn)

**Files:**
- Create: `show-converter/apps/desktop/package.json`
- Create: `show-converter/apps/desktop/vite.config.ts`
- Create: `show-converter/apps/desktop/tsconfig.json`
- Create: `show-converter/apps/desktop/index.html`
- Create: `show-converter/apps/desktop/src/styles.css`
- Create: `show-converter/apps/desktop/src-tauri/Cargo.toml`
- Create: `show-converter/apps/desktop/src-tauri/tauri.conf.json`
- Create: `show-converter/apps/desktop/src-tauri/src/main.rs`
- Create: `show-converter/apps/desktop/src-tauri/capabilities/default.json`

**Interfaces:**
- Produces: Runnable, buildable Tauri 2 desktop shell consuming `@show-converter/engine`.

- [ ] **Step 1: Create desktop app files and install dependencies**

Install React 19, Vite, Tailwind CSS, Lucide React, Zustand, clsx, and Tauri 2 packages. Set up Tailwind theme tokens.

- [ ] **Step 2: Build frontend and verify Rust backend compiles**

Run: `npm run build --workspace=@show-converter/desktop`
Run: `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
Expected: Frontend build and Rust check succeed with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/
git commit -m "chore(desktop): scaffold Tauri 2, Vite, React 19, and Tailwind desktop shell"
```

---

### Task 3: Platform Adapter & Mock Implementation

**Files:**
- Create: `show-converter/apps/desktop/src/platform/adapter.ts`
- Create: `show-converter/apps/desktop/src/platform/tauriAdapter.ts`
- Create: `show-converter/apps/desktop/src/platform/mockAdapter.ts`
- Create: `show-converter/apps/desktop/src/platform/index.ts`
- Test: `show-converter/apps/desktop/test/platform.test.ts`

**Interfaces:**
- Produces: `PlatformAdapter`, `TauriPlatformAdapter`, `MockPlatformAdapter`, `getPlatformAdapter()`.

- [ ] **Step 1: Write failing unit tests for `MockPlatformAdapter`**

Test file picking, directory picking, in-memory read/write, directory creation, recursive file listing, and window controls.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run apps/desktop/test/platform.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `adapter.ts`, `tauriAdapter.ts`, `mockAdapter.ts`, and `index.ts`**

Implement interface and both adapters. Detect whether running inside Tauri webview via `window.__TAURI_INTERNALS__`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/desktop/test/platform.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/platform/ apps/desktop/test/platform.test.ts
git commit -m "feat(desktop): implement PlatformAdapter with Tauri and in-memory mock implementations"
```

---

### Task 4: UI State Management Stores (Theme, Source, Export)

**Files:**
- Create: `show-converter/apps/desktop/src/state/themeStore.ts`
- Create: `show-converter/apps/desktop/src/state/sourceStore.ts`
- Create: `show-converter/apps/desktop/src/state/exportStore.ts`
- Test: `show-converter/apps/desktop/test/stores.test.ts`

**Interfaces:**
- Produces: `useThemeStore`, `useSourceStore`, `useExportStore`.

- [ ] **Step 1: Write failing unit tests for all 3 stores**

Test:
- `themeStore`: Theme changes (`light`, `dark`, `system`), DOM `.dark` class toggling, `localStorage` persistence.
- `sourceStore`: Adding files/directories, selecting active file and song, tri-state multi-song checking (`selectedSongs: Set<string>`), updating song title.
- `exportStore`: Setting format, combine mode, collision policy, running in-memory export via `PlatformAdapter`.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run apps/desktop/test/stores.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `themeStore.ts`, `sourceStore.ts`, and `exportStore.ts`**

Wire stores with Zustand. Integrate engine conversion methods (`importFile`, `exportPresentation`, `exportLibrary`, `generateProPlaylist`) directly into `sourceStore` and `exportStore`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/desktop/test/stores.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/state/ apps/desktop/test/stores.test.ts
git commit -m "feat(desktop): implement decoupled Zustand stores for theme, sources, and exports"
```

---

### Task 5: Core UI Components (TopBar, SourcesSidebar, ReviewWorkspace, ExportSidebar)

**Files:**
- Create: `show-converter/apps/desktop/src/components/TopBar.tsx`
- Create: `show-converter/apps/desktop/src/components/StatusBar.tsx`
- Create: `show-converter/apps/desktop/src/components/SourcesSidebar.tsx`
- Create: `show-converter/apps/desktop/src/components/ReviewWorkspace.tsx`
- Create: `show-converter/apps/desktop/src/components/ExportSidebar.tsx`
- Create: `show-converter/apps/desktop/src/components/BatchProgressModal.tsx`
- Create: `show-converter/apps/desktop/src/App.tsx`
- Test: `show-converter/apps/desktop/test/components.test.tsx`

**Interfaces:**
- Produces: Complete responsive 3-column worship presentation desktop UI.

- [ ] **Step 1: Write failing React Testing Library tests for UI components**

Test rendering empty state, loading sources, selecting songs, rendering 16:9 slide grid, and configuring export options.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run apps/desktop/test/components.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement components**

Build components using Tailwind CSS and shadcn patterns:
- `TopBar`: Frameless custom window controls, drag region, theme selector.
- `SourcesSidebar`: File/folder add buttons, drag-and-drop zone, file accordion with song selection checkboxes.
- `ReviewWorkspace`: Overview card (title, metadata), section chips, warnings banner, 16:9 responsive slide cards.
- `ExportSidebar`: Format grid, combine/library options, collision policy, browse output path, export action button.
- `BatchProgressModal`: Progress bar, current item display, completion statistics.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/desktop/test/components.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/ apps/desktop/src/App.tsx apps/desktop/test/components.test.tsx
git commit -m "feat(desktop): implement 3-column worship presentation converter UI components"
```

---

### Task 6: End-to-End Real-World Sample UI Integration & Build Verification

**Files:**
- Create: `show-converter/apps/desktop/test/e2e-ui.test.tsx`
- Modify: `show-converter/README.md`
- Create: `show-converter/docs/phase-3-report.md`

**Interfaces:**
- Produces: Comprehensive UI integration tests on real fixtures (`IZY-original.pro`, `façade.vpc`), updated documentation, and Phase 3 milestone verification report.

- [ ] **Step 1: Write E2E component integration tests**

Load real files from `assets-for-testing-purpose/` into `App`, assert rendered slide cards, lyrics, and metadata, trigger export to mock adapter, verify output bytes generated.

- [ ] **Step 2: Verify full repository tests and compilation**

Run: `npm test` across workspace.
Run: `npm run build` across workspace.
Run: `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`.
Expected: 100% tests passing, clean TypeScript builds, clean Rust check.

- [ ] **Step 3: Update `README.md` and write `docs/phase-3-report.md`**

Document desktop application architecture, development workflow (`npm run dev --workspace=@show-converter/desktop`), and acceptance checklist.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/test/e2e-ui.test.tsx README.md docs/phase-3-report.md
git commit -m "docs: add Phase 3 desktop GUI documentation and generate milestone verification report"
```
