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
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

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
                <Button
                  key={f.id}
                  type="button"
                  variant={isSelected ? 'default' : 'outline'}
                  aria-label={f.label}
                  onClick={() => setTargetFormat(f.id)}
                  className="h-auto justify-between rounded-md px-3 py-2 text-xs font-normal"
                >
                  <span className="flex items-center gap-2">
                    <FileBox data-icon="inline-start" className="opacity-80" />
                    <span>{f.label}</span>
                  </span>
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
                </Button>
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
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <Checkbox
                    checked={combineMode}
                    onCheckedChange={(checked) =>
                      setCombineMode(checked === true, checked === true ? combineName : undefined)
                    }
                    aria-label="Combine into single file"
                  />
                  <span>Combine into single file</span>
                </label>
                {combineMode && (
                  <Input
                    placeholder="Combined filename (e.g. WorshipSet)"
                    value={combineName}
                    onChange={(e) => setCombineMode(true, e.target.value)}
                    className="h-7 px-2.5 text-xs"
                  />
                )}
              </div>
            )}

            {/* ProPresenter Library Folder */}
            {showLibraryOption && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-foreground flex items-center gap-1">
                  <FolderArchive className="h-3 w-3 text-muted-foreground" />
                  <span>Library Folder Name (Optional)</span>
                </label>
                <Input
                  placeholder="e.g. SundayService"
                  value={libraryName}
                  onChange={(e) => setLibraryName(e.target.value)}
                  className="h-7 px-2.5 text-xs"
                />
              </div>
            )}
          </div>
        )}

        {/* Collision Policy */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="collision-policy-select"
            className="text-xs font-semibold text-foreground"
          >
            Collision Policy
          </label>
          <Select
            value={collisionPolicy}
            onValueChange={(value) => setCollisionPolicy(value as CollisionPolicy)}
          >
            <SelectTrigger
              id="collision-policy-select"
              aria-label="Collision Policy"
              size="sm"
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rename">Auto-rename</SelectItem>
              <SelectItem value="skip">Skip existing</SelectItem>
              <SelectItem value="overwrite">Overwrite</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Destination Output Folder */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">
            Output Directory
          </label>
          <div className="flex gap-1.5">
            <Input
              placeholder="/path/to/output"
              value={outputDirectory}
              onChange={(e) => setOutputDirectory(e.target.value)}
              className="h-7 flex-1 truncate px-2.5 text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleBrowseOutput}
              className="shrink-0"
            >
              <FolderOpen data-icon="inline-start" />
              <span>Browse...</span>
            </Button>
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
        <Button
          type="button"
          disabled={selectedCount === 0 || isExporting || !outputDirectory.trim()}
          onClick={handleExport}
          className="w-full justify-center py-2.5 text-xs font-semibold"
        >
          <CheckCircle2 data-icon="inline-start" />
          <span>
            {isExporting
              ? 'Exporting...'
              : `Export ${selectedCount} Song${selectedCount === 1 ? '' : 's'}`}
          </span>
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </aside>
  );
}
