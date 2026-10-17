import {
  TextReader,
  TextWriter,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
} from '@zip.js/zip.js';
import {
  parsePresentation,
  randomUUID,
  warning,
  type Arrangement,
  type Library,
  type Metadata,
  type Presentation,
  type Section,
  type Slide,
  type Warning,
} from '../../canonical/index.js';

export type Result<T> =
  | { ok: true; value: T; warnings: Warning[] }
  | { ok: false; error: Error };

export type WriteFreeShowSuccess = {
  bytes: Uint8Array;
  warnings: Warning[];
};

export type WriteFreeShowResult =
  | {
      ok: true;
      value: WriteFreeShowSuccess;
      bytes: Uint8Array;
      warnings: Warning[];
    }
  | { ok: false; error: Error };

interface FsTextRun {
  value?: unknown;
  style?: unknown;
}

interface FsLine {
  align?: unknown;
  text?: FsTextRun[] | FsTextRun;
}

interface FsItem {
  type?: unknown;
  lines?: FsLine[];
  [key: string]: unknown;
}

interface FsSlide {
  name?: unknown;
  label?: unknown;
  group?: unknown;
  color?: unknown;
  notes?: unknown;
  items?: FsItem[];
  [key: string]: unknown;
}

interface FsLayout {
  name?: unknown;
  slides?: { id?: unknown }[];
  [key: string]: unknown;
}

interface FsPresentation {
  name?: unknown;
  meta?: Record<string, unknown>;
  slides?: Record<string, FsSlide> | FsSlide[];
  layouts?: Record<string, FsLayout>;
  [key: string]: unknown;
}

interface FsGroup {
  name?: unknown;
  color?: unknown;
  [key: string]: unknown;
}

interface FsDocument {
  presentations?: Record<string, FsPresentation> | FsPresentation[];
  groups?: Record<string, FsGroup>;
  [key: string]: unknown;
}

function lineRuns(line: FsLine): FsTextRun[] {
  const t = line.text;
  if (t === undefined) return [];
  return Array.isArray(t) ? t : [t];
}

function lineText(line: FsLine, hadStyleRef: { value: boolean }): string {
  let str = '';
  for (const run of lineRuns(line)) {
    if (typeof run.style === 'string' && run.style.trim() !== '') {
      hadStyleRef.value = true;
    }
    if (typeof run.value === 'string') {
      str += run.value;
    }
  }
  return str;
}

function itemText(item: FsItem, hadStyleRef: { value: boolean }): string {
  const lines: string[] = [];
  for (const ln of item.lines ?? []) {
    lines.push(lineText(ln, hadStyleRef));
  }
  return lines.join('\n');
}

function isMacMetadata(name: string): boolean {
  return name.startsWith('__MACOSX/') || (name.split('/').pop()?.startsWith('._') ?? false);
}

function isRawJson(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.byteLength; i++) {
    const b = bytes[i];
    // Skip whitespace: space (32), tab (9), LF (10), CR (13)
    if (b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d) continue;
    return b === 0x7b /* { */ || b === 0x5b /* [ */;
  }
  return false;
}

/**
 * Import a FreeShow native project file (.show) into a canonical Library.
 * Handles ZIP archives containing show.json or raw JSON byte streams.
 * Clean-room implementation of the format shape — MIT licensed.
 */
