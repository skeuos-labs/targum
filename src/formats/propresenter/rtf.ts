/**
 * ProPresenter RTF Codec
 *
 * Encodes plain text to ProPresenter-compatible RTF byte streams and
 * parses RTF strings/bytes into clean plain text.
 */

const CP1252_MAP: Record<number, number> = {
  0x80: 0x20ac, // € Euro sign
  0x82: 0x201a, // ‚ Single low-9 quotation mark
  0x83: 0x0192, // ƒ Latin small letter f with hook
  0x84: 0x201e, // „ Double low-9 quotation mark
  0x85: 0x2026, // … Horizontal ellipsis
  0x86: 0x2020, // † Dagger
  0x87: 0x2021, // ‡ Double dagger
  0x88: 0x02c6, // ˆ Modifier letter circumflex accent
  0x89: 0x2030, // ‰ Per mille sign
  0x8a: 0x0160, // Š Latin capital letter S with caron
  0x8b: 0x2039, // ‹ Single left-pointing angle quotation mark
  0x8c: 0x0152, // Œ Latin capital ligature OE
  0x8e: 0x017d, // Ž Latin capital letter Z with caron
  0x91: 0x2018, // ‘ Left single quotation mark
  0x92: 0x2019, // ’ Right single quotation mark
  0x93: 0x201c, // “ Left double quotation mark
  0x94: 0x201d, // ” Right double quotation mark
  0x95: 0x2022, // • Bullet
  0x96: 0x2013, // – En dash
  0x97: 0x2014, // — Em dash
  0x98: 0x02dc, // ˜ Small tilde
  0x99: 0x2122, // ™ Trade mark sign
  0x9a: 0x0161, // š Latin small letter s with caron
  0x9b: 0x203a, // › Single right-pointing angle quotation mark
  0x9c: 0x0153, // œ Latin small ligature oe
  0x9e: 0x017e, // ž Latin small letter z with caron
  0x9f: 0x0178, // Ÿ Latin capital letter Y with diaeresis
};

function cp1252ToChar(byte: number): string {
  if (byte >= 0x80 && byte <= 0x9f) {
    const mapped = CP1252_MAP[byte];
    return mapped !== undefined ? String.fromCharCode(mapped) : String.fromCharCode(byte);
  }
  return String.fromCharCode(byte);
}

const DESTINATION_WORDS = new Set([
  'fonttbl',
  'colortbl',
  'stylesheet',
  'info',
  'generator',
  'header',
  'headerl',
  'headerr',
  'headerf',
  'footer',
  'footerl',
  'footerr',
  'footerf',
  'listtable',
  'listoverridetable',
  'xmlnstbl',
  'pict',
  'object',
  'themedata',
  'colorschememapping',
  'datastore',
]);

const SPECIAL_WORDS: Record<string, string> = {
  tab: '\t',
  emdash: '—',
  endash: '–',
  bullet: '•',
  lquote: '‘',
  rquote: '’',
  ldblquote: '“',
  rdblquote: '”',
};

