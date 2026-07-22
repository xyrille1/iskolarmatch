import { describe, expect, it } from 'vitest';
import {
  applicationNotesSchema,
  applicationStatusSchema,
  requirementIdSchema,
  APPLICATION_STATUSES,
} from './application-tracker';

describe('applicationStatusSchema', () => {
  it('accepts every DB-enum status', () => {
    for (const status of APPLICATION_STATUSES) {
      expect(applicationStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it('rejects a status outside the DB CHECK enum', () => {
    expect(applicationStatusSchema.safeParse('done').success).toBe(false);
    expect(applicationStatusSchema.safeParse('').success).toBe(false);
  });
});

describe('applicationNotesSchema', () => {
  it('trims surrounding whitespace', () => {
    const result = applicationNotesSchema.safeParse('  hello  ');
    expect(result.success && result.data).toBe('hello');
  });

  it('accepts an empty note (used to clear)', () => {
    expect(applicationNotesSchema.safeParse('').success).toBe(true);
  });

  it('rejects a note over the 1000-char cap', () => {
    expect(applicationNotesSchema.safeParse('x'.repeat(1001)).success).toBe(false);
  });
});

describe('requirementIdSchema', () => {
  it('accepts a uuid', () => {
    expect(requirementIdSchema.safeParse('00000000-0000-0000-0000-000000000000').success).toBe(true);
  });

  it('rejects a non-uuid id', () => {
    expect(requirementIdSchema.safeParse('not-a-uuid').success).toBe(false);
  });
});
