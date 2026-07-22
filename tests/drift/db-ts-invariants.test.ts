import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PROFILE_FIELDS } from "@/lib/types/profile";
import { ALLOWED_FIELDS_BY_TABLE, TARGET_TABLES } from "@/lib/types/source-watcher";

// Two invariant pairs in this codebase are "kept in sync manually" per their
// own comments, with no automated check that they actually stay in sync
// (docs/QA-CHECKLIST.md P2-10):
//
//   1. lib/types/profile.ts PROFILE_FIELDS
//        <-> eligibility_rules_field_check CHECK constraint
//   2. lib/types/source-watcher.ts ALLOWED_FIELDS_BY_TABLE
//        <-> scholarship_suggestions_field_allowlist CHECK constraint
//
// This test parses the actual CHECK constraint text out of the checked-in
// migration SQL and asserts it matches the TS source of truth, so changing
// one side without the other fails a test instead of drifting silently.

const MIGRATIONS_DIR = path.resolve(__dirname, "../../supabase/migrations");

function readMigration(filename: string): string {
  return readFileSync(path.join(MIGRATIONS_DIR, filename), "utf-8");
}

// Splits a SQL `'a', 'b', 'c'` fragment into a sorted string array.
function parseQuotedList(fragment: string): string[] {
  const matches = [...fragment.matchAll(/'([^']*)'/g)].map((m) => m[1]);
  return matches.sort();
}

describe("DB <-> TS invariant drift (docs/QA-CHECKLIST.md P2-10)", () => {
  it("eligibility_rules_field_check matches lib/types/profile.ts PROFILE_FIELDS", () => {
    const sql = readMigration("20260101000001_init_core_schema.sql");

    const match = sql.match(/constraint eligibility_rules_field_check\s*check \(field in \(([\s\S]*?)\)\)/);
    expect(match, "eligibility_rules_field_check constraint not found in migration -- did it move or get renamed?").not.toBeNull();

    const dbFields = parseQuotedList(match![1]);
    const tsFields = [...PROFILE_FIELDS].sort();

    expect(dbFields).toEqual(tsFields);
  });

  it("scholarship_suggestions_field_allowlist matches lib/types/source-watcher.ts ALLOWED_FIELDS_BY_TABLE", () => {
    const sql = readMigration("20260101000012_source_watcher.sql");

    const constraintMatch = sql.match(
      /constraint scholarship_suggestions_field_allowlist check \(([\s\S]*?)\n {2}\)/
    );
    expect(
      constraintMatch,
      "scholarship_suggestions_field_allowlist constraint not found in migration -- did it move or get renamed?"
    ).not.toBeNull();
    const constraintBody = constraintMatch![1];

    const dbAllowedByTable: Record<string, string[]> = {};
    for (const tableMatch of constraintBody.matchAll(/target_table = '(\w+)' and target_field in \(([^)]*)\)/g)) {
      const [, table, fieldsFragment] = tableMatch;
      dbAllowedByTable[table] = parseQuotedList(fieldsFragment);
    }

    // Every TS-declared target table must appear in the DB constraint, and the
    // field lists must match exactly, in both directions.
    expect(Object.keys(dbAllowedByTable).sort()).toEqual([...TARGET_TABLES].sort());

    for (const table of TARGET_TABLES) {
      const tsFields = [...ALLOWED_FIELDS_BY_TABLE[table]].sort();
      expect(dbAllowedByTable[table], `no DB allowlist clause found for target_table = '${table}'`).toEqual(tsFields);
    }
  });
});
