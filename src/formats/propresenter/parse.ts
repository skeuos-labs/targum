import {
  parsePresentation,
  randomUUID,
  warning,
  type Presentation as CanonicalPresentation,
  type Warning,
} from '../../canonical/index.js';
import type { ProColor, ProCue, ProPresentation } from './pro-shape.js';
import { decodeRtfBytes, rtfHasFormatting } from './rtf.js';
import { getProtoRoot } from './root.js';

export type ParseProResult =
  | { ok: true; value: CanonicalPresentation; warnings: Warning[] }
  | { ok: false; error: Error };

/** Convert float RGBA (0..1) to #rrggbb, or undefined when no color data. */
function colorToHex(color: ProColor | null | undefined): string | undefined {
  if (!color) return undefined;
  if (color.red == null && color.green == null && color.blue == null) return undefined;
  const to255 = (v: number | null | undefined): number =>
    Math.max(0, Math.min(255, Math.round((v ?? 0) * 255)));
  const r = to255(color.red);
  const g = to255(color.green);
  const b = to255(color.blue);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function extractRtfStrings(cue: ProCue): string[] {
  const out: string[] = [];
  for (const action of cue.actions ?? []) {
    for (const el of action?.slide?.presentation?.baseSlide?.elements ?? []) {
      const rtf = el?.element?.text?.rtfData;
      if (rtf instanceof Uint8Array) {
        out.push(decodeRtfBytes(rtf));
      } else if (typeof rtf === 'string' && rtf.length > 0) {
        // Some producers store RTF as a latin1 string; re-encode to bytes for the decoder.
        const bytes = new Uint8Array(rtf.length);
        for (let i = 0; i < rtf.length; i++) bytes[i] = rtf.charCodeAt(i) & 0xff;
        out.push(decodeRtfBytes(bytes));
      }
    }
  }
  return out;
}

function rawRtfPresence(cue: ProCue): boolean {
  for (const action of cue.actions ?? []) {
    for (const el of action?.slide?.presentation?.baseSlide?.elements ?? []) {
      const rtf = el?.element?.text?.rtfData;
      if (rtf instanceof Uint8Array) {
        let s = '';
        for (let i = 0; i < rtf.length; i++) s += String.fromCharCode(rtf[i]!);
        if (rtfHasFormatting(s)) return true;
      } else if (typeof rtf === 'string' && rtfHasFormatting(rtf)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Decode a ProPresenter 7 `.pro` file (raw protobuf) into the canonical model.
 */
export function parsePro(bytes: Uint8Array, fileName?: string): ParseProResult {
  if (bytes.length === 0) {
    return {
      ok: false,
      error: new Error(`Empty byte array${fileName ? ` (${fileName})` : ''}`),
    };
  }

  const Presentation = getProtoRoot().lookupType('Presentation');
  let message: ProPresentation;
  try {
    message = Presentation.decode(bytes) as unknown as ProPresentation;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      ok: false,
      error: new Error(`Failed to decode ProPresenter protobuf: ${error.message}`),
    };
  }

  const warnings: Warning[] = [];
  const sections: CanonicalPresentation['sections'] = [];
  const slides: CanonicalPresentation['slides'] = [];

  const cueGroups = message.cueGroups ?? [];
  const cues = message.cues ?? [];
  const arrangements = message.arrangements ?? [];

  // Fail closed: a wire-valid protobuf with no cues and no groups is either a
  // corrupt file or an empty show. Neither is a faithful import.
  if (cues.length === 0 && cueGroups.length === 0) {
    return {
      ok: false,
      error: new Error(
        `ProPresenter file contains no cues and no cue groups${fileName ? ` (${fileName})` : ''}`
      ),
    };
  }

  const cueByUuid = new Map<string, ProCue>();
  for (const c of cues) {
    const id = c?.uuid?.string;
    if (id) cueByUuid.set(id, c);
  }

  const groupIdToSectionId = new Map<string, string>();
  const referencedCueIds = new Set<string>();

  function addSlide(cueObj: ProCue): string {
    const slideId = randomUUID();
    const texts = extractRtfStrings(cueObj);
    const plainText = texts.join('\n').trim();
    if (
      rawRtfPresence(cueObj) &&
      !warnings.some((w) => w.code === 'PRO_STYLES_NOT_EXTRACTED')
    ) {
      warnings.push(
        warning(
          'PRO_STYLES_NOT_EXTRACTED',
          'info',
          'Text formatting (fonts, colors, sizes) was present but is not extracted in this release'
        )
      );
    }
    slides.push({
      id: slideId,
      ...(cueObj.name ? { label: cueObj.name } : {}),
      items: [{ type: 'text', plainText }],
    });
    return slideId;
  }

  for (const g of cueGroups) {
    const groupId = g?.group?.uuid?.string;
    if (!groupId) continue;
    const sectionId = randomUUID();
    groupIdToSectionId.set(groupId, sectionId);
    const slideIds: string[] = [];
    for (const ref of g.cueIdentifiers ?? []) {
      const cueId = ref?.string;
      if (!cueId) continue;
      referencedCueIds.add(cueId);
      const cueObj = cueByUuid.get(cueId);
      if (!cueObj) continue;
      slideIds.push(addSlide(cueObj));
    }
    sections.push({
      id: sectionId,
      name: g.group?.name ?? '',
      slideIds,
      ...(colorToHex(g.group?.color) ? { color: colorToHex(g.group?.color)! } : {}),
    });
  }

  // Orphan cues: not referenced by any group — import anyway, warn.
  for (const c of cues) {
    const cueId = c?.uuid?.string;
    if (!cueId || referencedCueIds.has(cueId)) continue;
    const slideId = addSlide(c);
    warnings.push(
      warning('PRO_ORPHAN_CUE', 'warn', `Cue "${c.name ?? cueId}" is in no group`, {
        cueId,
        slideId,
      })
    );
  }

  // Arrangement: selected one (or first) -> flattened slide order via group order.
  const selectedUuid = message.selectedArrangement?.string;
  const chosen =
    arrangements.find((a) => a?.uuid?.string === selectedUuid) ??
    (arrangements.length > 0 ? arrangements[0] : undefined);

  const arrangementSlides: string[] = [];
  if (chosen?.groupIdentifiers) {
    for (const ref of chosen.groupIdentifiers) {
      const sectionId = groupIdToSectionId.get(ref.string ?? '');
      const section = sections.find((s) => s.id === sectionId);
      if (section) arrangementSlides.push(...section.slideIds);
    }
  }
  // Fallback: arrangement missing or yields no slides -> section appearance order
  if (arrangementSlides.length === 0) {
    for (const s of sections) arrangementSlides.push(...s.slideIds);
    if (arrangementSlides.length === 0) {
      for (const s of slides) arrangementSlides.push(s.id);
    }
  } else {
    // Warn about slides the chosen arrangement leaves out (orphans already warned)
    const inArrangement = new Set(arrangementSlides);
    const omitted = sections.flatMap((s) => s.slideIds).filter((id) => !inArrangement.has(id));
    if (omitted.length > 0) {
      warnings.push(
        warning(
          'PRO_ARRANGEMENT_OMITS_SLIDE',
          'warn',
          `Selected arrangement omits ${omitted.length} slide(s) from playback order`,
          { omittedCount: omitted.length, slideIds: omitted }
        )
      );
    }
  }

  const arrangementsOut: CanonicalPresentation['arrangements'] = [
    {
      id: randomUUID(),
      name: chosen?.name || 'Default',
      slideIds: arrangementSlides,
    },
  ];

  const title = message.name || fileName?.replace(/\.pro$/i, '') || 'Untitled';

  const metadata: CanonicalPresentation['metadata'] = {};
  if (fileName) metadata.originalFileName = fileName;
  if (message.notes) metadata.notes = message.notes;
  if (message.ccli?.author) metadata.author = message.ccli.author;
  if (message.ccli?.songNumber != null && message.ccli.songNumber !== 0) {
    metadata.ccli = String(message.ccli.songNumber);
  }
  if (message.ccli?.copyrightYear != null && message.ccli.copyrightYear !== 0) {
    metadata.copyright = String(message.ccli.copyrightYear);
  }

  const candidate: CanonicalPresentation = {
    id: randomUUID(),
    title,
    sourceFormat: 'pro',
    metadata,
    sections,
    arrangements: arrangementsOut,
    slides,
    warnings,
  };

  const validated = parsePresentation(candidate);
  if (!validated.ok) {
    return {
      ok: false,
      error: new Error(`Imported presentation failed validation: ${validated.error.message}`),
    };
  }
  return { ok: true, value: validated.value, warnings: validated.value.warnings };
}
