import { describe, it, expect } from 'vitest';
import { getExportBlockReason, exportBlockMessage } from '../src/lib/exportEligibility';

describe('getExportBlockReason', () => {
  it('prefers no-selection when nothing selected, even with output dir', () => {
    expect(getExportBlockReason(0, '/out')).toBe('no-selection');
  });

  it('reports no-selection when selection and output dir both missing', () => {
    expect(getExportBlockReason(0, '')).toBe('no-selection');
  });

  it('reports no-output-dir when songs selected but no folder picked', () => {
    expect(getExportBlockReason(3, '')).toBe('no-output-dir');
  });

  it('returns null when eligible', () => {
    expect(getExportBlockReason(3, '/out')).toBeNull();
  });
});

describe('exportBlockMessage', () => {
  it('maps reasons to exact copy', () => {
    expect(exportBlockMessage('no-selection')).toBe('Select songs to export');
    expect(exportBlockMessage('no-output-dir')).toBe('Pick an output folder');
    expect(exportBlockMessage(null)).toBeNull();
  });
});
