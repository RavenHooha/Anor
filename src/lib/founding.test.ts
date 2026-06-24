import { describe, it, expect } from '@jest/globals';
import { isFoundingMember, FOUNDING_MEMBER_CUTOFF } from './founding';

describe('isFoundingMember', () => {
  it('is false for null/undefined/empty input', () => {
    expect(isFoundingMember(null)).toBe(false);
    expect(isFoundingMember(undefined)).toBe(false);
    expect(isFoundingMember('')).toBe(false);
  });

  it('is false for an unparseable date', () => {
    expect(isFoundingMember('not-a-date')).toBe(false);
  });

  it('is true for a join date before the cutoff', () => {
    expect(isFoundingMember('2026-01-01T00:00:00Z')).toBe(true);
  });

  it('is true exactly at the cutoff instant', () => {
    expect(isFoundingMember(FOUNDING_MEMBER_CUTOFF.toISOString())).toBe(true);
  });

  it('is false for a join date after the cutoff', () => {
    expect(isFoundingMember('2027-07-01T00:00:00Z')).toBe(false);
  });
});
