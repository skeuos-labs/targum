import { describe, expect, it } from 'vitest';
import {
  decodeRtf,
  decodeRtfBytes,
  encodeRtf,
} from '../../src/formats/propresenter/rtf.js';

describe('RTF Codec', () => {
  describe('encodeRtf', () => {
    it('encodes plain text into RTF bytes with standard ProPresenter font table', () => {
      const plain = 'Amazing Grace';
      const bytes = encodeRtf(plain);
      expect(bytes).toBeInstanceOf(Uint8Array);

      const rtfString = new TextDecoder('utf-8').decode(bytes);
      expect(rtfString).toBe(
        '{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fswiss Helvetica;}}\\f0\\fs96 Amazing Grace}'
      );
    });

    it('converts newlines (\\r\\n, \\r, \\n) to \\par\\r\\n', () => {
      const textLf = 'Line 1\nLine 2';
      const textCrlf = 'Line 1\r\nLine 2';
      const textCr = 'Line 1\rLine 2';

      const rtfLf = new TextDecoder().decode(encodeRtf(textLf));
      const rtfCrlf = new TextDecoder().decode(encodeRtf(textCrlf));
      const rtfCr = new TextDecoder().decode(encodeRtf(textCr));

      const expected =
        '{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fswiss Helvetica;}}\\f0\\fs96 Line 1\\par\r\nLine 2}';

      expect(rtfLf).toBe(expected);
      expect(rtfCrlf).toBe(expected);
      expect(rtfCr).toBe(expected);
    });

    it('escapes braces and backslashes', () => {
      const text = 'Braces {and} slash \\';
      const rtf = new TextDecoder().decode(encodeRtf(text));

      expect(rtf).toContain('Braces \\{and\\} slash \\\\');
    });

    it('escapes non-ASCII characters using unicode escapes', () => {
      const text = 'Café & résumé';
      const rtf = new TextDecoder().decode(encodeRtf(text));

      expect(rtf).toContain('\\u233?');
      expect(rtf).not.toContain('é');
    });

    it('handles empty string', () => {
      const bytes = encodeRtf('');
      const rtf = new TextDecoder().decode(bytes);
      expect(rtf).toBe(
        '{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fswiss Helvetica;}}\\f0\\fs96 }'
      );
    });
  });

  describe('decodeRtf', () => {
    it('decodes simple RTF document to plain text', () => {
      const rtf =
        '{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fswiss Helvetica;}}\\f0\\fs96 Amazing Grace}';
      expect(decodeRtf(rtf)).toBe('Amazing Grace');
    });

    it('strips font tables, color tables, and stylesheets', () => {
      const rtf = `{\\rtf1\\ansi\\ansicpg1252
{\\fonttbl\\f0\\fnil\\fcharset0 Georgia;\\f1\\fswiss Arial;}
{\\colortbl;\\red255\\green255\\blue255;\\red0\\green0\\blue0;}
{\\*\\expandedcolortbl;;\\csgenericrgb\\c0\\c0\\c0;}
{\\stylesheet{\\s0 Normal;}}
\\pard\\f0\\fs96 Slide Content}`;

      expect(decodeRtf(rtf)).toBe('Slide Content');
    });

    it('strips generator, info, and headers/footers', () => {
      const rtf = `{\\rtf1\\ansi\\ansicpg1252
{\\*\\generator Mac OS X 10.15.7;}
{\\info{\\title Song Title}{\\author John Doe}}
{\\header Header text}
{\\footer Footer text}
\\f0\\fs96 Main lyrics}`;

      expect(decodeRtf(rtf)).toBe('Main lyrics');
    });

    it('handles paragraph breaks (\\par) and line breaks (\\line)', () => {
      const rtf =
        '{\\rtf1\\ansi\\deff0 Line 1\\par Line 2\\line Line 3\\par\\r\nLine 4}';
      expect(decodeRtf(rtf)).toBe('Line 1\nLine 2\nLine 3\nLine 4');
    });

    it('handles ProPresenter escaped line breaks (\\ followed by newline)', () => {
      const rtf = `{\\rtf1\\ansi\\ansicpg1252
It\\'92s your love O Lord\\
That makes me sing\\
It\\'92s your endless grace\\
New life it brings}`;

      expect(decodeRtf(rtf)).toBe(
        "It’s your love O Lord\nThat makes me sing\nIt’s your endless grace\nNew life it brings"
      );
    });

    it('handles CP1252 hex escape sequences (\\\'xx)', () => {
      const rtf =
        '{\\rtf1\\ansi Christ\\\'97by grace\\\'85 It\\\'92s \\\'93quoted\\\'94 \\\'96 en-dash}';
      expect(decodeRtf(rtf)).toBe('Christ—by grace… It’s “quoted” – en-dash');
    });

    it('handles accented characters in CP1252 hex escapes', () => {
      const rtf = '{\\rtf1\\ansi Caf\\\'e9 et na\\\'efve}';
      expect(decodeRtf(rtf)).toBe('Café et naïve');
    });

    it('handles Unicode escapes (\\uN?) with fallback character skipped', () => {
      const rtf = '{\\rtf1\\ansi Caf\\u233? and na\\u239?ve}';
      expect(decodeRtf(rtf)).toBe('Café and naïve');
    });

    it('handles signed negative Unicode escapes (surrogates for emoji)', () => {
      // U+1F3B5 (musical note 🎵): high surrogate 0xD83C (55356 -> -10180), low surrogate 0xDFB5 (57269 -> -8267)
      const rtf = '{\\rtf1\\ansi Song \\u-10180?\\u-8267? Playing}';
      expect(decodeRtf(rtf)).toBe('Song 🎵 Playing');
    });

    it('handles unsigned 16-bit Unicode escapes', () => {
      const rtf = '{\\rtf1\\ansi Song \\u55356?\\u57269? Playing}';
      expect(decodeRtf(rtf)).toBe('Song 🎵 Playing');
    });

    it('handles \\uc0 where no fallback character is provided', () => {
      const rtf = '{\\rtf1\\ansi\\uc0\\u233x}';
      expect(decodeRtf(rtf)).toBe('éx');
    });

    it('handles special control words (\\tab, \\emdash, \\endash, \\bullet, quotes)', () => {
      const rtf =
        '{\\rtf1\\ansi Item\\tab\\bullet\\ldblquote Hello\\rdblquote\\emdash\\lquote World\\rquote}';
      expect(decodeRtf(rtf)).toBe('Item\t•“Hello”—‘World’');
    });

    it('handles escaped braces and backslashes', () => {
      const rtf = '{\\rtf1\\ansi \\{Curly\\} and \\\\backslash}';
      expect(decodeRtf(rtf)).toBe('{Curly} and \\backslash');
    });

    it('trims trailing whitespace and normalizes line breaks', () => {
      const rtf = '{\\rtf1\\ansi Line 1\\par\r\nLine 2\\par\r\n\\par\r\n   }';
      expect(decodeRtf(rtf)).toBe('Line 1\nLine 2');
    });

    it('decodes real ProPresenter 6 base64-encoded RTF sample', () => {
      const base64Rtf =
        'e1xydGYxXGFuc2lcYW5zaWNwZzEyNTJcY29jb2FydGYxNTA0XGNvY29hc3VicnRmODMwCntcZm9udHRibFxmMFxmbmlsXGZjaGFyc2V0MCBHZW9yZ2lhO30Ke1xjb2xvcnRibDtccmVkMjU1XGdyZWVuMjU1XGJsdWUyNTU7XHJlZDBcZ3JlZW4wXGJsdWUwO30Ke1wqXGV4cGFuZGVkY29sb3J0Ymw7O1xjc2dlbmVyaWNyZ2JcYzBcYzBcYzA7fQpccGFyZFx0eDU2MFx0eDExMjBcdHgxNjgwXHR4MjI0MFx0eDI4MDBcdHgzMzYwXHR4MzkyMFx0eDQ0ODBcdHg1MDQwXHR4NTYwMFx0eDYxNjBcdHg2NzIwXHBhcmRpcm5hdHVyYWxccWNccGFydGlnaHRlbmZhY3RvcjAKClxmMFxpXGZzMTA1IFxjZjIgXGtlcm5pbmcxXGV4cG5kOFxleHBuZHR3NDAKSmVzdXMgaXMgYWxpdmV9';
      const rtf = Buffer.from(base64Rtf, 'base64').toString('utf-8');
      expect(decodeRtf(rtf)).toBe('Jesus is alive');
    });
  });

  describe('decodeRtfBytes', () => {
    it('decodes UTF-8 bytes to plain text', () => {
      const plain = 'How Great Is Our God';
      const bytes = encodeRtf(plain);
      expect(decodeRtfBytes(bytes)).toBe(plain);
    });

    it('decodes Windows-1252 / Latin-1 bytes with raw 8-bit characters', () => {
      // Raw 0x92 byte is ’ in Windows-1252
      const rtf = '{\\rtf1\\ansi It\x92s working}';
      const bytes = new Uint8Array(Buffer.from(rtf, 'latin1'));
      expect(decodeRtfBytes(bytes)).toBe('It’s working');
    });
  });

  describe('Roundtrip encode and decode', () => {
    it('roundtrips single line text', () => {
      const original = 'Amazing Grace, how sweet the sound';
      expect(decodeRtfBytes(encodeRtf(original))).toBe(original);
    });

    it('roundtrips multiline lyrics', () => {
      const original =
        'Amazing Grace, how sweet the sound\nThat saved a wretch like me\nI once was lost, but now am found\nWas blind, but now I see';
      expect(decodeRtfBytes(encodeRtf(original))).toBe(original);
    });

    it('roundtrips text with special characters and Unicode', () => {
      const original =
        'Song {No. 1} \\ Intro\nCafé & naïve — 🎵 “Peace” & ‘Grace’';
      expect(decodeRtfBytes(encodeRtf(original))).toBe(original);
    });
  });
});
