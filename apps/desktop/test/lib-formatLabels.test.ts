import { describe, it, expect } from 'vitest';
import { formatSourceFormatLabel } from '../src/lib/formatLabels';

describe('formatSourceFormatLabel', () => {
  it('maps known formats', () => {
    expect(formatSourceFormatLabel('pro')).toBe('ProPresenter 7 (.pro)');
    expect(formatSourceFormatLabel('vpc')).toBe('VideoPsalm (.vpc)');
    expect(formatSourceFormatLabel('freeshow')).toBe('FreeShow (.show)');
  });

  it('uppercases unknown formats', () => {
    expect(formatSourceFormatLabel('xyz')).toBe('XYZ');
  });
});
