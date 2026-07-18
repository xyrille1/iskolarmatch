import { describe, expect, it } from 'vitest';
import { applyOperator } from './apply-operator';

describe('applyOperator', () => {
  describe('gte', () => {
    it('passes when profile value is greater than rule value', () => {
      expect(applyOperator(90, 'gte', 85)).toBe(true);
    });
    it('passes at the exact boundary', () => {
      expect(applyOperator(85, 'gte', 85)).toBe(true);
    });
    it('fails when profile value is less than rule value', () => {
      expect(applyOperator(80, 'gte', 85)).toBe(false);
    });
    it('fails closed on non-numeric profile value', () => {
      expect(applyOperator('not a number', 'gte', 85)).toBe(false);
    });
    it('fails closed on undefined profile value', () => {
      expect(applyOperator(undefined, 'gte', 85)).toBe(false);
    });
  });

  describe('lte', () => {
    it('passes when profile value is less than rule value', () => {
      expect(applyOperator(2, 'lte', 3)).toBe(true);
    });
    it('passes at the exact boundary', () => {
      expect(applyOperator(3, 'lte', 3)).toBe(true);
    });
    it('fails when profile value is greater than rule value', () => {
      expect(applyOperator(4, 'lte', 3)).toBe(false);
    });
    it('fails closed on non-numeric profile value', () => {
      expect(applyOperator('nope', 'lte', 3)).toBe(false);
    });
  });

  describe('eq', () => {
    it('passes on exact match', () => {
      expect(applyOperator('college', 'eq', 'college')).toBe(true);
    });
    it('fails on mismatch', () => {
      expect(applyOperator('shs', 'eq', 'college')).toBe(false);
    });
  });

  describe('neq', () => {
    it('passes when values differ', () => {
      expect(applyOperator('shs', 'neq', 'college')).toBe(true);
    });
    it('fails when values match', () => {
      expect(applyOperator('college', 'neq', 'college')).toBe(false);
    });
  });

  describe('in', () => {
    it('passes when profile value is in the rule array', () => {
      expect(applyOperator('low', 'in', ['low', 'mid'])).toBe(true);
    });
    it('fails when profile value is not in the rule array', () => {
      expect(applyOperator('high', 'in', ['low', 'mid'])).toBe(false);
    });
    it('fails closed when rule value is not an array', () => {
      expect(applyOperator('low', 'in', 'low')).toBe(false);
    });
  });

  describe('includes', () => {
    it('passes when profile array includes the rule value', () => {
      expect(applyOperator(['stem', 'arts'], 'includes', 'stem')).toBe(true);
    });
    it('fails when profile array does not include the rule value', () => {
      expect(applyOperator(['arts'], 'includes', 'stem')).toBe(false);
    });
    it('fails closed when profile value is not an array', () => {
      expect(applyOperator('stem', 'includes', 'stem')).toBe(false);
    });
  });

  describe('is_true', () => {
    it('passes when profile value is exactly true', () => {
      expect(applyOperator(true, 'is_true', true)).toBe(true);
    });
    it('fails on false', () => {
      expect(applyOperator(false, 'is_true', true)).toBe(false);
    });
    it('fails closed on a truthy non-boolean', () => {
      expect(applyOperator(1, 'is_true', true)).toBe(false);
    });
  });

  describe('is_false', () => {
    it('passes when profile value is exactly false', () => {
      expect(applyOperator(false, 'is_false', false)).toBe(true);
    });
    it('fails on true', () => {
      expect(applyOperator(true, 'is_false', false)).toBe(false);
    });
    it('fails closed on undefined', () => {
      expect(applyOperator(undefined, 'is_false', false)).toBe(false);
    });
  });
});