export async function parseFreeShow(
  bytes: Uint8Array,
  fileName?: string
): Promise<Result<Library>> {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    return {
      ok: false,
      error: new Error(`Invalid or empty FreeShow bytes${fileName ? ` (${fileName})` : ''}.`),
    };
  }

  let rawJson: string;

  if (isRawJson(bytes)) {
    try {
      rawJson = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: new Error(`Failed to decode JSON bytes: ${message}`),
      };
    }
  } else {
    let zipReader: ZipReader<Uint8Array> | undefined;
    try {
      zipReader = new ZipReader(new Uint8ArrayReader(bytes));
      const entries = await zipReader.getEntries();
      const jsonEntry = entries.find(
        (e) =>
          !e.directory &&
          !isMacMetadata(e.filename) &&
          e.filename.toLowerCase().endsWith('.json')
      );
      if (!jsonEntry || jsonEntry.directory || !jsonEntry.getData) {
        return {
          ok: false,
          error: new Error(
            `No JSON document found inside the FreeShow archive${fileName ? ` (${fileName})` : ''}.`
          ),
        };
      }
      rawJson = await jsonEntry.getData(new TextWriter());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: new Error(
          `Failed to read FreeShow archive: ${message}${fileName ? ` (${fileName})` : ''}`
        ),
      };
    } finally {
      if (zipReader) {
        try {
          await zipReader.close();
        } catch {
          // Ignore secondary close error
        }
      }
    }
  }

  let doc: unknown;
  try {
    doc = JSON.parse(rawJson);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: new Error(`FreeShow document is not valid JSON: ${message}`),
    };
  }

  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return {
      ok: false,
      error: new Error('FreeShow document has no presentations.'),
    };
  }

  const fsDoc = doc as FsDocument;
  if (!fsDoc.presentations || typeof fsDoc.presentations !== 'object') {
    return {
      ok: false,
      error: new Error('FreeShow document has no presentations.'),
    };
  }

  const presEntries: [string, FsPresentation][] = Array.isArray(fsDoc.presentations)
    ? fsDoc.presentations.map((p, i) => [String(i), p])
    : Object.entries(fsDoc.presentations);

  if (presEntries.length === 0) {
    return {
      ok: false,
      error: new Error('FreeShow document has no presentations.'),
    };
  }

  const groupNames = new Map<string, string>();
  const groupColors = new Map<string, string>();
  for (const [id, g] of Object.entries(fsDoc.groups ?? {})) {
    if (g && typeof g === 'object') {
      if (typeof g.name === 'string' && g.name.trim() !== '') {
        groupNames.set(id, g.name.trim());
      }
      if (typeof g.color === 'string' && g.color.trim() !== '') {
        groupColors.set(id, g.color.trim());
      }
    }
  }

  const libraryWarnings: Warning[] = [];
  const presentations: Presentation[] = [];

  for (const [presId, fsPres] of presEntries) {
    if (!fsPres || typeof fsPres !== 'object') {
      continue;
    }

    try {
      const warnings: Warning[] = [];
      const sections: Section[] = [];
      const slides: Slide[] = [];
      const sectionByName = new Map<string, Section>();
      let hadStyle = false;
      let ignoredItems = 0;
      let notesCount = 0;

      const allSlides: Record<string, FsSlide> = Array.isArray(fsPres.slides)
        ? Object.fromEntries(fsPres.slides.map((s, i) => [String(i), s]))
        : ((fsPres.slides ?? {}) as Record<string, FsSlide>);

      // FreeShow layouts define slide playback ordering.
      // Order slides by first layout, then append any remaining slide definitions.
      const layouts = (fsPres.layouts ?? {}) as Record<string, FsLayout>;
      const firstLayout = layouts.default ?? Object.values(layouts)[0];
      const layoutSlideIds: string[] = [];
      if (firstLayout && Array.isArray(firstLayout.slides)) {
        for (const item of firstLayout.slides) {
          if (
            item &&
            typeof item === 'object' &&
            typeof item.id === 'string' &&
            item.id in allSlides
          ) {
            layoutSlideIds.push(item.id);
          }
        }
      }

      const seenSlideIds = new Set<string>();
      const orderedSlideIds: string[] = [];
      for (const id of layoutSlideIds) {
        if (!seenSlideIds.has(id)) {
          seenSlideIds.add(id);
          orderedSlideIds.push(id);
        }
      }
      for (const id of Object.keys(allSlides)) {
        if (!seenSlideIds.has(id)) {
          seenSlideIds.add(id);
          orderedSlideIds.push(id);
        }
      }

      for (const slideKey of orderedSlideIds) {
        const slide = allSlides[slideKey]!;
        const styleRef = { value: false };
        const textPieces: string[] = [];

        for (const item of slide.items ?? []) {
          if (item.type !== undefined && item.type !== 'text') {
            ignoredItems++;
            continue;
          }
          textPieces.push(itemText(item, styleRef));
        }

        if (styleRef.value) {
          hadStyle = true;
        }

        if (typeof slide.notes === 'string' && slide.notes.trim() !== '') {
          notesCount++;
        }

        const rawGroup = typeof slide.group === 'string' ? slide.group : '';
        const groupName = (groupNames.get(rawGroup) ?? rawGroup).trim() || 'Verse';
        const groupColor =
          groupColors.get(rawGroup) ??
          (typeof slide.color === 'string' ? slide.color : undefined);

        const canonicalSlideId =
          typeof slideKey === 'string' && slideKey.trim().length > 0
            ? slideKey.trim()
            : randomUUID();

        let section = sectionByName.get(groupName);
        if (!section) {
          const sectionId = randomUUID();
          section = {
            id: sectionId,
            name: groupName,
            color: groupColor && groupColor.trim() !== '' ? groupColor.trim() : undefined,
            slideIds: [],
          };
          sectionByName.set(groupName, section);
          sections.push(section);
        }
        section.slideIds.push(canonicalSlideId);

        const plainText = textPieces.join('\n');
        slides.push({
          id: canonicalSlideId,
          label:
            typeof slide.name === 'string' && slide.name.trim() !== ''
              ? slide.name.trim()
              : typeof slide.label === 'string' && slide.label.trim() !== ''
              ? slide.label.trim()
              : undefined,
          items: [{ type: 'text', plainText }],
        });
      }

      if (slides.length === 0) {
        warnings.push(
          warning(
            'FREESHOW_EMPTY_PRESENTATION',
            'warn',
            `Presentation "${typeof fsPres.name === 'string' ? fsPres.name : presId}" has no slides`,
            { presentationId: presId }
          )
        );
      }

      if (hadStyle) {
        warnings.push(
          warning(
            'FREESHOW_STYLES_NOT_EXTRACTED',
            'info',
            'Text run styling was present but is not extracted in this release'
          )
        );
      }

      if (ignoredItems > 0) {
        warnings.push(
          warning(
            'FREESHOW_ITEMS_IGNORED',
            'info',
            `${ignoredItems} non-text item(s) were not imported`,
            { itemCount: ignoredItems }
          )
        );
      }

      if (notesCount > 0) {
        warnings.push(
          warning(
            'FREESHOW_NOTES_DROPPED',
            'info',
            `${notesCount} slide note(s) were not imported`,
            { noteCount: notesCount }
          )
        );
      }

      const meta = (fsPres.meta ?? {}) as Record<string, unknown>;
      const metadata: Metadata = {};
      if (fileName) metadata.originalFileName = fileName;
      if (typeof meta.author === 'string' && meta.author.trim()) {
        metadata.author = meta.author.trim();
      } else if (typeof meta.artist === 'string' && meta.artist.trim()) {
        metadata.author = meta.artist.trim();
      }
      if (meta.CCLI !== undefined && String(meta.CCLI).trim() !== '') {
        metadata.ccli = String(meta.CCLI).trim();
      } else if (meta.ccli !== undefined && String(meta.ccli).trim() !== '') {
        metadata.ccli = String(meta.ccli).trim();
      }
      if (meta.copyright !== undefined && String(meta.copyright).trim() !== '') {
        metadata.copyright = String(meta.copyright).trim();
      }
      if (typeof meta.notes === 'string' && meta.notes.trim()) {
        metadata.notes = meta.notes.trim();
      }

      const arrangements: Arrangement[] = [];
      if (fsPres.layouts && typeof fsPres.layouts === 'object') {
        for (const [layoutKey, layout] of Object.entries(fsPres.layouts)) {
          if (!layout || typeof layout !== 'object') continue;
          const name =
            typeof layout.name === 'string' && layout.name.trim() !== ''
              ? layout.name.trim()
              : layoutKey;
          const arrSlideIds: string[] = [];
          if (Array.isArray(layout.slides)) {
            for (const s of layout.slides) {
              if (s && typeof s === 'object' && typeof s.id === 'string' && s.id in allSlides) {
                arrSlideIds.push(s.id);
              }
            }
          }
          if (arrSlideIds.length > 0) {
            arrangements.push({
              id: layoutKey || randomUUID(),
              name,
              slideIds: arrSlideIds,
            });
          }
        }
      }
      if (arrangements.length === 0) {
        arrangements.push({
          id: randomUUID(),
          name: 'Default',
          slideIds: slides.map((s) => s.id),
        });
      }

      const candidate: Presentation = {
        id: presId || randomUUID(),
        title:
          (typeof fsPres.name === 'string' && fsPres.name.trim()) ||
          (typeof meta.title === 'string' && meta.title.trim()) ||
          (fileName ? fileName.replace(/\.show$/i, '') : '') ||
          'Untitled',
        sourceFormat: 'freeshow',
        metadata,
        sections,
        arrangements,
        slides,
        warnings,
      };

      const validated = parsePresentation(candidate);
      if (!validated.ok) {
        libraryWarnings.push(
          warning(
            'FREESHOW_PRESENTATION_INVALID',
            'error',
            `Presentation "${candidate.title}" failed validation: ${validated.error.message}`,
            { presentationId: presId }
          )
        );
        continue;
      }

      presentations.push(validated.value);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      libraryWarnings.push(
        warning(
          'FREESHOW_PRESENTATION_FAILED',
          'warn',
          `A presentation could not be parsed: ${message}`,
          { presentationId: presId }
        )
      );
    }
  }

  if (presentations.length === 0) {
    return {
      ok: false,
      error: new Error('No presentations could be extracted from the FreeShow document.'),
    };
  }

  return {
    ok: true,
    value: { presentations },
    warnings: libraryWarnings,
  };
}

