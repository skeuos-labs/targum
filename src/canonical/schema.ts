import { z } from 'zod';
import { WarningSchema } from './warnings.js';

export const SourceFormatSchema = z.enum([
  'pro',
  'pro6',
  'vpc',
  'json',
  'freeshow',
  'txt',
  'pptx',
  'unknown',
]);

export const MetadataSchema = z.object({
  author: z.string().optional(),
  copyright: z.string().optional(),
  ccli: z.string().optional(),
  notes: z.string().optional(),
  language: z.string().optional(),
  originalFileName: z.string().optional(),
  songId: z.string().optional(),
  themeName: z.string().optional(),
});

export const RichTextRunSchema = z.object({
  text: z.string(),
  style: z.record(z.string(), z.string()).optional(),
});

export const TextItemSchema = z.object({
  type: z.literal('text'),
  plainText: z.string(),
  richText: z.array(RichTextRunSchema).optional(),
  style: z.record(z.string(), z.string()).optional(),
});

export const SlideSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  items: z.array(TextItemSchema),
});

export const SectionSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  color: z.string().optional(),
  slideIds: z.array(z.string()),
});

export const ArrangementSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  slideIds: z.array(z.string()),
});

export const PresentationSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  sourceFormat: SourceFormatSchema,
  metadata: MetadataSchema.default({}),
  sections: z.array(SectionSchema).default([]),
  arrangements: z.array(ArrangementSchema).default([]),
  slides: z.array(SlideSchema).default([]),
  warnings: z.array(WarningSchema).default([]),
  retained: z.record(z.string(), z.unknown()).optional(),
});

export const LibrarySchema = z.object({
  presentations: z.array(PresentationSchema),
});
