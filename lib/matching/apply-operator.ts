import type { Operator } from '@/lib/types/profile';

// Fails closed: any type mismatch or unsupported comparison returns false,
// never throws. "Never infer eligibility on unknown data."
export function applyOperator(profileValue: unknown, operator: Operator, ruleValue: unknown): boolean {
  switch (operator) {
    case 'gte':
      return typeof profileValue === 'number' && typeof ruleValue === 'number'
        ? profileValue >= ruleValue
        : false;
    case 'lte':
      return typeof profileValue === 'number' && typeof ruleValue === 'number'
        ? profileValue <= ruleValue
        : false;
    case 'eq':
      return profileValue === ruleValue;
    case 'neq':
      return profileValue !== ruleValue;
    case 'in':
      return Array.isArray(ruleValue) ? ruleValue.includes(profileValue) : false;
    case 'includes':
      return Array.isArray(profileValue) ? profileValue.includes(ruleValue) : false;
    case 'is_true':
      return profileValue === true;
    case 'is_false':
      return profileValue === false;
    default: {
      const exhaustiveCheck: never = operator;
      return exhaustiveCheck;
    }
  }
}
