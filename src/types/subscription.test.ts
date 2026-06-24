import { describe, it, expect } from '@jest/globals';
import { tierAtLeast } from './subscription';

describe('tierAtLeast', () => {
  it('returns false for a null tier', () => {
    expect(tierAtLeast(null, 'supporter')).toBe(false);
  });

  it('is true when the tier equals the minimum', () => {
    expect(tierAtLeast('supporter', 'supporter')).toBe(true);
    expect(tierAtLeast('benefactor', 'benefactor')).toBe(true);
  });

  it('is true when the tier outranks the minimum', () => {
    expect(tierAtLeast('patron', 'supporter')).toBe(true);
    expect(tierAtLeast('benefactor', 'patron')).toBe(true);
  });

  it('is false when the tier is below the minimum', () => {
    expect(tierAtLeast('supporter', 'patron')).toBe(false);
    expect(tierAtLeast('patron', 'benefactor')).toBe(false);
  });
});
