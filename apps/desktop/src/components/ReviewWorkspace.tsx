import React, { useState, useEffect, useRef } from 'react';
import {
  Presentation as PresentationIcon,
  AlertTriangle,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  FileText,
  Music,
  Tag,
  ArrowRight,
} from 'lucide-react';
import type { FormatId, Presentation, Slide } from '@show-converter/engine';
import { useSourceStore } from '../state/sourceStore';
import { getPlatformAdapter } from '../platform';
import { useDropTarget } from '../lib/useDropTarget';
import { DropOverlay } from './DropOverlay';
import { useDndStore } from '../state/dndStore';

export type ReviewTab = 'overview' | 'sections' | 'slides' | 'warnings' | 'json';

export interface SectionStyle {
  hex: string;
  dotBg: string;
  badgeBg: string;
  stripeBg: string;
  textColor: string;
}

/**
 * 3-tier fallback resolution for section styling:
 * 1. section.color hex (if set in source file and valid).
 * 2. Name pattern matching.
 * 3. Slate neutral fallback.
 */
export function getSectionStyle(name: string, customColor?: string): SectionStyle {
  if (customColor && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(customColor)) {
    return {
      hex: customColor,
      dotBg: '',
      badgeBg: 'bg-muted text-foreground border-border',
      stripeBg: '',
      textColor: 'text-white',
    };
  }

  const n = name.toLowerCase();
  if (n.includes('intro')) {
    return {
      hex: '#F59E0B',
      dotBg: 'bg-amber-500',
      badgeBg: 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      stripeBg: 'bg-amber-500',
      textColor: 'text-slate-950',
    };
  }
  if (n.includes('pre') && (n.includes('chorus') || n.includes('chœur') || n.includes('refrain'))) {
    return {
      hex: '#F97316',
      dotBg: 'bg-orange-500',
      badgeBg: 'bg-orange-100 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800',
      stripeBg: 'bg-orange-500',
      textColor: 'text-white',
    };
  }
  if (n.includes('chorus') || n.includes('refrain') || n.includes('chœur') || n.includes('fiverezana')) {
    return {
      hex: '#EF4444',
      dotBg: 'bg-red-500',
      badgeBg: 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
      stripeBg: 'bg-red-500',
      textColor: 'text-white',
    };
  }
  if (n.includes('verse') || n.includes('couplet') || n.includes('andininy')) {
    return {
      hex: '#3B82F6',
      dotBg: 'bg-blue-500',
      badgeBg: 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      stripeBg: 'bg-blue-500',
      textColor: 'text-white',
    };
  }
  if (n.includes('bridge') || n.includes('pont')) {
    return {
      hex: '#10B981',
      dotBg: 'bg-emerald-500',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      stripeBg: 'bg-emerald-500',
      textColor: 'text-white',
    };
  }
  if (n.includes('tag')) {
    return {
      hex: '#A855F7',
      dotBg: 'bg-purple-500',
      badgeBg: 'bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      stripeBg: 'bg-purple-500',
      textColor: 'text-white',
    };
  }
  if (n.includes('outro') || n.includes('ending') || n.includes('fin')) {
    return {
      hex: '#EAB308',
      dotBg: 'bg-yellow-500',
      badgeBg: 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
      stripeBg: 'bg-yellow-500',
      textColor: 'text-slate-950',
    };
  }

  return {
    hex: '#94A3B8',
    dotBg: 'bg-slate-500',
    badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    stripeBg: 'bg-slate-500',
    textColor: 'text-white',
  };
}

function formatSourceFormatLabel(fmt: FormatId | string): string {
  switch (fmt.toLowerCase()) {
    case 'pro':
      return 'ProPresenter 7 (.pro)';
    case 'pro6':
      return 'ProPresenter 6 (.pro6)';
    case 'vpc':
      return 'VideoPsalm (.vpc)';
    case 'json':
      return 'VideoPsalm JSON (.json)';
    case 'show':
    case 'freeshow':
      return 'FreeShow (.show)';
    case 'txt':
      return 'Plain Text (.txt)';
    case 'pptx':
      return 'PowerPoint (.pptx)';
    default:
      return fmt.toUpperCase();
  }
}

