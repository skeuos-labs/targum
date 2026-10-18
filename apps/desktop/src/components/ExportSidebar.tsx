import {
  FolderOpen,
  Settings2,
  CheckCircle2,
  Layers,
  FileBox,
  FolderArchive,
  ArrowRight,
} from 'lucide-react';
import { useSourceStore } from '../state/sourceStore';
import { useExportStore } from '../state/exportStore';
import { getPlatformAdapter } from '../platform';
import type { FormatId, CollisionPolicy } from '@show-converter/engine';
import { cn } from '../lib/utils';

interface FormatOption {
  id: FormatId;
  label: string;
  ext: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { id: 'pro', label: 'ProPresenter', ext: '.pro' },
  { id: 'vpc', label: 'VideoPsalm', ext: '.vpc' },
  { id: 'freeshow', label: 'FreeShow', ext: '.show' },
  { id: 'txt', label: 'Plain Text', ext: '.txt' },
  { id: 'pptx', label: 'PowerPoint', ext: '.pptx' },
];

export function ExportSidebar() {
  const selectedSongs = useSourceStore((s) => s.selectedSongs);
  const {
    targetFormat,
    outputDirectory,
    collisionPolicy,
    combineMode,
    combineName,
    libraryName,
    isExporting,
    setTargetFormat,
    setOutputDirectory,
    setCollisionPolicy,
    setCombineMode,
    setLibraryName,
    executeExport,
  } = useExportStore();

  const adapter = getPlatformAdapter();
  const selectedCount = selectedSongs.size;

  const handleBrowseOutput = async () => {
    try {
      const dir = await adapter.pickDirectory({ title: 'Select Output Directory' });
      if (dir) {
        setOutputDirectory(dir);
      }
    } catch {
      // Pick cancelled
    }
  };

  const handleExport = () => {
    executeExport(adapter).catch(() => {});
  };

  const showCombineOption =
    selectedCount > 1 &&
    (targetFormat === 'pptx' ||
      targetFormat === 'vpc' ||
      targetFormat === 'freeshow');

  const showLibraryOption = selectedCount > 1 && targetFormat === 'pro';

  return (
    <aside className="flex h-full w-80 flex-col border-l border-border bg-card/40 select-none overflow-hidden">
      {/* Header */}
      <div className="border-b border-border p-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          <span>Export</span>
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {/* Target Format Grid */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">
            Target Format
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {FORMAT_OPTIONS.map((f) => {
              const isSelected = targetFormat === f.id;

              return (
                <button
                  key={f.id}
                  type="button"
                  aria-label={f.label}
                  onClick={() => setTargetFormat(f.id)}
                  className={cn(
                    'flex items-center justify-between rounded-md border px-3 py-2 text-xs transition-colors',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'border-border bg-card hover:bg-accent text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <FileBox className="h-3.5 w-3.5 opacity-80" />
                    <span>{f.label}</span>
                  </div>
                  <span
                    className={cn(
                      'font-mono text-[10px] rounded px-1.5 py-0.5',
                      isSelected
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {f.ext}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Multi-song Export Options */}
        {(showCombineOption || showLibraryOption) && (
          <div className="rounded-md border border-border bg-card/60 p-3 space-y-3">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span>Multi-song Options</span>
            </span>

            {/* Combine into single file */}
            {showCombineOption && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={combineMode}
                    onChange={(e) => setCombineMode(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-ring"
                  />
                  <span>Combine into single file</span>
                </label>
                {combineMode && (
                  <input
                    type="text"
                    placeholder="Combined filename (e.g. WorshipSet)"
                    value={combineName}
                    onChange={(e) => setCombineMode(true, e.target.value)}
                    className="w-full rounded border border-border bg-background px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                )}
              </div>
            )}

            {/* ProPresenter Library Folder */}
            {showLibraryOption && (
              <div className="space-y-1.5">
                <label className="text-xs text-foreground flex items-center gap-1">
                  <FolderArchive className="h-3 w-3 text-muted-foreground" />
                  <span>Library Folder Name (Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. SundayService"
                  value={libraryName}
                  onChange={(e) => setLibraryName(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            )}
          </div>
        )}

        {/* Collision Policy */}
        <div className="space-y-1.5">
          <label
            htmlFor="collision-policy-select"
            className="text-xs font-semibold text-foreground"
          >
            Collision Policy
          </label>
          <select
            id="collision-policy-select"
            aria-label="Collision Policy"
            value={collisionPolicy}
            onChange={(e) => setCollisionPolicy(e.target.value as CollisionPolicy)}
            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="rename">Auto-rename</option>
            <option value="skip">Skip existing</option>
            <option value="overwrite">Overwrite</option>
            <option value="error">Error</option>
          </select>
        </div>

        {/* Destination Output Folder */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Output Directory
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="/path/to/output"
              value={outputDirectory}
              onChange={(e) => setOutputDirectory(e.target.value)}
              className="flex-1 rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring truncate"
            />
            <button
              type="button"
              onClick={handleBrowseOutput}
              className="flex items-center gap-1 rounded border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent shrink-0"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>Browse...</span>
            </button>
          </div>
          {!outputDirectory.trim() && (
            <p className="text-[11px] text-muted-foreground">
              Select destination folder
            </p>
          )}
        </div>
      </div>

      {/* Export Action Footer */}
      <div className="border-t border-border p-3 bg-card/80">
        <button
          type="button"
          disabled={selectedCount === 0 || isExporting || !outputDirectory.trim()}
          onClick={handleExport}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors',
            selectedCount === 0 || isExporting || !outputDirectory.trim()
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-primary/90'
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>
            {isExporting
              ? 'Exporting...'
              : `Export ${selectedCount} Song${selectedCount === 1 ? '' : 's'}`}
          </span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}
