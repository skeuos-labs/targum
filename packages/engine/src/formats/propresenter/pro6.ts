import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  parsePresentation,
  randomUUID,
  warning,
  type Presentation as CanonicalPresentation,
  type Warning,
} from '../../canonical/index.js';
import { decodeRtfBytes, rtfHasFormatting } from './rtf.js';

export type ParsePro6Result =
  | { ok: true; value: CanonicalPresentation; warnings: Warning[] }
  | { ok: false; error: Error };

function getStringAttr(
  node: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const k of keys) {
    const val = node[k];
    if (val !== undefined && val !== null) {
      const s = String(val).trim();
      if (s.length > 0) return s;
    }
  }
  return undefined;
}

function parseColorToHex(colorStr: unknown): string | undefined {
  if (typeof colorStr !== 'string') return undefined;
  const trimmed = colorStr.trim();
  if (!trimmed) return undefined;
  const parts = trimmed.split(/\s+/).map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return undefined;

  const [rF, gF, bF, aF] = parts;
  if (aF !== undefined && aF === 0) return undefined;

  const to255 = (v: number): number =>
    Math.max(0, Math.min(255, Math.round(v * 255)));
  const r = to255(rF!);
  const g = to255(gF!);
  const b = to255(bF!);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function findChild(parent: Record<string, unknown>, ivarName: string): unknown {
  if (Array.isArray(parent.array)) {
    const found = parent.array.find(
      (a: unknown) =>
        typeof a === 'object' &&
        a !== null &&
        (a as Record<string, unknown>)['@_rvXMLIvarName'] === ivarName
    );
    if (found) return found;
  }
  if (parent[ivarName] !== undefined) {
    return parent[ivarName];
  }
  return undefined;
}

function getGroupings(root: Record<string, unknown>): Record<string, unknown>[] {
  const groupsContainer = findChild(root, 'groups');
  if (groupsContainer && typeof groupsContainer === 'object') {
    const containerObj = groupsContainer as Record<string, unknown>;
    if (Array.isArray(containerObj.RVSlideGrouping)) {
      return containerObj.RVSlideGrouping;
    }
    if (
      containerObj.RVSlideGrouping &&
      typeof containerObj.RVSlideGrouping === 'object'
    ) {
      return [containerObj.RVSlideGrouping as Record<string, unknown>];
    }
  }
  if (Array.isArray(root.RVSlideGrouping)) {
    return root.RVSlideGrouping as Record<string, unknown>[];
  }
  if (root.RVSlideGrouping && typeof root.RVSlideGrouping === 'object') {
    return [root.RVSlideGrouping as Record<string, unknown>];
  }
  return [];
}

function getSlides(
  grouping: Record<string, unknown>
): Record<string, unknown>[] {
  const slidesContainer = findChild(grouping, 'slides');
  if (slidesContainer && typeof slidesContainer === 'object') {
    const containerObj = slidesContainer as Record<string, unknown>;
    if (Array.isArray(containerObj.RVDisplaySlide)) {
      return containerObj.RVDisplaySlide;
    }
    if (
      containerObj.RVDisplaySlide &&
      typeof containerObj.RVDisplaySlide === 'object'
    ) {
      return [containerObj.RVDisplaySlide as Record<string, unknown>];
    }
  }
  if (Array.isArray(grouping.RVDisplaySlide)) {
    return grouping.RVDisplaySlide as Record<string, unknown>[];
  }
  if (grouping.RVDisplaySlide && typeof grouping.RVDisplaySlide === 'object') {
    return [grouping.RVDisplaySlide as Record<string, unknown>];
  }
  return [];
}

function getTextElements(
  slide: Record<string, unknown>
): Record<string, unknown>[] {
  const dispContainer = findChild(slide, 'displayElements');
  if (dispContainer && typeof dispContainer === 'object') {
    const containerObj = dispContainer as Record<string, unknown>;
    if (Array.isArray(containerObj.RVTextElement)) {
      return containerObj.RVTextElement;
    }
    if (
      containerObj.RVTextElement &&
      typeof containerObj.RVTextElement === 'object'
    ) {
      return [containerObj.RVTextElement as Record<string, unknown>];
    }
  }
  if (Array.isArray(slide.RVTextElement)) {
    return slide.RVTextElement as Record<string, unknown>[];
  }
  if (slide.RVTextElement && typeof slide.RVTextElement === 'object') {
    return [slide.RVTextElement as Record<string, unknown>];
  }
  return [];
}

function extractRtfBase64(
  textElement: Record<string, unknown>
): string | undefined {
  const nsStrings = textElement.NSString;
  const list = Array.isArray(nsStrings)
    ? nsStrings
    : nsStrings
      ? [nsStrings]
      : [];
  for (const ns of list) {
    if (typeof ns === 'object' && ns !== null) {
      const ivar = (ns as Record<string, unknown>)['@_rvXMLIvarName'];
      if (ivar === 'RTFData' || ivar === undefined) {
        const text = (ns as Record<string, unknown>)['#text'];
        if (typeof text === 'string' && text.trim()) return text.trim();
      }
    } else if (typeof ns === 'string' && ns.trim()) {
      return ns.trim();
    }
  }
  if (textElement.RTFData) {
    const val = textElement.RTFData;
    if (typeof val === 'string' && val.trim()) return val.trim();
    if (
      typeof val === 'object' &&
      val !== null &&
      '#text' in (val as Record<string, unknown>)
    ) {
      const t = (val as Record<string, unknown>)['#text'];
      if (typeof t === 'string' && t.trim()) return t.trim();
    }
  }
  return undefined;
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(b64, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
  }
  const binary = atob(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decode a ProPresenter 6 `.pro6` XML document into the canonical presentation model.
 */
export function parsePro6(
  bytes: Uint8Array,
  fileName?: string
): ParsePro6Result {
  if (bytes.length === 0) {
    return {
      ok: false,
      error: new Error(`Empty byte array${fileName ? ` (${fileName})` : ''}`),
    };
  }

  let xmlText: string;
  try {
    xmlText = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    try {
      xmlText = new TextDecoder('windows-1252').decode(bytes);
    } catch (err) {
      return {
        ok: false,
        error: new Error(
          `Failed to decode XML bytes: ${err instanceof Error ? err.message : String(err)}`
        ),
      };
    }
  }

  const validation = XMLValidator.validate(xmlText);
  if (validation !== true) {
    const msg =
      typeof validation === 'object' && validation.err?.msg
        ? `${validation.err.msg} at line ${validation.err.line}, col ${validation.err.col}`
        : 'Malformed XML';
    return {
      ok: false,
      error: new Error(`Failed to parse ProPresenter 6 XML: ${msg}`),
    };
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) =>
      [
        'array',
        'RVSlideGrouping',
        'RVDisplaySlide',
        'RVTextElement',
        'NSString',
      ].includes(name),
    trimValues: false,
  });

  let parsed: unknown;
  try {
    parsed = parser.parse(xmlText);
  } catch (err) {
    return {
      ok: false,
      error: new Error(
        `Failed to parse XML: ${err instanceof Error ? err.message : String(err)}`
      ),
    };
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('RVPresentationDocument' in parsed)
  ) {
    return {
      ok: false,
      error: new Error(
        `Invalid ProPresenter 6 document: missing RVPresentationDocument root${fileName ? ` (${fileName})` : ''}`
      ),
    };
  }

  const root = (parsed as Record<string, unknown>)
    .RVPresentationDocument as Record<string, unknown>;
  if (!root || typeof root !== 'object') {
    return {
      ok: false,
      error: new Error('Invalid ProPresenter 6 document: empty root'),
    };
  }

  const warnings: Warning[] = [];
  const sections: CanonicalPresentation['sections'] = [];
  const slides: CanonicalPresentation['slides'] = [];

  let hasFormatting = false;

  const groupings = getGroupings(root);

  for (const grouping of groupings) {
    const sectionId = randomUUID();
    const groupName =
      typeof grouping['@_name'] === 'string' ? grouping['@_name'] : '';
    const groupColor = parseColorToHex(grouping['@_color']);
    const slideIds: string[] = [];

    const rawSlides = getSlides(grouping);
    for (const rawSlide of rawSlides) {
      const slideId = randomUUID();
      slideIds.push(slideId);

      const labelAttr = rawSlide['@_label'];
      const label =
        typeof labelAttr === 'string' && labelAttr.trim().length > 0
          ? labelAttr.trim()
          : undefined;

      const textElements = getTextElements(rawSlide);
      const texts: string[] = [];

      for (const te of textElements) {
        const b64 = extractRtfBase64(te);
        if (!b64) continue;

        try {
          const rtfBytes = base64ToBytes(b64);
          const plain = decodeRtfBytes(rtfBytes);
          if (plain.length > 0) {
            texts.push(plain);
          }

          let rawRtf = '';
          for (let i = 0; i < rtfBytes.length; i++) {
            rawRtf += String.fromCharCode(rtfBytes[i]!);
          }
          if (rtfHasFormatting(rawRtf)) {
            hasFormatting = true;
          }
        } catch {
          // Non-decodable RTF string: skip quietly
        }
      }

      const plainText = texts.join('\n').trim();
      slides.push({
        id: slideId,
        ...(label ? { label } : {}),
        items: [{ type: 'text', plainText }],
      });
    }

    sections.push({
      id: sectionId,
      name: groupName,
      slideIds,
      ...(groupColor ? { color: groupColor } : {}),
    });
  }

  // Fail closed if no slides were found in the document
  if (slides.length === 0) {
    return {
      ok: false,
      error: new Error(
        `ProPresenter 6 document contains no slides${fileName ? ` (${fileName})` : ''}`
      ),
    };
  }

  if (hasFormatting) {
    warnings.push(
      warning(
        'PRO_STYLES_NOT_EXTRACTED',
        'info',
        'Text formatting (fonts, colors, sizes) was present but is not extracted in this release'
      )
    );
  }

  // Arrangement fallback: flatten in section appearance order
  const arrangementSlideIds = sections.flatMap((s) => s.slideIds);
  const arrangementsOut: CanonicalPresentation['arrangements'] = [
    {
      id: randomUUID(),
      name: 'Default',
      slideIds: arrangementSlideIds,
    },
  ];

  const songTitle = getStringAttr(root, ['@_CCLISongTitle', '@_title']);
  const title =
    songTitle || fileName?.replace(/\.pro6$/i, '') || 'Untitled';

  const metadata: CanonicalPresentation['metadata'] = {};
  if (fileName) metadata.originalFileName = fileName;

  const author = getStringAttr(root, ['@_author', '@_CCLIAuthor']);
  if (author) metadata.author = author;

  const copyright = getStringAttr(root, [
    '@_copyright',
    '@_CCLICopyrightYear',
    '@_CCLICopyright',
  ]);
  if (copyright) metadata.copyright = copyright;

  const ccli = getStringAttr(root, [
    '@_ccliLicense',
    '@_CCLISongNumber',
    '@_ccliNumber',
    '@_ccli',
  ]);
  if (ccli) metadata.ccli = ccli;

  const notes = getStringAttr(root, ['@_notes']);
  if (notes) metadata.notes = notes;

  const retained: Record<string, unknown> = {};
  const category = getStringAttr(root, ['@_category']);
  if (category) retained.category = category;

  const candidate: CanonicalPresentation = {
    id: randomUUID(),
    title,
    sourceFormat: 'pro6',
    metadata,
    sections,
    arrangements: arrangementsOut,
    slides,
    warnings,
    ...(Object.keys(retained).length > 0 ? { retained } : {}),
  };

  const validated = parsePresentation(candidate);
  if (!validated.ok) {
    return {
      ok: false,
      error: new Error(
        `Imported presentation failed validation: ${validated.error.message}`
      ),
    };
  }

  return { ok: true, value: validated.value, warnings: validated.value.warnings };
}
