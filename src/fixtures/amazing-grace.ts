import {
  parsePresentation,
  type Presentation,
} from '../canonical/index.js';

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

function buildAmazingGracePresentation(): Presentation {
  const raw = {
    id: 'presentation-amazing-grace',
    title: 'Amazing Grace',
    sourceFormat: 'unknown' as const,
    metadata: {
      author: 'John Newton',
      copyright: 'Public Domain',
      ccli: '22025',
      language: 'en',
      notes: 'Public domain hymn written in 1779 by John Newton.',
    },
    sections: [
      {
        id: 'sec-v1',
        name: 'Verse 1',
        slideIds: ['ag-slide-v1-1', 'ag-slide-v1-2'],
      },
      {
        id: 'sec-v2',
        name: 'Verse 2',
        slideIds: ['ag-slide-v2-1', 'ag-slide-v2-2'],
      },
      {
        id: 'sec-c',
        name: 'Chorus',
        slideIds: ['ag-slide-c-1'],
      },
      {
        id: 'sec-v3',
        name: 'Verse 3',
        slideIds: ['ag-slide-v3-1', 'ag-slide-v3-2'],
      },
      {
        id: 'sec-v4',
        name: 'Verse 4',
        slideIds: ['ag-slide-v4-1', 'ag-slide-v4-2'],
      },
    ],
    arrangements: [
      {
        id: 'arr-standard',
        name: 'Standard',
        slideIds: [
          'ag-slide-v1-1',
          'ag-slide-v1-2',
          'ag-slide-c-1',
          'ag-slide-v2-1',
          'ag-slide-v2-2',
          'ag-slide-c-1',
          'ag-slide-v3-1',
          'ag-slide-v3-2',
          'ag-slide-c-1',
          'ag-slide-v4-1',
          'ag-slide-v4-2',
          'ag-slide-c-1',
        ],
      },
      {
        id: 'arr-full',
        name: 'Full',
        slideIds: [
          'ag-slide-v1-1',
          'ag-slide-v1-2',
          'ag-slide-c-1',
          'ag-slide-v2-1',
          'ag-slide-v2-2',
          'ag-slide-c-1',
          'ag-slide-v3-1',
          'ag-slide-v3-2',
          'ag-slide-c-1',
          'ag-slide-v4-1',
          'ag-slide-v4-2',
          'ag-slide-c-1',
        ],
      },
      {
        id: 'arr-short',
        name: 'Short',
        slideIds: [
          'ag-slide-v1-1',
          'ag-slide-v1-2',
          'ag-slide-v4-1',
          'ag-slide-v4-2',
        ],
      },
    ],
    slides: [
      {
        id: 'ag-slide-v1-1',
        label: 'Verse 1 - Part 1',
        items: [
          {
            type: 'text' as const,
            plainText: 'Amazing grace! How sweet the sound\nThat saved a wretch like me!',
          },
        ],
      },
      {
        id: 'ag-slide-v1-2',
        label: 'Verse 1 - Part 2',
        items: [
          {
            type: 'text' as const,
            plainText: 'I once was lost, but now am found;\nWas blind, but now I see.',
          },
        ],
      },
      {
        id: 'ag-slide-v2-1',
        label: 'Verse 2 - Part 1',
        items: [
          {
            type: 'text' as const,
            plainText: "'Twas grace that taught my heart to fear,\nAnd grace my fears relieved;",
          },
        ],
      },
      {
        id: 'ag-slide-v2-2',
        label: 'Verse 2 - Part 2',
        items: [
          {
            type: 'text' as const,
            plainText: 'How precious did that grace appear\nThe hour I first believed.',
          },
        ],
      },
      {
        id: 'ag-slide-c-1',
        label: 'Chorus',
        items: [
          {
            type: 'text' as const,
            plainText:
              'Praise God, praise God, His love endures;\nForevermore His grace secures.',
          },
        ],
      },
      {
        id: 'ag-slide-v3-1',
        label: 'Verse 3 - Part 1',
        items: [
          {
            type: 'text' as const,
            plainText: 'Through many dangers, toils, and snares,\nI have already come;',
          },
        ],
      },
      {
        id: 'ag-slide-v3-2',
        label: 'Verse 3 - Part 2',
        items: [
          {
            type: 'text' as const,
            plainText: "'Tis grace hath brought me safe thus far,\nAnd grace will lead me home.",
          },
        ],
      },
      {
        id: 'ag-slide-v4-1',
        label: 'Verse 4 - Part 1',
        items: [
          {
            type: 'text' as const,
            plainText: "When we've been there ten thousand years,\nBright shining as the sun,",
          },
        ],
      },
      {
        id: 'ag-slide-v4-2',
        label: 'Verse 4 - Part 2',
        items: [
          {
            type: 'text' as const,
            plainText: "We've no less days to sing God's praise\nThan when we'd first begun.",
          },
        ],
      },
    ],
    warnings: [],
  };

  const parsed = parsePresentation(raw);
  if (!parsed.ok) {
    throw new Error(
      `Failed to construct Amazing Grace baseline fixture: ${parsed.error.message}`,
    );
  }

  return parsed.value;
}

export function createAmazingGracePresentation(): Presentation {
  return buildAmazingGracePresentation();
}

export const AMAZING_GRACE: Presentation = deepFreeze(
  createAmazingGracePresentation(),
);
