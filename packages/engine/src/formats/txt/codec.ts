import {
  parsePresentation,
  randomUUID,
  type Library,
  type Metadata,
  type Presentation,
  type Slide,
  type Warning,
} from '../../canonical/index.js';

export type ParseTxtResult =
  | { ok: true; value: Library; warnings: Warning[] }
  | { ok: false; error: Error };

export type WriteTxtSuccess = {
  bytes: Uint8Array;
  warnings: Warning[];
};

export type WriteTxtResult =
  | {
      ok: true;
      value: WriteTxtSuccess;
      bytes: Uint8Array;
      warnings: Warning[];
    }
  | { ok: false; error: Error };

const SECTION_MARKER = /^\[\s*(.+?)\s*\]$/;
const COLON_MARKER =
  /^(Verse(?:\s+\d+)?|Chorus(?:\s+\d+)?|Bridge(?:\s+\d+)?|Pre-?Chorus(?:\s+\d+)?|Tag(?:\s+\d+)?|Ending|Intro|Outro):$/i;
const META_LINE = /^(?:#\s*)?(Author|CCLI|Copyright):\s*(.+)$/i;

function matchSectionHeader(rawLine: string): string | null {
  const trimmed = rawLine.trim();
  const bracketMatch = SECTION_MARKER.exec(trimmed);
  if (bracketMatch) {
    const name = bracketMatch[1]!.trim();
    if (name.length > 0) {
      return name;
    }
  }
  const colonMatch = COLON_MARKER.exec(trimmed);
  if (colonMatch) {
    const name = colonMatch[1]!.trim();
    if (name.length > 0) {
      return name;
    }
  }
  return null;
}

/**
 * Parse plain-text lyrics into a canonical Library.
 *
 * Deterministic subset (clean-room implementation):
 * - Optional first line is the presentation title if the file contains
 *   section markers or blank-line slide breaks after it.
 * - `[Section Name]` (or standard section colon syntax) defines sections.
 * - Blank lines separate slides within the active section.
 * - Consecutive markers keep empty sections intact.
 * - Text without markers is placed into a single "Verse" section.
 * - Empty files or whitespace-only inputs fail closed.
 */
export function parseTxt(bytes: Uint8Array, fileName?: string): ParseTxtResult {
  if (!bytes || bytes.byteLength === 0) {
    return { ok: false, error: new Error('Text file is empty.') };
  }

  const text = new TextDecoder().decode(bytes);
  if (text.trim() === '') {
    return {
      ok: false,
      error: new Error('Text file is empty or contains only whitespace.'),
    };
  }

  const lines = text.split(/\r?\n/);

  let firstNonEmptyIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim() !== '') {
      firstNonEmptyIdx = i;
      break;
    }
  }

  if (firstNonEmptyIdx === -1) {
    return {
      ok: false,
      error: new Error('Text file is empty or contains only whitespace.'),
    };
  }

  const metadata: Metadata = {};
  if (fileName) {
    metadata.originalFileName = fileName;
  }

  let title = fileName ? fileName.replace(/\.txt$/i, '') : 'Untitled';
  let startLineIdx = firstNonEmptyIdx;
  const firstLine = lines[firstNonEmptyIdx]!.trim();

  const firstHeader = matchSectionHeader(firstLine);
  if (!firstHeader) {
    const titlePrefixMatch = /^Title:\s*(.+)$/i.exec(firstLine);
    if (titlePrefixMatch) {
      title = titlePrefixMatch[1]!.trim();
      startLineIdx = firstNonEmptyIdx + 1;
    } else {
      const remainingLines = lines.slice(firstNonEmptyIdx + 1);
      const hasMarkersAfter = remainingLines.some(
        (l) => matchSectionHeader(l) !== null
      );
      const isNextLineBlank = lines[firstNonEmptyIdx + 1]?.trim() === '';
      if (hasMarkersAfter || isNextLineBlank) {
        title = firstLine;
        startLineIdx = firstNonEmptyIdx + 1;
      }
    }
  }

  interface ParsedSection {
    name: string;
    slides: string[];
    startedByMarker: boolean;
  }

  const sectionList: ParsedSection[] = [];
  let current: ParsedSection = {
    name: 'Verse',
    slides: [],
    startedByMarker: false,
  };
  let buffer: string[] = [];

  const flushSlide = () => {
    const joined = buffer.join('\n').trim();
    buffer = [];
    if (joined !== '') {
      current.slides.push(joined);
    }
  };

  let hasSeenFirstContent = false;

  for (let i = startLineIdx; i < lines.length; i++) {
    const raw = lines[i]!;
    const trimmed = raw.trim();

    // Skip and process comment lines
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
      const metaMatch = META_LINE.exec(trimmed);
      if (metaMatch) {
        const key = metaMatch[1]!.toLowerCase();
        const val = metaMatch[2]!.trim();
        if (key === 'author') metadata.author = val;
        else if (key === 'ccli') metadata.ccli = val;
        else if (key === 'copyright') metadata.copyright = val;
      }
      continue;
    }

    // Check section header
    const headerName = matchSectionHeader(trimmed);
    if (headerName !== null) {
      hasSeenFirstContent = true;
      flushSlide();
      if (current.slides.length > 0 || current.startedByMarker) {
        sectionList.push(current);
      }
      current = {
        name: headerName,
        slides: [],
        startedByMarker: true,
      };
      continue;
    }

    // Check for un-commented metadata line before first section or slide content
    if (!hasSeenFirstContent && buffer.length === 0) {
      const metaMatch = META_LINE.exec(trimmed);
      if (metaMatch) {
        const key = metaMatch[1]!.toLowerCase();
        const val = metaMatch[2]!.trim();
        if (key === 'author') metadata.author = val;
        else if (key === 'ccli') metadata.ccli = val;
        else if (key === 'copyright') metadata.copyright = val;
        continue;
      }
    }

    // Blank line separates slides
    if (trimmed === '') {
      flushSlide();
      continue;
    }

    // Regular lyric line
    hasSeenFirstContent = true;
    buffer.push(raw);
  }

  flushSlide();

  if (
    current.slides.length > 0 ||
    current.startedByMarker ||
    sectionList.length === 0
  ) {
    sectionList.push(current);
  }

  // Drop leading implicit empty "Verse" when an explicitly markered section followed
  const filtered = sectionList.filter(
    (s, i) =>
      !(
        i === 0 &&
        !s.startedByMarker &&
        s.slides.length === 0 &&
        sectionList.length > 1
      )
  );

  const sections: Presentation['sections'] = [];
  const slides: Presentation['slides'] = [];

  for (const sec of filtered) {
    const sectionId = randomUUID();
    const slideIds: string[] = [];
    for (const slideText of sec.slides) {
      const slideId = randomUUID();
      slideIds.push(slideId);
      slides.push({
        id: slideId,
        items: [{ type: 'text', plainText: slideText }],
      });
    }
    sections.push({
      id: sectionId,
      name: sec.name,
      slideIds,
    });
  }

  const candidate: Presentation = {
    id: randomUUID(),
    title,
    sourceFormat: 'txt',
    metadata,
    sections,
    arrangements: [
      {
        id: randomUUID(),
        name: 'Default',
        slideIds: slides.map((s) => s.id),
      },
    ],
    slides,
    warnings: [],
  };

  const validated = parsePresentation(candidate);
  if (!validated.ok) {
    return {
      ok: false,
      error: new Error(
        `Imported text failed validation: ${validated.error.message}`
      ),
    };
  }

  return {
    ok: true,
    value: { presentations: [validated.value] },
    warnings: [],
  };
}

