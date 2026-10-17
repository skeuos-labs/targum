import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseLibraryJson,
  serializeDialect,
  TAG_NAMES,
} from '../../src/formats/videopsalm/index.js';

describe('VideoPsalm JSON Dialect Codec', () => {
  describe('Exports', () => {
    it('exports parseLibraryJson and serializeDialect functions', () => {
      expect(typeof parseLibraryJson).toBe('function');
      expect(typeof serializeDialect).toBe('function');
    });

    it('exports TAG_NAMES dictionary matching spec §4.3', () => {
      expect(TAG_NAMES[1]).toBe('Chorus');
      expect(TAG_NAMES[2]).toBe('Prechorus');
      expect(TAG_NAMES[3]).toBe('Bridge');
      expect(TAG_NAMES[4]).toBe('Tag');
      expect(TAG_NAMES[5]).toBe('Intro');
      expect(TAG_NAMES[6]).toBe('Outro');
      expect(TAG_NAMES[8]).toBe('Instrumental');
      expect(TAG_NAMES[9]).toBe('Other');
      expect(TAG_NAMES[0]).toBeUndefined();
      expect(TAG_NAMES[7]).toBeUndefined();
    });
  });

  describe('parseLibraryJson: Lax unquoted JSON parsing', () => {
    it('parses unquoted-key JSON into canonical Library', () => {
      const raw = `{
        Songs: [
          {
            Guid: "test-guid-1",
            Text: "Blessed Be Your Name",
            Verses: [
              { Tag: 0, Text: "Blessed be Your name in the land that is plentiful" },
              { Tag: 1, Text: "Every blessing You pour out I will turn back to praise" }
            ]
          }
        ],
        Guid: "book-guid",
        Text: "Worship Hymnal"
      }`;

      const res = parseLibraryJson(raw, 'test.json');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const { presentations } = res.value;
      expect(presentations).toHaveLength(1);

      const pres = presentations[0]!;
      expect(pres.title).toBe('Blessed Be Your Name');
      expect(pres.sourceFormat).toBe('json');
      expect(pres.metadata.songId).toBe('test-guid-1');
      expect(pres.metadata.originalFileName).toBe('test.json');

      // Sections: 2 sections (Verse and Chorus)
      expect(pres.sections).toHaveLength(2);
      expect(pres.sections[0]!.name).toBe('Verse');
      expect(pres.sections[1]!.name).toBe('Chorus');

      // Slides
      expect(pres.slides).toHaveLength(2);
      expect(pres.slides[0]!.items[0]!.plainText).toBe(
        'Blessed be Your name in the land that is plentiful'
      );
      expect(pres.slides[1]!.items[0]!.plainText).toBe(
        'Every blessing You pour out I will turn back to praise'
      );

      // Default arrangement contains all slides in order
      expect(pres.arrangements).toHaveLength(1);
      expect(pres.arrangements[0]!.slideIds).toEqual([
        pres.slides[0]!.id,
        pres.slides[1]!.id,
      ]);
    });

    it('honors sourceFormat parameter (vpc vs json)', () => {
      const raw = `{ Text: "Solo Song", Verses: [{ Text: "Lyrics" }] }`;

      const resJson = parseLibraryJson(raw, 'solo.json', 'json');
      expect(resJson.ok).toBe(true);
      if (resJson.ok) {
        expect(resJson.value.presentations[0]!.sourceFormat).toBe('json');
      }

      const resVpc = parseLibraryJson(raw, 'solo.vpc', 'vpc');
      expect(resVpc.ok).toBe(true);
      if (resVpc.ok) {
        expect(resVpc.value.presentations[0]!.sourceFormat).toBe('vpc');
      }

      // Infers vpc from .vpc fileName when omitted
      const resInferred = parseLibraryJson(raw, 'archive.vpc');
      expect(resInferred.ok).toBe(true);
      if (resInferred.ok) {
        expect(resInferred.value.presentations[0]!.sourceFormat).toBe('vpc');
      }
    });
  });

  describe('Control character cleaning', () => {
    it('strips illegal control characters while preserving valid whitespace', () => {
      // Embed \u0000 (NUL), \u0007 (BEL), \u0008 (BS), \u000b (VT), \u000c (FF), \u001f (US)
      // while keeping \t (tab), \n (newline), \r (carriage return)
      const raw = `{
        Songs: [
          {
            Guid: "guid\u00001",
            Text: "Song\u0007\u0008Title",
            Verses: [
              {
                Tag: 1,
                Text: "Line 1\twith tab\u000b\nLine 2\r\nLine 3\u000c\u001f"
              }
            ]
          }
        ]
      }`;

      const res = parseLibraryJson(raw);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const pres = res.value.presentations[0]!;
      expect(pres.metadata.songId).toBe('guid1');
      expect(pres.title).toBe('SongTitle');
      expect(pres.slides[0]!.items[0]!.plainText).toBe(
        'Line 1\twith tab\nLine 2\r\nLine 3'
      );
    });
  });

  describe('Tag integer and Name to section mapping', () => {
    it('maps all defined integer tags to canonical section names', () => {
      const raw = `{
        Songs: [
          {
            Text: "Tag Test Song",
            Verses: [
              { Tag: 1, Text: "Chorus slide" },
              { Tag: 2, Text: "Prechorus slide" },
              { Tag: 3, Text: "Bridge slide" },
              { Tag: 4, Text: "Tag slide" },
              { Tag: 5, Text: "Intro slide" },
              { Tag: 6, Text: "Outro slide" },
              { Tag: 8, Text: "Instrumental slide" },
              { Tag: 9, Text: "Other slide" },
              { Tag: 0, Text: "Verse 0 slide" },
              { Tag: 7, Text: "Verse 7 slide" },
              { Tag: 99, Text: "Verse 99 slide" },
              { Text: "Undefined tag slide" }
            ]
          }
        ]
      }`;

      const res = parseLibraryJson(raw);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const pres = res.value.presentations[0]!;
      expect(pres.slides).toHaveLength(12);

      // Section names
      const sectionNames = pres.sections.map((s) => s.name);
      expect(sectionNames).toEqual([
        'Chorus',
        'Prechorus',
        'Bridge',
        'Tag',
        'Intro',
        'Outro',
        'Instrumental',
        'Other',
        'Verse', // Tag: 0, 7, 99, undefined all coalesce into single consecutive Verse section
      ]);

      // Slides 8, 9, 10, 11 all map to 'Verse' and share the last section
      const lastSection = pres.sections[pres.sections.length - 1]!;
      expect(lastSection.name).toBe('Verse');
      expect(lastSection.slideIds).toHaveLength(4);
    });

    it('prioritizes verse.Name string over Tag integer', () => {
      const raw = `{
        Songs: [
          {
            Text: "Custom Name Song",
            Verses: [
              { Tag: 1, Name: "Special Chorus", Text: "C1" },
              { Tag: 1, Name: "Special Chorus", Text: "C2" },
              { Tag: 3, Name: "Guitar Solo", Text: "Solo" },
              { Tag: 1, Text: "Regular Chorus" }
            ]
          }
        ]
      }`;

      const res = parseLibraryJson(raw);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const pres = res.value.presentations[0]!;
      expect(pres.sections).toHaveLength(3);
      expect(pres.sections[0]!.name).toBe('Special Chorus');
      expect(pres.sections[0]!.slideIds).toHaveLength(2);
      expect(pres.sections[1]!.name).toBe('Guitar Solo');
      expect(pres.sections[2]!.name).toBe('Chorus');
    });

    it('creates distinct sections when section names alternate', () => {
      const raw = `{
        Songs: [
          {
            Text: "Alternating Song",
            Verses: [
              { Tag: 0, Text: "Verse 1" },
              { Tag: 1, Text: "Chorus" },
              { Tag: 0, Text: "Verse 2" },
              { Tag: 1, Text: "Chorus" }
            ]
          }
        ]
      }`;

      const res = parseLibraryJson(raw);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const pres = res.value.presentations[0]!;
      expect(pres.sections).toHaveLength(4);
      expect(pres.sections.map((s) => s.name)).toEqual([
        'Verse',
        'Chorus',
        'Verse',
        'Chorus',
      ]);
    });
  });

  describe('Multi-song container formats', () => {
    it('parses Songs array container', () => {
      const raw = `{
        Songs: [
          { Guid: "s1", Text: "First Song", Verses: [{ Text: "V1" }] },
          { Guid: "s2", Text: "Second Song", Verses: [{ Text: "V2" }] }
        ]
      }`;

      const res = parseLibraryJson(raw);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.presentations).toHaveLength(2);
      expect(res.value.presentations[0]!.title).toBe('First Song');
      expect(res.value.presentations[1]!.title).toBe('Second Song');
    });

    it('parses top-level array container', () => {
      const raw = `[
        { Guid: "s1", Text: "Top Array 1", Verses: [{ Text: "V1" }] },
        { Guid: "s2", Text: "Top Array 2", Verses: [{ Text: "V2" }] }
      ]`;

      const res = parseLibraryJson(raw);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.presentations).toHaveLength(2);
      expect(res.value.presentations[0]!.title).toBe('Top Array 1');
      expect(res.value.presentations[1]!.title).toBe('Top Array 2');
    });

    it('parses single song root object', () => {
      const raw = `{
        Guid: "single-1",
        Text: "Single Direct Song",
        Verses: [
          { Tag: 1, Text: "Chorus slide" }
        ]
      }`;

      const res = parseLibraryJson(raw);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.presentations).toHaveLength(1);
      expect(res.value.presentations[0]!.title).toBe('Single Direct Song');
      expect(res.value.presentations[0]!.slides).toHaveLength(1);
    });
  });

  describe('serializeDialect', () => {
    it('serializes JS object into unquoted keys dialect', () => {
      const obj = {
        Guid: 'g-123',
        Text: 'Sample Song',
        Verses: [
          { Tag: 1, Text: 'Chorus text' }
        ]
      };

      const out = serializeDialect(obj);
      expect(out).toBe(
        '{Guid:"g-123",Text:"Sample Song",Verses:[{Tag:1,Text:"Chorus text"}]}'
      );
    });

    it('properly escapes double quotes and backslashes in strings', () => {
      const obj = {
        Quote: 'He said "Hello"',
        Backslash: 'Path\\to\\file',
        Mixed: 'Quote " and backslash \\ test'
      };

      const out = serializeDialect(obj);
      expect(out).toBe(
        '{Quote:"He said \\"Hello\\"",Backslash:"Path\\\\to\\\\file",Mixed:"Quote \\" and backslash \\\\ test"}'
      );
    });

    it('handles primitives, arrays, booleans, and null', () => {
      expect(serializeDialect(null)).toBe('null');
      expect(serializeDialect(true)).toBe('true');
      expect(serializeDialect(false)).toBe('false');
      expect(serializeDialect(42)).toBe('42');
      expect(serializeDialect([1, 'two', false, null])).toBe(
        '[1,"two",false,null]'
      );
    });

    it('omits undefined properties in objects', () => {
      const obj = {
        Keep: 'yes',
        Omit: undefined,
        Number: 10
      };

      const out = serializeDialect(obj);
      expect(out).toBe('{Keep:"yes",Number:10}');
    });
  });

  describe('Roundtrip fidelity', () => {
    it('roundtrips dialect serialized string back through parseLibraryJson', () => {
      const songData = {
        Guid: 'roundtrip-song-1',
        Text: 'Roundtrip Worship Song',
        Author: 'Author Name',
        Verses: [
          { Tag: 0, Text: 'Line 1 of verse\nLine 2 of verse' },
          { Tag: 1, Text: 'Chorus with "quotes" and \\backslashes\\' },
          { Tag: 3, Text: 'Bridge lyrics here' }
        ]
      };

      const serialized = serializeDialect({
        Songs: [songData]
      });

      // Keys should be unquoted
      expect(serialized).toContain('Songs:[');
      expect(serialized).toContain('Guid:"roundtrip-song-1"');

      // Parse back
      const res = parseLibraryJson(serialized, 'roundtrip.json');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const pres = res.value.presentations[0]!;
      expect(pres.title).toBe('Roundtrip Worship Song');
      expect(pres.slides).toHaveLength(3);
      expect(pres.slides[0]!.items[0]!.plainText).toBe(
        'Line 1 of verse\nLine 2 of verse'
      );
      expect(pres.slides[1]!.items[0]!.plainText).toBe(
        'Chorus with "quotes" and \\backslashes\\'
      );
      expect(pres.sections.map((s) => s.name)).toEqual([
        'Verse',
        'Chorus',
        'Bridge',
      ]);
    });
  });

  describe('Error handling / Fail closed', () => {
    it('fails closed on empty string', () => {
      const res = parseLibraryJson('');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBeInstanceOf(Error);
      }
    });

    it('fails closed on whitespace-only string', () => {
      const res = parseLibraryJson('    \n\t   ');
      expect(res.ok).toBe(false);
    });

    it('fails closed on non-JSON corrupt garbage', () => {
      const res = parseLibraryJson('not a json at all {[[::');
      expect(res.ok).toBe(false);
    });

    it('fails closed on primitive JSON values', () => {
      expect(parseLibraryJson('42').ok).toBe(false);
      expect(parseLibraryJson('"just a string"').ok).toBe(false);
      expect(parseLibraryJson('true').ok).toBe(false);
      expect(parseLibraryJson('null').ok).toBe(false);
    });

    it('fails closed on empty object or empty songs container', () => {
      expect(parseLibraryJson('{}').ok).toBe(false);
      expect(parseLibraryJson('{Songs:[]}').ok).toBe(false);
      expect(parseLibraryJson('[]').ok).toBe(false);
    });
  });

  describe('Real fixture asset verification', () => {
    const cevamPath = resolve(
      import.meta.dirname,
      '../../audit-output/temp-verify/runs/vpc-to-txt/Cevam/Cevam/Cevam.json'
    );

    it('parses real Cevam.json if fixture exists', () => {
      if (!existsSync(cevamPath)) {
        return; // Skip if run in environment without audit-output
      }

      const content = readFileSync(cevamPath, 'utf-8');
      const res = parseLibraryJson(content, 'Cevam.vpc');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const { presentations } = res.value;
      expect(presentations.length).toBeGreaterThanOrEqual(1);

      const song = presentations[0]!;
      expect(song.title).toBe('IZY');
      expect(song.sourceFormat).toBe('vpc');
      expect(song.slides.length).toBeGreaterThan(10);
    });
  });
});
