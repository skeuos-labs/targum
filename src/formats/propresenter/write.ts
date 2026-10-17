import {
  randomUUID,
  warning,
  type Presentation as CanonicalPresentation,
  type Warning,
} from '../../canonical/index.js';
import { encodeRtf } from './rtf.js';
import { getProtoRoot } from './root.js';

export type WriteProResult =
  | {
      ok: true;
      bytes: Uint8Array;
      warnings: Warning[];
      value: { bytes: Uint8Array; warnings: Warning[] };
    }
  | { ok: false; error: Error };

function hexToColor(hex: string): { red: number; green: number; blue: number; alpha: number } | undefined {
  const clean = hex.replace(/^#/, '');
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return { red: r, green: g, blue: b, alpha: 1 };
    }
  } else if (clean.length === 3) {
    const r = parseInt(clean[0]! + clean[0]!, 16) / 255;
    const g = parseInt(clean[1]! + clean[1]!, 16) / 255;
    const b = parseInt(clean[2]! + clean[2]!, 16) / 255;
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return { red: r, green: g, blue: b, alpha: 1 };
    }
  }
  return undefined;
}

/**
 * Serialize a canonical Presentation into a ProPresenter 7 Protobuf byte stream.
 */
export function writePro(presentation: CanonicalPresentation): WriteProResult {
  if (
    !presentation ||
    !Array.isArray(presentation.slides) ||
    presentation.slides.length === 0
  ) {
    return {
      ok: false,
      error: new Error('Presentation contains no slides'),
    };
  }

  const warnings: Warning[] = [];

  const slideIdToCueId = new Map<string, string>();
  const cues: Record<string, unknown>[] = [];

  for (const s of presentation.slides) {
    const cueUuid = randomUUID();
    slideIdToCueId.set(s.id, cueUuid);

    const plainText = (s.items ?? [])
      .map((it) => it.plainText ?? '')
      .join('\n')
      .trim();

    const rtfBytes = encodeRtf(plainText);

    cues.push({
      uuid: { string: cueUuid },
      name: s.label ?? '',
      isEnabled: true,
      actions: [
        {
          uuid: { string: randomUUID() },
          isEnabled: true,
          type: 11, // ACTION_TYPE_PRESENTATION_SLIDE
          slide: {
            presentation: {
              baseSlide: {
                uuid: { string: randomUUID() },
                backgroundColor: { alpha: 1 },
                size: { width: 1920, height: 1080 },
                elements: [
                  {
                    element: {
                      uuid: { string: randomUUID() },
                      name: 'Lyrics',
                      bounds: {
                        origin: { x: 192, y: 270 },
                        size: { width: 1536, height: 540 },
                      },
                      path: {
                        closed: true,
                        points: [
                          { point: { x: 0, y: 0 }, q0: { x: 0, y: 0 }, q1: { x: 0, y: 0 } },
                          { point: { x: 1, y: 0 }, q0: { x: 1, y: 0 }, q1: { x: 1, y: 0 } },
                          { point: { x: 1, y: 1 }, q0: { x: 1, y: 1 }, q1: { x: 1, y: 1 } },
                          { point: { x: 0, y: 1 }, q0: { x: 0, y: 1 }, q1: { x: 0, y: 1 } },
                        ],
                        shape: {
                          type: 1, // TYPE_RECTANGLE
                        },
                      },
                      fill: {
                        enable: true,
                        color: { alpha: 1 },
                      },
                      stroke: {
                        enable: false,
                        color: { red: 1, green: 1, blue: 1, alpha: 1 },
                      },
                      text: {
                        attributes: {
                          font: {
                            name: 'Helvetica',
                            family: 'Helvetica',
                            size: 48,
                          },
                          paragraphStyle: {
                            alignment: 2, // ALIGNMENT_CENTER
                            lineHeightMultiple: 1,
                          },
                        },
                        scaleBehavior: 2, // SCALE_BEHAVIOR_SCALE_FONT_DOWN
                        rtfData: rtfBytes,
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    });
  }

  // Map canonical sections into cueGroups
  interface GroupDefinition {
    id: string;
    slideIds: string[];
  }

  const cueGroups: Record<string, unknown>[] = [];
  const groupDefs: GroupDefinition[] = [];

  if (presentation.sections && presentation.sections.length > 0) {
    for (const sec of presentation.sections) {
      const groupId = sec.id || randomUUID();
      const validSlideIds: string[] = [];

      for (const sid of sec.slideIds ?? []) {
        if (!slideIdToCueId.has(sid)) {
          warnings.push(
            warning(
              'PRO_DANGLING_SLIDE_ID',
              'warn',
              `Section "${sec.name}" references non-existent slide ID "${sid}"`,
              { sectionId: sec.id, slideId: sid }
            )
          );
        } else {
          validSlideIds.push(sid);
        }
      }

      const color = sec.color ? hexToColor(sec.color) : undefined;
      cueGroups.push({
        group: {
          uuid: { string: groupId },
          name: sec.name,
          ...(color ? { color } : {}),
        },
        cueIdentifiers: validSlideIds.map((sid) => ({
          string: slideIdToCueId.get(sid)!,
        })),
      });

      groupDefs.push({
        id: groupId,
        slideIds: validSlideIds,
      });
    }
  } else {
    // Default group covering all slides
    const defaultGroupId = randomUUID();
    const allSlideIds = presentation.slides.map((s) => s.id);

    cueGroups.push({
      group: {
        uuid: { string: defaultGroupId },
        name: 'Default',
      },
      cueIdentifiers: presentation.slides.map((s) => ({
        string: slideIdToCueId.get(s.id)!,
      })),
    });

    groupDefs.push({
      id: defaultGroupId,
      slideIds: allSlideIds,
    });
  }

  // Map arrangements
  const protoArrangements: Record<string, unknown>[] = [];
  let selectedArrangementUuid: string | undefined;

  if (presentation.arrangements && presentation.arrangements.length > 0) {
    for (const arr of presentation.arrangements) {
      const arrUuid = arr.id || randomUUID();
      const validArrSlideIds: string[] = [];

      for (const sid of arr.slideIds ?? []) {
        if (!slideIdToCueId.has(sid)) {
          warnings.push(
            warning(
              'PRO_DANGLING_SLIDE_ID',
              'warn',
              `Arrangement "${arr.name}" references non-existent slide ID "${sid}"`,
              { arrangementId: arr.id, slideId: sid }
            )
          );
        } else {
          validArrSlideIds.push(sid);
        }
      }

      const groupIdentifiers: Array<{ string: string }> = [];
      let i = 0;
      while (i < validArrSlideIds.length) {
        let matched = false;
        for (const g of groupDefs) {
          if (g.slideIds.length === 0) continue;
          const slice = validArrSlideIds.slice(i, i + g.slideIds.length);
          if (
            slice.length === g.slideIds.length &&
            slice.every((id, idx) => id === g.slideIds[idx])
          ) {
            groupIdentifiers.push({ string: g.id });
            i += g.slideIds.length;
            matched = true;
            break;
          }
        }
        if (!matched) {
          const currentSlideId = validArrSlideIds[i]!;
          const g = groupDefs.find((item) => item.slideIds.includes(currentSlideId));
          if (g) {
            groupIdentifiers.push({ string: g.id });
          }
          i++;
        }
      }

      protoArrangements.push({
        uuid: { string: arrUuid },
        name: arr.name,
        groupIdentifiers,
      });
    }

    selectedArrangementUuid = (protoArrangements[0]?.uuid as { string: string })?.string;
  } else {
    // Default arrangement matching group appearance
    const defaultArrUuid = randomUUID();
    protoArrangements.push({
      uuid: { string: defaultArrUuid },
      name: 'Default',
      groupIdentifiers: groupDefs.map((g) => ({ string: g.id })),
    });
    selectedArrangementUuid = defaultArrUuid;
  }

  // CCLI metadata
  const ccliObj: Record<string, unknown> = {};
  if (presentation.metadata?.author) {
    ccliObj.author = presentation.metadata.author;
  }
  if (presentation.title) {
    ccliObj.songTitle = presentation.title;
  }
  if (presentation.metadata?.ccli) {
    const num = parseInt(presentation.metadata.ccli, 10);
    if (!Number.isNaN(num) && num > 0) {
      ccliObj.songNumber = num;
    }
  }
  if (presentation.metadata?.copyright) {
    const yearMatch = presentation.metadata.copyright.match(/\b(1[6-9]\d{2}|20\d{2})\b/);
    const year = yearMatch
      ? parseInt(yearMatch[0], 10)
      : parseInt(presentation.metadata.copyright, 10);
    if (!Number.isNaN(year) && year > 0) {
      ccliObj.copyrightYear = year;
    }
  }

  const presentationMsg = {
    name: presentation.title || 'Untitled',
    uuid: { string: presentation.id || randomUUID() },
    background: {
      color: { alpha: 1 },
    },
    cues,
    cueGroups,
    arrangements: protoArrangements,
    selectedArrangement: selectedArrangementUuid
      ? { string: selectedArrangementUuid }
      : undefined,
    ...(presentation.metadata?.notes ? { notes: presentation.metadata.notes } : {}),
    ...(Object.keys(ccliObj).length > 0 ? { ccli: ccliObj } : {}),
  };

  try {
    const PresentationType = getProtoRoot().lookupType('Presentation');
    const message = PresentationType.fromObject(presentationMsg);
    const bytes = PresentationType.encode(message).finish();

    return {
      ok: true,
      bytes,
      warnings,
      value: {
        bytes,
        warnings,
      },
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      ok: false,
      error: new Error(`Failed to encode ProPresenter protobuf: ${error.message}`),
    };
  }
}