function isLetter(c: string | undefined): boolean {
  if (!c) return false;
  const code = c.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isDigit(c: string | undefined): boolean {
  if (!c) return false;
  const code = c.charCodeAt(0);
  return code >= 48 && code <= 57;
}

/**
 * Encodes plain text to RTF bytes with standard ProPresenter font table.
 * Standard template uses Helvetica 48pt (fs96).
 */
export function encodeRtf(plainText: string): Uint8Array {
  let escaped = '';
  for (let i = 0; i < plainText.length; i++) {
    const char = plainText[i]!;
    if (char === '\\') {
      escaped += '\\\\';
    } else if (char === '{') {
      escaped += '\\{';
    } else if (char === '}') {
      escaped += '\\}';
    } else if (char === '\r') {
      if (plainText[i + 1] === '\n') {
        i++;
      }
      escaped += '\\par\r\n';
    } else if (char === '\n') {
      escaped += '\\par\r\n';
    } else {
      const code = char.charCodeAt(0);
      if (code > 127) {
        const signed = code > 32767 ? code - 65536 : code;
        escaped += `\\u${signed}?`;
      } else {
        escaped += char;
      }
    }
  }

  const rtf = `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fswiss Helvetica;}}\\f0\\fs96 ${escaped}}`;
  return new TextEncoder().encode(rtf);
}

interface GroupState {
  skip: boolean;
  uc: number;
  isAtStart: boolean;
}

/**
 * Parses RTF document string, stripping formatting and destination blocks,
 * and extracts normalized plain text.
 */
export function decodeRtf(rtf: string): string {
  const groupStack: GroupState[] = [{ skip: false, uc: 1, isAtStart: false }];
  let output = '';
  let i = 0;
  const len = rtf.length;

  while (i < len) {
    const current = groupStack[groupStack.length - 1]!;

    if (rtf[i] === '{') {
      i++;
      groupStack.push({
        skip: current.skip,
        uc: current.uc,
        isAtStart: true,
      });
      continue;
    }

    if (rtf[i] === '}') {
      i++;
      if (groupStack.length > 1) {
        groupStack.pop();
      }
      continue;
    }

    if (rtf[i] === '\\') {
      i++;
      if (i >= len) break;
      const next = rtf[i]!;

      if (isLetter(next)) {
        let word = '';
        while (i < len && isLetter(rtf[i])) {
          word += rtf[i]!;
          i++;
        }

        let hasParam = false;
        let paramStr = '';
        if (i < len && (rtf[i] === '-' || isDigit(rtf[i]))) {
          hasParam = true;
          paramStr += rtf[i]!;
          i++;
          while (i < len && isDigit(rtf[i])) {
            paramStr += rtf[i]!;
            i++;
          }
        }
        const param = hasParam ? parseInt(paramStr, 10) : undefined;

        if (i < len && rtf[i] === ' ') {
          i++;
        }

        if (current.isAtStart && DESTINATION_WORDS.has(word)) {
          current.skip = true;
        }
        current.isAtStart = false;

        if (current.skip) {
          continue;
        }

        if (word === 'par' || word === 'line') {
          output += '\n';
        } else if (word === 'uc') {
          current.uc = param !== undefined ? param : 1;
        } else if (word === 'u') {
          let code = param !== undefined ? param : 0;
          if (code < 0) {
            code += 65536;
          }
          output += String.fromCharCode(code);

          for (let f = 0; f < current.uc && i < len; f++) {
            if (rtf[i] === '\\') {
              i++;
              if (i < len && rtf[i] === '\'') {
                i += 3;
              } else if (i < len && (rtf[i] === '{' || rtf[i] === '}' || rtf[i] === '\\')) {
                i++;
              } else if (i < len && isLetter(rtf[i])) {
                while (i < len && isLetter(rtf[i])) i++;
                if (i < len && (rtf[i] === '-' || isDigit(rtf[i]))) {
                  i++;
                  while (i < len && isDigit(rtf[i])) i++;
                }
                if (i < len && rtf[i] === ' ') i++;
              }
            } else {
              i++;
            }
          }
        } else if (SPECIAL_WORDS[word]) {
          output += SPECIAL_WORDS[word];
        }
        continue;
      }

      if (current.isAtStart && next === '*') {
        current.skip = true;
        current.isAtStart = false;
        i++;
        continue;
      }
      current.isAtStart = false;

      if (next === '\'') {
        i++;
        const hex = rtf.slice(i, i + 2);
        i += 2;
        if (!current.skip) {
          const byte = parseInt(hex, 16);
          if (!isNaN(byte)) {
            output += cp1252ToChar(byte);
          }
        }
        continue;
      }

      if (next === '{' || next === '}' || next === '\\') {
        i++;
        if (!current.skip) {
          output += next;
        }
        continue;
      }

      if (next === '~') {
        i++;
        if (!current.skip) {
          output += '\u00A0';
        }
        continue;
      }

      if (next === '_') {
        i++;
        if (!current.skip) {
          output += '-';
        }
        continue;
      }

      if (next === '-') {
        i++;
        continue;
      }

      if (next === ' ') {
        i++;
        if (!current.skip) {
          output += ' ';
        }
        continue;
      }

      if (next === '\r' || next === '\n') {
        if (next === '\r' && i + 1 < len && rtf[i + 1] === '\n') {
          i += 2;
        } else {
          i++;
        }
        if (!current.skip) {
          output += '\n';
        }
        continue;
      }

      i++;
      continue;
    }

    const char = rtf[i]!;
    if (char === '\r' || char === '\n') {
      i++;
      continue;
    }

    if (char !== ' ' && char !== '\t') {
      current.isAtStart = false;
    }

    if (!current.skip) {
      output += char;
    }
    i++;
  }

  return output.replace(/\r\n|\r/g, '\n').trimEnd();
}

/**
 * Decodes RTF byte array (handling Latin-1 or UTF-8 byte streams) into plain text.
 */
export function decodeRtfBytes(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  return decodeRtf(text);
}
