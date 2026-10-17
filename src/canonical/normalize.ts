import { type ZodError } from 'zod';
import { PresentationSchema } from './schema.js';
import type { Presentation, RichTextRun, Warning } from './types.js';
import { warning } from './warnings.js';

export function richTextToPlain(runs?: RichTextRun[]): string {
  if (!runs || runs.length === 0) {
    return '';
  }
  return runs.map((r) => r.text).join('');
}

export function withDerivedPlainText(presentation: Presentation): Presentation {
  return {
    ...presentation,
    slides: presentation.slides.map((slide) => ({
      ...slide,
      items: slide.items.map((item) => {
        if (item.richText !== undefined && item.richText.length > 0) {
          return {
            ...item,
            plainText: richTextToPlain(item.richText),
          };
        }
        return item;
      }),
    })),
  };
}

export function validateReferences(presentation: Presentation): Warning[] {
  const knownSlideIds = new Set(presentation.slides.map((s) => s.id));
  const warnings: Warning[] = [];

  for (const section of presentation.sections) {
    for (const slideId of section.slideIds) {
      if (!knownSlideIds.has(slideId)) {
        warnings.push(
          warning(
            'SECTION_DANGLING_SLIDE',
            'warn',
            `Section "${section.name}" (${section.id}) references missing slide "${slideId}"`,
            {
              sectionId: section.id,
              sectionName: section.name,
              slideId,
            },
          ),
        );
      }
    }
  }

  for (const arrangement of presentation.arrangements) {
    for (const slideId of arrangement.slideIds) {
      if (!knownSlideIds.has(slideId)) {
        warnings.push(
          warning(
            'ARRANGEMENT_DANGLING_SLIDE',
            'warn',
            `Arrangement "${arrangement.name}" (${arrangement.id}) references missing slide "${slideId}"`,
            {
              arrangementId: arrangement.id,
              arrangementName: arrangement.name,
              slideId,
            },
          ),
        );
      }
    }
  }

  return warnings;
}

export function pruneDanglingReferences(
  presentation: Presentation,
): Presentation {
  const knownSlideIds = new Set(presentation.slides.map((s) => s.id));

  return {
    ...presentation,
    sections: presentation.sections.map((section) => ({
      ...section,
      slideIds: section.slideIds.filter((id) => knownSlideIds.has(id)),
    })),
    arrangements: presentation.arrangements.map((arrangement) => ({
      ...arrangement,
      slideIds: arrangement.slideIds.filter((id) => knownSlideIds.has(id)),
    })),
  };
}

export type ParsePresentationResult =
  | { ok: true; value: Presentation; warnings: Warning[] }
  | { ok: false; error: ZodError };

export function parsePresentation(data: unknown): ParsePresentationResult {
  const parsed = PresentationSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error };
  }

  const derived = withDerivedPlainText(parsed.data);
  const refWarnings = validateReferences(derived);
  const allWarnings = [...derived.warnings, ...refWarnings];

  const value: Presentation = {
    ...derived,
    warnings: allWarnings,
  };

  return {
    ok: true,
    value,
    warnings: allWarnings,
  };
}
