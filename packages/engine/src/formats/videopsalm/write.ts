import { TextReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js';
import {
  warning,
  type Presentation,
  type Section,
  type Warning,
} from '../../canonical/index.js';
import { serializeDialect, type Result } from './json.js';
import { VPC_KEY } from './key.js';

/**
 * Spec §4.3 VideoPsalm Tag integer to section name mapping.
 * 1: Chorus, 2: Prechorus, 3: Bridge, 4: Tag, 5: Intro, 6: Outro, 8: Instrumental, 9: Other.
 */
const SECTION_TO_TAG: Readonly<Record<string, number>> = Object.freeze({
  chorus: 1,
  prechorus: 2,
  'pre-chorus': 2,
  'pre chorus': 2,
  bridge: 3,
  tag: 4,
  intro: 5,
  outro: 6,
  instrumental: 8,
  other: 9,
});

function sanitizeEntryTitle(title: string): string {
  const sanitized = title.replace(/[/\\]/g, '_').trim();
  return sanitized.length > 0 ? sanitized : 'song';
}

/**
 * Serializes canonical presentations into an AES-128 encrypted VideoPsalm VPC archive.
 * Fails closed if presentations array is empty.
 */
export async function writeVpc(
  presentations: Presentation[]
): Promise<Result<{ bytes: Uint8Array; warnings: Warning[] }>> {
  if (!Array.isArray(presentations) || presentations.length === 0) {
    return {
      ok: false,
      error: new Error('Cannot write a VPC library with no presentations.'),
    };
  }

  try {
    const warnings: Warning[] = [];
    const songs: Record<string, unknown>[] = [];

    for (const pres of presentations) {
      const slideToSection = new Map<string, Section>();
      for (const section of pres.sections) {
        for (const slideId of section.slideIds) {
          if (!slideToSection.has(slideId)) {
            slideToSection.set(slideId, section);
          }
        }
      }

      const verses: Record<string, unknown>[] = [];
      const seenUnmapped = new Set<string>();

      for (const slide of pres.slides) {
        const section = slideToSection.get(slide.id);
        const sectionName = section?.name ?? slide.label ?? 'Verse';
        const normalizedName = sectionName.trim().toLowerCase();

        const tag = SECTION_TO_TAG[normalizedName];
        const verseObj: Record<string, unknown> = {};

        if (tag !== undefined) {
          verseObj.Tag = tag;
        } else {
          verseObj.Name = sectionName;
          if (!seenUnmapped.has(sectionName)) {
            seenUnmapped.add(sectionName);
            warnings.push(
              warning(
                'VPC_TAG_UNMAPPED',
                'info',
                `Section "${sectionName}" has no direct VideoPsalm tag; emitting as custom verse name`,
                { presentationId: pres.id, sectionName }
              )
            );
          }
        }

        const text = slide.items.map((item) => item.plainText).join('\n');
        verseObj.Text = text;

        verses.push(verseObj);
      }

      const songObj: Record<string, unknown> = {
        Guid: pres.metadata.songId ?? pres.id,
        Text: pres.title,
        Verses: verses,
      };

      if (pres.metadata.author) {
        songObj.Author = pres.metadata.author;
      }
      if (pres.metadata.copyright) {
        songObj.Copyright = pres.metadata.copyright;
      }
      if (pres.metadata.ccli) {
        songObj.Ccli = pres.metadata.ccli;
      }
      if (pres.metadata.notes) {
        songObj.Notes = pres.metadata.notes;
      }

      songs.push(songObj);
    }

    const songbook = { Songs: songs };
    const serialized = serializeDialect(songbook);

    const entryName =
      presentations.length === 1
        ? `${sanitizeEntryTitle(presentations[0]!.title)}.json`
        : 'library.json';

    const zipWriter = new ZipWriter(new Uint8ArrayWriter(), {
      password: VPC_KEY,
      encryptionStrength: 1,
    });
    await zipWriter.add(entryName, new TextReader(serialized));
    const bytes = await zipWriter.close();

    return {
      ok: true,
      value: { bytes, warnings },
      warnings,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}
