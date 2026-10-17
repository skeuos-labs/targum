import { jsonrepair } from 'jsonrepair';
import {
  parsePresentation,
  randomUUID,
  warning,
  type Arrangement,
  type Library,
  type Metadata,
  type Presentation as CanonicalPresentation,
  type Section,
  type Slide,
  type SourceFormat,
  type Warning,
} from '../../canonical/index.js';

export type Result<T> =
  | { ok: true; value: T; warnings: Warning[] }
  | { ok: false; error: Error };

export type ParseLibraryJsonResult = Result<Library>;

/**
 * Spec §4.3 VideoPsalm Tag integer to section name mapping.
 * 1: Chorus, 2: Prechorus, 3: Bridge, 4: Tag, 5: Intro, 6: Outro, 8: Instrumental, 9: Other.
 * Any other number or undefined defaults to "Verse".
 */
export const TAG_NAMES: Readonly<Record<number, string>> = Object.freeze({
  1: 'Chorus',
  2: 'Prechorus',
  3: 'Bridge',
  4: 'Tag',
  5: 'Intro',
  6: 'Outro',
  8: 'Instrumental',
  9: 'Other',
});

const ILLEGAL_CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

function cleanJsonString(text: string): string {
  return text.replace(ILLEGAL_CONTROL_CHARS, '');
}

function resolveSectionName(verse: Record<string, unknown>): string {
  if (typeof verse.Name === 'string' && verse.Name.trim().length > 0) {
    return verse.Name.trim();
  }
  if (typeof verse.name === 'string' && verse.name.trim().length > 0) {
    return verse.name.trim();
  }
  const rawTag = verse.Tag ?? verse.tag;
  const tagNum =
    typeof rawTag === 'number'
      ? rawTag
      : typeof rawTag === 'string' && rawTag.trim() !== ''
        ? Number(rawTag)
        : NaN;

  if (!isNaN(tagNum) && tagNum in TAG_NAMES) {
    return TAG_NAMES[tagNum]!;
  }
  return 'Verse';
}

/**
 * Serializes JS values into VideoPsalm's custom unquoted JSON dialect
 * (`{Guid:"...",Text:"...",Verses:[{Tag:1,Text:"..."}]}`).
 * Properly escapes backslashes and double quotes inside string values.
 */
export function serializeDialect(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'null';
  }
  if (typeof value === 'string') {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeDialect(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const parts: string[] = [];
    for (const [key, val] of Object.entries(value)) {
      if (val === undefined) continue;
      parts.push(`${key}:${serializeDialect(val)}`);
    }
    return `{${parts.join(',')}}`;
  }
  return String(value);
}

/**
 * Parses raw JSON in VideoPsalm dialect into a canonical Library.
 * Handles illegal control character stripping, lax JSON dialect repair,
 * tag-to-section mapping, and multiple container structures.
 */
