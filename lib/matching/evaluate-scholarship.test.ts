import { describe, expect, it } from 'vitest';
import type { Profile, Rule } from '@/lib/types/profile';
import { evaluateScholarship } from './evaluate-scholarship';

function rule(overrides: Partial<Rule> & Pick<Rule, 'id' | 'field' | 'operator' | 'value'>): Rule {
  return {
    scholarship_id: 's1',
    is_mandatory: true,
    human_label: null,
    ...overrides,
  };
}

describe('evaluateScholarship', () => {
  it('is eligible when all mandatory rules pass', () => {
    const profile: Profile = { education_level: 'college', gwa: 90 };
    const rules: Rule[] = [
      rule({ id: 'r1', field: 'education_level', operator: 'in', value: ['college'] }),
      rule({ id: 'r2', field: 'gwa', operator: 'gte', value: 85 }),
    ];

    const result = evaluateScholarship(profile, rules, 'sch-1');

    expect(result.bucket).toBe('eligible');
    expect(result.failedReasons).toHaveLength(0);
    expect(result.passedReasons).toHaveLength(2);
  });

  it('is near_miss when exactly one mandatory rule fails', () => {
    const profile: Profile = { education_level: 'college', gwa: 80 };
    const rules: Rule[] = [
      rule({ id: 'r1', field: 'education_level', operator: 'in', value: ['college'] }),
      rule({ id: 'r2', field: 'gwa', operator: 'gte', value: 85 }),
    ];

    const result = evaluateScholarship(profile, rules, 'sch-1');

    expect(result.bucket).toBe('near_miss');
    expect(result.failedReasons).toHaveLength(1);
    expect(result.failedReasons[0].ruleId).toBe('r2');
  });

  it('is not_eligible when two or more mandatory rules fail', () => {
    const profile: Profile = { education_level: 'shs', gwa: 80 };
    const rules: Rule[] = [
      rule({ id: 'r1', field: 'education_level', operator: 'in', value: ['college'] }),
      rule({ id: 'r2', field: 'gwa', operator: 'gte', value: 85 }),
    ];

    const result = evaluateScholarship(profile, rules, 'sch-1');

    expect(result.bucket).toBe('not_eligible');
    expect(result.failedReasons).toHaveLength(2);
  });

  it('treats a missing mandatory field as a failed rule, never inferring eligibility', () => {
    const profile: Profile = { education_level: 'college' }; // gwa omitted entirely
    const rules: Rule[] = [
      rule({ id: 'r1', field: 'education_level', operator: 'in', value: ['college'] }),
      rule({ id: 'r2', field: 'gwa', operator: 'gte', value: 85 }),
    ];

    const result = evaluateScholarship(profile, rules, 'sch-1');

    expect(result.bucket).toBe('near_miss');
    expect(result.failedReasons.map((r) => r.ruleId)).toEqual(['r2']);
  });

  it('is still eligible when only a non-mandatory rule fails, and that rule is excluded from reasons', () => {
    const profile: Profile = { education_level: 'college', gwa: 90, is_top_graduate: false };
    const rules: Rule[] = [
      rule({ id: 'r1', field: 'education_level', operator: 'in', value: ['college'] }),
      rule({ id: 'r2', field: 'gwa', operator: 'gte', value: 85 }),
      rule({ id: 'r3', field: 'is_top_graduate', operator: 'is_true', value: true, is_mandatory: false }),
    ];

    const result = evaluateScholarship(profile, rules, 'sch-1');

    expect(result.bucket).toBe('eligible');
    expect(result.passedReasons.map((r) => r.ruleId)).toEqual(['r1', 'r2']);
    expect(result.failedReasons).toHaveLength(0);
  });

  it('is eligible when there are no rules at all (open to everyone)', () => {
    const result = evaluateScholarship({}, [], 'sch-1');

    expect(result.bucket).toBe('eligible');
    expect(result.passedReasons).toHaveLength(0);
    expect(result.failedReasons).toHaveLength(0);
  });
});
