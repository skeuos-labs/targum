import type { Warning } from './warnings.js';

export type { Warning };

export type SourceFormat =
  | 'pro'
  | 'pro6'
  | 'vpc'
  | 'json'
  | 'freeshow'
  | 'txt'
  | 'pptx'
  | 'unknown';

export interface Metadata {
  author?: string;
  copyright?: string;
  ccli?: string;
  notes?: string;
  language?: string;
  originalFileName?: string;
  songId?: string;
  themeName?: string;
}

export interface Section {
  id: string;
  name: string;
  color?: string;
  slideIds: string[];
}

export interface Arrangement {
  id: string;
  name: string;
  slideIds: string[];
}

export interface Slide {
  id: string;
  label?: string;
  items: TextItem[];
}

export interface TextItem {
  type: 'text';
  plainText: string;
  richText?: RichTextRun[];
  style?: Record<string, string>;
}

export interface RichTextRun {
  text: string;
  style?: Record<string, string>;
}

export interface Presentation {
  id: string;
  title: string;
  sourceFormat: SourceFormat;
  metadata: Metadata;
  sections: Section[];
  arrangements: Arrangement[];
  slides: Slide[];
  warnings: Warning[];
  retained?: Record<string, unknown>;
}

export interface Library {
  presentations: Presentation[];
}
