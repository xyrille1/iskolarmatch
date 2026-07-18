import { describe, expect, it } from 'vitest';
import { profileFieldSchema, profileSchema, ruleSchema } from './profile';

describe('profileFieldSchema', () => {
  it('accepts a known ProfileField', () => {
    expect(profileFieldSchema.safeParse('gwa').success).toBe(true);
  });

  it('rejects a field not in ProfileField', () => {
    expect(profileFieldSchema.safeParse('favorite_color').success).toBe(false);
  });
});

describe('profileSchema', () => {
  it('accepts a partial profile with only some fields set', () => {
    const result = profileSchema.safeParse({ education_level: 'college', gwa: 90 });
    expect(result.success).toBe(true);
  });

  it('accepts an empty profile', () => {
    expect(profileSchema.safeParse({}).success).toBe(true);
  });

  it('rejects unknown keys (.strict())', () => {
    const result = profileSchema.safeParse({ gwa: 90, not_a_real_field: true });
    expect(result.success).toBe(false);
  });
});

describe('ruleSchema', () => {
  const validRule = {
    id: 'r1',
    scholarship_id: 's1',
    field: 'gwa',
    operator: 'gte',
    value: 85,
    is_mandatory: true,
    human_label: 'GWA at least 85',
  };

  it('accepts a well-formed rule', () => {
    expect(ruleSchema.safeParse(validRule).success).toBe(true);
  });

  it('rejects a rule whose field is not a valid ProfileField', () => {
    const result = ruleSchema.safeParse({ ...validRule, field: 'favorite_color' });
    expect(result.success).toBe(false);
  });

  it('rejects a rule whose operator is not a valid Operator', () => {
    const result = ruleSchema.safeParse({ ...validRule, operator: 'starts_with' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys (.strict())', () => {
    const result = ruleSchema.safeParse({ ...validRule, extra: 'nope' });
    expect(result.success).toBe(false);
  });
});
