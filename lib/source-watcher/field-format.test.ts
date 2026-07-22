import { describe, expect, it } from "vitest";
import { isValidFieldFormat } from "./field-format";

// P3-12: field-format feeds confidence scoring (a failed format check is a
// strong "low confidence" signal), so its per-field rules are worth pinning.

describe("isValidFieldFormat", () => {
  it("fails closed for unknown table/field combinations", () => {
    expect(isValidFieldFormat("scholarships", "not_a_field", "x")).toBe(false);
    // @ts-expect-error -- exercising the runtime fail-closed on a bad table.
    expect(isValidFieldFormat("not_a_table", "title", "x")).toBe(false);
  });

  describe("scholarships", () => {
    it("accepts a non-empty title, rejects empty/whitespace", () => {
      expect(isValidFieldFormat("scholarships", "title", "CHED Merit")).toBe(true);
      expect(isValidFieldFormat("scholarships", "title", "   ")).toBe(false);
      expect(isValidFieldFormat("scholarships", "title", 123)).toBe(false);
    });

    it("validates coverage_type against the known set, case-insensitively", () => {
      expect(isValidFieldFormat("scholarships", "coverage_type", "FULL")).toBe(true);
      expect(isValidFieldFormat("scholarships", "coverage_type", "partial")).toBe(true);
      expect(isValidFieldFormat("scholarships", "coverage_type", "scholarship")).toBe(false);
    });

    it("requires https on official_url / application_url", () => {
      expect(isValidFieldFormat("scholarships", "official_url", "https://ched.gov.ph/x")).toBe(true);
      expect(isValidFieldFormat("scholarships", "official_url", "http://ched.gov.ph/x")).toBe(false);
      expect(isValidFieldFormat("scholarships", "application_url", "ftp://x")).toBe(false);
    });
  });

  describe("eligibility_rules", () => {
    it("validates operator against the known set", () => {
      expect(isValidFieldFormat("eligibility_rules", "operator", "gte")).toBe(true);
      expect(isValidFieldFormat("eligibility_rules", "operator", "approximately")).toBe(false);
    });

    it("accepts any non-nullish value, and a boolean is_mandatory", () => {
      expect(isValidFieldFormat("eligibility_rules", "value", 0)).toBe(true);
      expect(isValidFieldFormat("eligibility_rules", "value", null)).toBe(false);
      expect(isValidFieldFormat("eligibility_rules", "is_mandatory", true)).toBe(true);
      expect(isValidFieldFormat("eligibility_rules", "is_mandatory", "true")).toBe(false);
    });
  });

  describe("deadline_cycles", () => {
    it("requires ISO YYYY-MM-DD dates", () => {
      expect(isValidFieldFormat("deadline_cycles", "closes_at", "2026-09-15")).toBe(true);
      expect(isValidFieldFormat("deadline_cycles", "closes_at", "Sept 15, 2026")).toBe(false);
      expect(isValidFieldFormat("deadline_cycles", "opens_at", "2026-9-5")).toBe(false);
    });
  });

  describe("requirements", () => {
    it("accepts a number-like sort_order (number or numeric string)", () => {
      expect(isValidFieldFormat("requirements", "sort_order", 3)).toBe(true);
      expect(isValidFieldFormat("requirements", "sort_order", "3")).toBe(true);
      expect(isValidFieldFormat("requirements", "sort_order", "three")).toBe(false);
    });
  });
});