/**
 * Export a canonical Library into a FreeShow native project archive (.show).
 * Maps canonical sections into FreeShow group labels.
 * Clean-room implementation — MIT licensed.
 */
export async function writeFreeShow(
  library: Library
): Promise<WriteFreeShowResult> {
  if (!library || !Array.isArray(library.presentations) || library.presentations.length === 0) {
    return {
      ok: false,
      error: new Error('Cannot write a FreeShow file with no presentations.'),
    };
  }

  const groups: Record<string, { name: string; color: string }> = {};
  const presentations: Record<string, unknown> = {};
  const warnings: Warning[] = [];

  for (const p of library.presentations) {
    const slides: Record<string, unknown> = {};

    const slideToSection = new Map<string, Section>();
    for (const section of p.sections) {
      for (const slideId of section.slideIds) {
        if (!slideToSection.has(slideId)) {
          slideToSection.set(slideId, section);
        }
      }
    }

    for (const slide of p.slides) {
      const section = slideToSection.get(slide.id);
      const groupName = section?.name ?? slide.label ?? 'Verse';
      const groupId = section?.id ?? `group-${groupName}`;

      groups[groupId] = {
        name: groupName,
        color: section?.color ?? '',
      };

      const text = slide.items.map((i) => i.plainText).join('\n');
      const lines = text.split(/\r?\n/).map((line) => ({
        align: '',
        text: [{ value: line, style: '' }],
      }));
      slides[slide.id] = {
        name: slide.label ?? '',
        group: groupId,
        color: section?.color ?? '',
        notes: '',
        items: [
          {
            type: 'text',
            lines,
          },
        ],
      };
    }

    const defaultArrangement = p.arrangements?.find((arr) => arr.id === 'default');
    const defaultSlideIds = defaultArrangement
      ? defaultArrangement.slideIds
      : p.slides.map((s) => s.id);

    const layouts: Record<string, unknown> = {
      default: {
        name: defaultArrangement?.name ?? 'Default',
        slides: defaultSlideIds.map((id) => ({ id })),
      },
    };

    if (p.arrangements && p.arrangements.length > 0) {
      for (const arr of p.arrangements) {
        if (arr.id !== 'default') {
          layouts[arr.id] = {
            name: arr.name,
            slides: arr.slideIds.map((id) => ({ id })),
          };
        }
      }
    }

    const meta: Record<string, unknown> = {
      title: p.title,
    };
    if (p.metadata.author) meta.author = p.metadata.author;
    if (p.metadata.ccli) meta.CCLI = p.metadata.ccli;
    if (p.metadata.copyright) meta.copyright = p.metadata.copyright;
    if (p.metadata.notes) meta.notes = p.metadata.notes;

    presentations[p.id] = {
      name: p.title,
      meta,
      slides,
      layouts,
    };
  }

  const doc = { presentations, groups };
  const serialized = JSON.stringify(doc, null, 2);

  const writer = new ZipWriter(new Uint8ArrayWriter());
  try {
    await writer.add('show.json', new TextReader(serialized));
    const bytes = await writer.close();
    return {
      ok: true,
      value: { bytes, warnings },
      bytes,
      warnings,
    };
  } catch (err) {
    try {
      await writer.close();
    } catch {
      // Ignore secondary close error
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: new Error(`Failed to build FreeShow archive: ${message}`),
    };
  }
}