/**
 * Export a canonical Library as plain-text lyrics in deterministic structure:
 * - Title line, optional metadata comments.
 * - Section markers `[Section Name]`.
 * - Slide lyrics separated by blank lines.
 *
 * Single presentation per text file: fails closed if presentations.length !== 1.
 */
export function writeTxt(library: Library): WriteTxtResult {
  if (
    !library ||
    !Array.isArray(library.presentations) ||
    library.presentations.length === 0
  ) {
    return {
      ok: false,
      error: new Error('Cannot write a text file with no presentations.'),
    };
  }
  if (library.presentations.length !== 1) {
    return {
      ok: false,
      error: new Error('Text export supports exactly one presentation per file.'),
    };
  }

  const p = library.presentations[0]!;
  const warnings: Warning[] = [];
  const slideMap = new Map<string, Slide>(p.slides.map((s) => [s.id, s]));

  const lines: string[] = [p.title, ''];

  if (p.metadata.author) {
    lines.push(`# Author: ${p.metadata.author}`);
  }
  if (p.metadata.ccli) {
    lines.push(`# CCLI: ${p.metadata.ccli}`);
  }
  if (p.metadata.copyright) {
    lines.push(`# Copyright: ${p.metadata.copyright}`);
  }
  if (p.metadata.author || p.metadata.ccli || p.metadata.copyright) {
    lines.push('');
  }

  if (p.sections.length > 0) {
    for (const section of p.sections) {
      lines.push(`[${section.name}]`);
      lines.push('');
      for (const slideId of section.slideIds) {
        const slide = slideMap.get(slideId);
        if (slide) {
          const text = slide.items.map((i) => i.plainText).join('\n').trim();
          if (text !== '') {
            lines.push(text);
            lines.push('');
          }
        }
      }
    }

    const referencedSlideIds = new Set<string>();
    for (const sec of p.sections) {
      for (const id of sec.slideIds) {
        referencedSlideIds.add(id);
      }
    }
    const unreferenced = p.slides.filter((s) => !referencedSlideIds.has(s.id));
    if (unreferenced.length > 0) {
      lines.push('[Verse]');
      lines.push('');
      for (const slide of unreferenced) {
        const text = slide.items.map((i) => i.plainText).join('\n').trim();
        if (text !== '') {
          lines.push(text);
          lines.push('');
        }
      }
    }
  } else {
    lines.push('[Verse]');
    lines.push('');
    for (const slide of p.slides) {
      const text = slide.items.map((i) => i.plainText).join('\n').trim();
      if (text !== '') {
        lines.push(text);
        lines.push('');
      }
    }
  }

  const text = lines.join('\n');
  const bytes = new TextEncoder().encode(text);
  return {
    ok: true,
    value: { bytes, warnings },
    bytes,
    warnings,
  };
}