export function parseLibraryJson(
  rawText: string,
  fileName?: string,
  sourceFormat?: 'vpc' | 'json'
): ParseLibraryJsonResult {
  if (typeof rawText !== 'string' || rawText.trim().length === 0) {
    return {
      ok: false,
      error: new Error(
        `Empty VideoPsalm JSON string${fileName ? ` (${fileName})` : ''}`
      ),
    };
  }

  const cleaned = cleanJsonString(rawText);

  let parsed: unknown;
  try {
    const repaired = jsonrepair(cleaned);
    parsed = JSON.parse(repaired);
  } catch (err) {
    return {
      ok: false,
      error: new Error(
        `Failed to parse VideoPsalm JSON: ${err instanceof Error ? err.message : String(err)}`
      ),
    };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return {
      ok: false,
      error: new Error(
        `Invalid VideoPsalm JSON: root must be an object or array${fileName ? ` (${fileName})` : ''}`
      ),
    };
  }

  let songObjects: unknown[] = [];
  if (Array.isArray(parsed)) {
    songObjects = parsed;
  } else {
    const rootObj = parsed as Record<string, unknown>;
    if (Array.isArray(rootObj.Songs)) {
      songObjects = rootObj.Songs;
    } else if (Array.isArray(rootObj.songs)) {
      songObjects = rootObj.songs;
    } else if (
      Array.isArray(rootObj.Verses) ||
      Array.isArray(rootObj.verses) ||
      typeof rootObj.Text === 'string' ||
      typeof rootObj.text === 'string' ||
      typeof rootObj.Title === 'string' ||
      typeof rootObj.title === 'string'
    ) {
      songObjects = [rootObj];
    } else {
      return {
        ok: false,
        error: new Error(
          `Invalid VideoPsalm JSON: no songs found in root object${fileName ? ` (${fileName})` : ''}`
        ),
      };
    }
  }

  if (songObjects.length === 0) {
    return {
      ok: false,
      error: new Error(
        `No songs found in VideoPsalm JSON${fileName ? ` (${fileName})` : ''}`
      ),
    };
  }

  const resolvedFormat: SourceFormat =
    sourceFormat ?? (fileName?.toLowerCase().endsWith('.vpc') ? 'vpc' : 'json');

  const presentations: CanonicalPresentation[] = [];

  for (let i = 0; i < songObjects.length; i++) {
    const songRaw = songObjects[i];
    if (typeof songRaw !== 'object' || songRaw === null) {
      continue;
    }
    const song = songRaw as Record<string, unknown>;

    const songTitle =
      (typeof song.Text === 'string' && song.Text.trim()) ||
      (typeof song.Title === 'string' && song.Title.trim()) ||
      (typeof song.Name === 'string' && song.Name.trim()) ||
      (songObjects.length === 1 && fileName
        ? fileName.replace(/\.(json|vpc)$/i, '')
        : undefined) ||
      'Untitled Song';

    const songId =
      song.Guid ?? song.guid ?? song.Id ?? song.id ?? song.songId;
    const author =
      song.Author ?? song.author ?? song.Composer ?? song.composer;
    const copyright = song.Copyright ?? song.copyright;
    const ccli = song.Ccli ?? song.ccli ?? song.CCLI;
    const notes = song.Notes ?? song.notes;

    const metadata: Metadata = {
      ...(fileName ? { originalFileName: fileName } : {}),
      ...(songId != null ? { songId: String(songId) } : {}),
      ...(author != null ? { author: String(author) } : {}),
      ...(copyright != null ? { copyright: String(copyright) } : {}),
      ...(ccli != null ? { ccli: String(ccli) } : {}),
      ...(notes != null ? { notes: String(notes) } : {}),
    };

    const rawVerses = Array.isArray(song.Verses)
      ? song.Verses
      : Array.isArray(song.verses)
        ? song.verses
        : [];

    const slides: Slide[] = [];
    const sections: Section[] = [];
    const songWarnings: Warning[] = [];

    let currentSection: Section | null = null;

    for (const vRaw of rawVerses) {
      if (typeof vRaw !== 'object' || vRaw === null) continue;
      const v = vRaw as Record<string, unknown>;

      const sectionName = resolveSectionName(v);
      const text =
        typeof v.Text === 'string'
          ? v.Text
          : typeof v.text === 'string'
            ? v.text
            : '';

      const slideId = randomUUID();
      const slide: Slide = {
        id: slideId,
        label: sectionName,
        items: [
          {
            type: 'text',
            plainText: text,
          },
        ],
      };
      slides.push(slide);

      if (!currentSection || currentSection.name !== sectionName) {
        currentSection = {
          id: randomUUID(),
          name: sectionName,
          slideIds: [slideId],
        };
        sections.push(currentSection);
      } else {
        currentSection.slideIds.push(slideId);
      }
    }

    if (slides.length === 0) {
      songWarnings.push(
        warning(
          'NO_SLIDES',
          'warn',
          `Song "${songTitle}" contains no slides`,
          { songIndex: i, songTitle }
        )
      );
    }

    const arrangements: Arrangement[] =
      slides.length > 0
        ? [
            {
              id: randomUUID(),
              name: 'Default',
              slideIds: slides.map((s) => s.id),
            },
          ]
        : [];

    const candidate: CanonicalPresentation = {
      id: randomUUID(),
      title: songTitle,
      sourceFormat: resolvedFormat,
      metadata,
      sections,
      arrangements,
      slides,
      warnings: songWarnings,
    };

    const validated = parsePresentation(candidate);
    if (!validated.ok) {
      return {
        ok: false,
        error: new Error(
          `Failed to validate presentation "${songTitle}": ${validated.error.message}`
        ),
      };
    }

    presentations.push(validated.value);
  }

  if (presentations.length === 0) {
    return {
      ok: false,
      error: new Error(
        `No valid presentations could be extracted${fileName ? ` (${fileName})` : ''}`
      ),
    };
  }

  const allWarnings = presentations.flatMap((p) => p.warnings);
  return {
    ok: true,
    value: { presentations },
    warnings: allWarnings,
  };
}
