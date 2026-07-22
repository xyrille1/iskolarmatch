import { describe, expect, it } from 'vitest';
import { countRequirementProgress, APPLICATION_STATUS_LABELS } from './progress';
import { APPLICATION_STATUSES } from '@/lib/types/application-tracker';

describe('countRequirementProgress', () => {
  it('counts checked ids that belong to the requirement set', () => {
    const result = countRequirementProgress(['a', 'b', 'c'], new Set(['a', 'c']));
    expect(result).toEqual({ total: 3, done: 2 });
  });

  it('ignores checked ids not in the requirement set (never exceeds total)', () => {
    const result = countRequirementProgress(['a', 'b'], new Set(['a', 'x', 'y']));
    expect(result).toEqual({ total: 2, done: 1 });
  });

  it('returns zero total for a scholarship with no requirements', () => {
    expect(countRequirementProgress([], new Set(['a']))).toEqual({ total: 0, done: 0 });
  });

  it('returns done 0 when nothing is checked', () => {
    expect(countRequirementProgress(['a', 'b'], new Set())).toEqual({ total: 2, done: 0 });
  });
});

describe('APPLICATION_STATUS_LABELS', () => {
  it('has a label for every DB-enum status', () => {
    for (const status of APPLICATION_STATUSES) {
      expect(APPLICATION_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});
