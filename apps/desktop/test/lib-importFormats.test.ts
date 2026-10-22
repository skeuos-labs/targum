import { describe, it, expect } from 'vitest';
import { IMPORT_HEADLINE, IMPORT_FORMATS_LINE } from '../src/lib/importFormats';

describe('importFormats constants', () => {
  it('IMPORT_HEADLINE matches exact copy', () => {
    expect(IMPORT_HEADLINE).toBe('Drop songs to convert');
  });

  it('IMPORT_FORMATS_LINE matches Global Constraints line verbatim', () => {
    expect(IMPORT_FORMATS_LINE).toBe(
      'ProPresenter .pro/.pro6 · VideoPsalm .vpc/.json · FreeShow .show · Plain Text .txt · PowerPoint .pptx'
    );
  });
});