function getSlidePlainText(slide: Slide): string {
  return slide.items
    .filter((it) => it.type === 'text')
    .map((it) => it.plainText)
    .join('\n')
    .trim();
}

/** Zero-dependency recursive color-coded JSON viewer */
function JsonTreeNode({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const depthColors = ['text-sky-400', 'text-purple-400', 'text-emerald-400', 'text-amber-400'];
  const keyColor = depthColors[depth % depthColors.length];

  if (value === null) {
    return <span className="text-slate-500">null</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="text-orange-300">{value ? 'true' : 'false'}</span>;
  }
  if (typeof value === 'number') {
    return <span className="text-orange-300">{value}</span>;
  }
  if (typeof value === 'string') {
    return <span className="text-emerald-300">{JSON.stringify(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-slate-400">[]</span>;
    return (
      <div className="pl-4 border-l border-slate-800/80 my-0.5 font-mono">
        <span className="text-slate-400">[</span>
        {value.map((item, i) => (
          <div key={i} className="pl-2">
            <JsonTreeNode value={item} depth={depth + 1} />
            {i < value.length - 1 && <span className="text-slate-500">,</span>}
          </div>
        ))}
        <span className="text-slate-400">]</span>
      </div>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return <span className="text-slate-400">{'{}'}</span>;
    return (
      <div className="pl-4 border-l border-slate-800/80 my-0.5 font-mono">
        <span className="text-slate-400">{'{'}</span>
        {entries.map(([k, v], i) => (
          <div key={k} className="pl-2">
            <span className={`${keyColor} font-semibold`}>"{k}"</span>
            <span className="text-slate-400">: </span>
            <JsonTreeNode value={v} depth={depth + 1} />
            {i < entries.length - 1 && <span className="text-slate-500">,</span>}
          </div>
        ))}
        <span className="text-slate-400">{'}'}</span>
      </div>
    );
  }
  return <span>{String(value)}</span>;
}

export function ReviewWorkspace() {
  const {
    sources,
    selectedSourceId,
    selectedSongId,
    updateSongTitle,
    updateSongMetadata,
    addFiles,
  } = useSourceStore();

  const [activeTab, setActiveTab] = useState<ReviewTab>('overview');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSavedFlash, setIsSavedFlash] = useState(false);
  const [lyricsCopied, setLyricsCopied] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const isDraggingOver = useDndStore((s) => s.dragging && s.target === 'center');

  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const adapterRef = useRef(getPlatformAdapter());
  const { ref: dropRef } = useDropTarget({
    id: 'center',
    onDropFiles: async (files) => {
      await addFiles(files, adapterRef.current);
    },
    onDropPaths: async (paths) => {
      await addFiles(paths, adapterRef.current);
    },
  });

  const triggerSavedFlash = () => {
    setIsSavedFlash(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => {
      setIsSavedFlash(false);
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const currentSource =
    sources.find((s) => s.id === selectedSourceId) ?? sources[0];

  const activeSong: Presentation | undefined =
    currentSource?.library.presentations.find((p) => p.id === selectedSongId) ??
    currentSource?.library.presentations[0];

  // Empty State
  if (!currentSource || !activeSong) {
    return (
      <main
        ref={dropRef}
        data-drop-target="center"
        className={`relative flex flex-1 flex-col items-center justify-center p-8 text-center bg-background select-none transition-colors ${
          isDraggingOver ? 'border-2 border-dashed border-primary bg-primary/5' : ''
        }`}
      >
        <DropOverlay
          targetId="center"
          title="Drop files to import"
          subtitle="Supports .pro, .pro6, .vpc, .show, .pptx, .txt"
        />
        <div className="mb-4 rounded-full bg-muted/60 p-4">
          <PresentationIcon className="h-10 w-10 text-muted-foreground opacity-60" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          Drop presentation files to get started
        </h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          Import ProPresenter (.pro, .pro6), VideoPsalm (.vpc), FreeShow (.show),
          PowerPoint (.pptx), or text files to review and convert.
        </p>
      </main>
    );
  }

  // Map slide ID to section
  const slideToSectionMap = new Map<string, { name: string; color?: string }>();
  for (const sec of activeSong.sections) {
    for (const sId of sec.slideIds) {
      if (!slideToSectionMap.has(sId)) {
        slideToSectionMap.set(sId, { name: sec.name, color: sec.color });
      }
    }
  }

  const allWarnings = [
    ...(currentSource.warnings ?? []),
    ...(activeSong.warnings ?? []),
  ];

  const songCount = currentSource.library.presentations.length;
  const sectionCount = activeSong.sections.length;
  const slideCount = activeSong.slides.length;
  const formatLabel = formatSourceFormatLabel(currentSource.format);
  const subtitleLine = `${songCount} ${songCount === 1 ? 'song' : 'songs'} · ${sectionCount} ${
    sectionCount === 1 ? 'section' : 'sections'
  } · ${slideCount} ${slideCount === 1 ? 'slide' : 'slides'} · ${formatLabel}`;

  // Build arrangement sequence helper
  const getArrangementSequence = (slideIds: string[]): string[] => {
    const seq: string[] = [];
    for (const sid of slideIds) {
      const sec = slideToSectionMap.get(sid);
      const name = sec?.name || 'Verse';
      if (seq.length === 0 || seq[seq.length - 1] !== name) {
        seq.push(name);
      }
    }
    return seq.length > 0 ? seq : activeSong.sections.map((s) => s.name);
  };

  // Copy Lyrics Handler (ordered by active arrangement, double newline between sections)
  const handleCopyLyrics = async () => {
    const arrangement = activeSong.arrangements[0];
    const orderedSlideIds = arrangement?.slideIds?.length
      ? arrangement.slideIds
      : activeSong.slides.map((s) => s.id);

    const slideMap = new Map(activeSong.slides.map((s) => [s.id, s]));
    const sectionTexts: string[] = [];
    let currentSectionName: string | undefined;
    let currentSlideTexts: string[] = [];

    const flushSection = () => {
      if (currentSlideTexts.length > 0) {
        sectionTexts.push(currentSlideTexts.join('\n'));
        currentSlideTexts = [];
      }
    };

    for (const sId of orderedSlideIds) {
      const slide = slideMap.get(sId);
      if (!slide) continue;
      const sec = slideToSectionMap.get(sId);
      const secName = sec?.name || 'Verse';
      if (currentSectionName !== undefined && secName !== currentSectionName) {
        flushSection();
      }
      currentSectionName = secName;
      const text = getSlidePlainText(slide);
      if (text) currentSlideTexts.push(text);
    }
    flushSection();

    const formattedLyrics = sectionTexts.join('\n\n');
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(formattedLyrics);
        setLyricsCopied(true);
        setTimeout(() => setLyricsCopied(false), 1500);
      }
    } catch {
      // clipboard fallback
    }
  };

  const handleCopyJson = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(JSON.stringify(activeSong, null, 2));
        setJsonCopied(true);
        setTimeout(() => setJsonCopied(false), 1500);
      }
    } catch {
      // clipboard fallback
    }
  };

  return (
    <main
      ref={dropRef}
      data-drop-target="center"
      className={`relative flex flex-1 flex-col overflow-hidden bg-background select-none min-w-0 transition-colors ${
        isDraggingOver ? 'ring-2 ring-inset ring-primary bg-primary/5' : ''
      }`}
    >
      <DropOverlay
        targetId="center"
        title="Drop presentation files to import"
        subtitle="Supports .pro, .pro6, .vpc, .show, .pptx, .txt"
      />

      {/* 2. Header & Tab Navigation Bar */}
      <header className="px-6 pt-4 pb-0 bg-card border-b border-border shrink-0">
        <div className="flex items-center justify-between gap-4">
          {/* File / Song Breadcrumb */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 shrink-0">
              {currentSource.format.toUpperCase()}
            </span>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground truncate min-w-0">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="truncate text-muted-foreground" title={currentSource.name}>
                {currentSource.name}
              </span>
              <span className="text-muted-foreground/60">/</span>
              <span className="truncate text-foreground font-bold" title={activeSong.title}>
                {activeSong.title}
              </span>
            </div>
          </div>

          {/* Diagnostics Badge */}
          {allWarnings.length === 0 ? (
            <span className="shrink-0 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              OK
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('warnings')}
              className="shrink-0 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer flex items-center gap-1"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                {allWarnings.length} {allWarnings.length === 1 ? 'warning' : 'warnings'}
              </span>
            </button>
          )}
        </div>

        {/* Subtitle Row */}
        <p className="text-xs text-muted-foreground mt-1 mb-3 truncate">{subtitleLine}</p>

        {/* 5 Tabs Bar */}
        <nav role="tablist" className="flex gap-6 border-t border-border/60 pt-2 -mb-px">
          {[
            { id: 'overview' as ReviewTab, label: 'Overview' },
            { id: 'sections' as ReviewTab, label: 'Sections' },
            { id: 'slides' as ReviewTab, label: 'Slides' },
            {
              id: 'warnings' as ReviewTab,
              label: 'Warnings',
              count: allWarnings.length,
            },
            { id: 'json' as ReviewTab, label: 'Raw JSON' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 border-b-2 select-none ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 tabular-nums">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0 select-text">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Upper Card — Metadata Editor */}
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Metadata Editor
                  </h3>
                </div>
                {isSavedFlash && (
                  <span className="text-emerald-500 font-semibold text-xs flex items-center gap-1 animate-in fade-in duration-200">
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved ✓</span>
                  </span>
                )}
              </div>

              {/* Title Input */}
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Song Title
                </label>
                <input
                  type="text"
                  aria-label="Song Title"
                  value={activeSong.title}
                  onChange={(e) =>
                    updateSongTitle(currentSource.id, activeSong.id, e.target.value)
                  }
                  onBlur={triggerSavedFlash}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-base font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Primary Grid: Author, CCLI, Copyright */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Author
                  </label>
                  <input
                    type="text"
                    aria-label="Author"
                    value={activeSong.metadata.author || ''}
                    placeholder="e.g. John Newton"
                    onChange={(e) =>
                      updateSongMetadata(currentSource.id, activeSong.id, {
                        author: e.target.value,
                      })
                    }
                    onBlur={triggerSavedFlash}
                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    CCLI #
                  </label>
                  <input
                    type="text"
                    aria-label="CCLI #"
                    value={activeSong.metadata.ccli || ''}
                    placeholder="e.g. 22025"
                    onChange={(e) =>
                      updateSongMetadata(currentSource.id, activeSong.id, {
                        ccli: e.target.value,
                      })
                    }
                    onBlur={triggerSavedFlash}
                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Copyright
                  </label>
                  <input
                    type="text"
                    aria-label="Copyright"
                    value={activeSong.metadata.copyright || ''}
                    placeholder="e.g. Public Domain"
                    onChange={(e) =>
                      updateSongMetadata(currentSource.id, activeSong.id, {
                        copyright: e.target.value,
                      })
                    }
                    onBlur={triggerSavedFlash}
                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              {/* Collapsible Drawer Toggle */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer select-none"
                >
                  {isDrawerOpen ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Hide Extended Metadata</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>View More Metadata</span>
                    </>
                  )}
                </button>

                {isDrawerOpen && (
                  <div className="mt-3 pt-3 border-t border-border/60 space-y-3 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="meta-language"
                          className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1"
                        >
                          Language
                        </label>
                        <input
                          id="meta-language"
                          type="text"
                          aria-label="Language"
                          value={activeSong.metadata.language || ''}
                          placeholder="e.g. en-US"
                          onChange={(e) =>
                            updateSongMetadata(currentSource.id, activeSong.id, {
                              language: e.target.value,
                            })
                          }
                          onBlur={triggerSavedFlash}
                          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="meta-theme"
                          className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1"
                        >
                          Theme Name
                        </label>
                        <input
                          id="meta-theme"
                          type="text"
                          aria-label="Theme Name"
                          value={activeSong.metadata.themeName || ''}
                          placeholder="e.g. Classic Dark"
                          onChange={(e) =>
                            updateSongMetadata(currentSource.id, activeSong.id, {
                              themeName: e.target.value,
                            })
                          }
                          onBlur={triggerSavedFlash}
                          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="meta-notes"
                        className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1"
                      >
                        Notes
                      </label>
                      <textarea
                        id="meta-notes"
                        rows={3}
                        aria-label="Notes"
                        value={activeSong.metadata.notes || ''}
                        placeholder="Additional performance notes or copyright remarks..."
                        onChange={(e) =>
                          updateSongMetadata(currentSource.id, activeSong.id, {
                            notes: e.target.value,
                          })
                        }
                        onBlur={triggerSavedFlash}
                        className="w-full rounded-md border border-input bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-6 pt-1 text-xs text-muted-foreground">
                      <div>
                        <span className="font-semibold text-foreground/80">Song ID: </span>
                        <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded border border-border">
                          {activeSong.id}
                        </code>
                      </div>
                      <div>
                        <span className="font-semibold text-foreground/80">Original File: </span>
                        <span>{activeSong.metadata.originalFileName || currentSource.name}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Metrics Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Source Format
                </span>
                <span className="text-sm font-bold text-foreground">
                  {formatSourceFormatLabel(activeSong.sourceFormat || currentSource.format)}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Total Sections
                </span>
                <span className="text-xl font-extrabold text-foreground">{sectionCount}</span>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Total Slides
                </span>
                <span className="text-xl font-extrabold text-foreground">{slideCount}</span>
              </div>
            </div>

            {/* Arrangement Flow */}
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-border/60 pb-2.5">
                <Music className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Arrangement Flow
                </h3>
              </div>

              {activeSong.arrangements.length > 0 ? (
                <div className="space-y-3">
                  {activeSong.arrangements.map((arr) => {
                    const sequence = getArrangementSequence(arr.slideIds);
                    return (
                      <div key={arr.id} className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                        <span className="shrink-0 px-2 py-0.5 rounded font-bold font-mono text-[11px] bg-muted border border-border text-foreground">
                          {arr.name}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {sequence.map((secName, idx) => {
                            const sec = activeSong.sections.find((s) => s.name === secName);
                            const style = getSectionStyle(secName, sec?.color);
                            return (
                              <React.Fragment key={`${arr.id}-${secName}-${idx}`}>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1.5 ${style.badgeBg}`}
                                  style={style.hex ? { borderColor: `${style.hex}50` } : undefined}
                                >
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${style.dotBg}`}
                                    style={style.hex ? { backgroundColor: style.hex } : undefined}
                                  />
                                  <span>{secName}</span>
                                </span>
                                {idx < sequence.length - 1 && (
                                  <ArrowRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <span className="shrink-0 px-2 py-0.5 rounded font-bold font-mono text-[11px] bg-muted border border-border text-foreground">
                    Linear
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {activeSong.sections.map((sec, idx) => {
                      const style = getSectionStyle(sec.name, sec.color);
                      return (
                        <React.Fragment key={sec.id}>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1.5 ${style.badgeBg}`}
                            style={style.hex ? { borderColor: `${style.hex}50` } : undefined}
                          >
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${style.dotBg}`}
                              style={style.hex ? { backgroundColor: style.hex } : undefined}
                            />
                            <span>{sec.name}</span>
                          </span>
                          {idx < activeSong.sections.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SECTIONS (Lyrics & Structure) */}
        {activeTab === 'sections' && (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Header Action: Floating Copy Lyrics */}
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sections & Lyrics Spine
              </h3>
              <button
                type="button"
                onClick={handleCopyLyrics}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-md text-xs font-semibold transition-colors cursor-pointer select-none"
              >
                {lyricsCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Lyrics</span>
                  </>
                )}
              </button>
            </div>

            {/* Spine Layout */}
            <div className="space-y-4">
              {activeSong.sections.map((sec) => {
                const style = getSectionStyle(sec.name, sec.color);
                const sectionSlides = sec.slideIds
                  .map((id) => activeSong.slides.find((s) => s.id === id))
                  .filter((s): s is Slide => s !== undefined);

                return (
                  <div
                    key={sec.id}
                    className="flex rounded-lg border border-border overflow-hidden bg-card shadow-xs"
                  >
                    {/* Left Spine Strip (36px wide, 180° rotated name) */}
                    <div
                      className={`w-[36px] shrink-0 flex items-center justify-center p-2 text-xs font-bold uppercase tracking-wider select-none ${style.stripeBg} ${style.textColor}`}
                      style={{
                        writingMode: 'vertical-lr',
                        transform: 'rotate(180deg)',
                        backgroundColor: style.hex || undefined,
                      }}
                    >
                      {sec.name}
                    </div>

                    {/* Right Slide Table (Zebra-striped) */}
                    <div className="flex-1 divide-y divide-border/60">
                      {sectionSlides.map((slide, sIdx) => {
                        const text = getSlidePlainText(slide);
                        return (
                          <div
                            key={slide.id}
                            className={`flex items-start gap-4 p-3.5 ${
                              sIdx % 2 === 0 ? 'bg-card' : 'bg-muted/40'
                            }`}
                          >
                            <span className="w-8 shrink-0 text-center font-mono text-xs text-muted-foreground pt-0.5 select-none font-semibold">
                              {sIdx + 1}
                            </span>
                            <pre className="flex-1 text-xs font-sans whitespace-pre-wrap text-foreground leading-relaxed">
                              {text || <span className="italic text-muted-foreground">Blank</span>}
                            </pre>
                          </div>
                        );
                      })}
                      {sectionSlides.length === 0 && (
                        <div className="p-4 text-xs italic text-muted-foreground text-center">
                          No slides in this section
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: SLIDES (16:9 Projection Simulator) */}
        {activeTab === 'slides' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Projection Simulator (16:9)
              </h3>
              <span className="text-xs text-muted-foreground">
                {activeSong.slides.length} slides
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {activeSong.slides.map((slide, index) => {
                const sec = slideToSectionMap.get(slide.id);
                const prevSec = index > 0 ? slideToSectionMap.get(activeSong.slides[index - 1]!.id) : null;
                const isSameSectionAsPrev = prevSec?.name === sec?.name;

                const style = getSectionStyle(sec?.name || 'Slide', sec?.color);
                const slideText = getSlidePlainText(slide);

                return (
                  <div
                    key={slide.id || index}
                    className="group relative flex flex-col aspect-video rounded-lg border border-slate-800 bg-slate-950 text-white overflow-hidden shadow-sm hover:ring-2 hover:ring-primary hover:border-slate-600 transition-all select-text cursor-text"
                    style={{ aspectRatio: '16 / 9' }}
                  >
                    {/* Centered White Text */}
                    <div className="flex flex-1 items-center justify-center p-3 text-center overflow-hidden">
                      <p className="text-xs leading-relaxed font-semibold whitespace-pre-wrap line-clamp-4 text-white drop-shadow-md">
                        {slideText || <span className="italic text-slate-500">Blank</span>}
                      </p>
                    </div>

                    {/* Bottom Stripe (h-7) */}
                    <div
                      className={`h-7 w-full flex items-center justify-between px-2.5 shrink-0 text-[11px] font-bold select-none shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ${style.stripeBg} ${style.textColor}`}
                      style={style.hex ? { backgroundColor: style.hex } : undefined}
                    >
                      <span className="truncate">
                        {!isSameSectionAsPrev && (sec?.name || slide.label || 'Slide')}
                      </span>
                      <span className="font-mono text-[10px] tabular-nums shrink-0 ml-auto">
                        {index + 1}/{activeSong.slides.length}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: WARNINGS */}
        {activeTab === 'warnings' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">
              Parse & Export Diagnostics
            </h3>

            {allWarnings.length > 0 ? (
              <div className="space-y-3">
                {allWarnings.map((warn, i) => (
                  <div
                    key={i}
                    className="p-3.5 bg-amber-500/10 text-amber-900 dark:text-amber-200 rounded-lg border border-amber-500/30 flex gap-3 items-start text-xs shadow-xs"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                          [{warn.code}]
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                          {warn.severity}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed">{warn.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
                <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-sm font-semibold text-foreground">
                  No warnings for this file. Clean parse.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  All slides, sections, and metadata conform faithfully to the canonical format.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: RAW JSON */}
        {activeTab === 'json' && (
          <div className="max-w-5xl mx-auto space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Canonical Presentation AST (JSON)
              </h3>
              <button
                type="button"
                onClick={handleCopyJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-md text-xs font-semibold transition-colors cursor-pointer select-none"
              >
                {jsonCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-[#181D26] text-[#E5E7EB] p-5 rounded-lg overflow-x-auto text-xs font-mono border border-slate-800 shadow-inner">
              <JsonTreeNode value={activeSong} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
