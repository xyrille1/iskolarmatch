import { isCriticalField, type ConfidenceLevel, type SuggestionProposal } from "@/lib/types/source-watcher";
import { isValidFieldFormat } from "./field-format";

// Deterministic, rule-based confidence scoring (docs plan §4 / draft §5.5).
// Not model-judged, so it is explainable and unit-testable exactly like
// lib/matching/*. Since approval is per-field, this score's job is queue
// PRIORITISATION (surface the riskiest suggestions first), not gating.
//
// Rubric per suggestion:
//   low    - format fails validation, OR a critical field with any ambiguity
//            (multiple citing sections), OR a critical field with no citation.
//   medium - a critical field change that passes format and cites exactly one
//            section, OR a non-critical field with multiple citing sections.
//   high   - a non-critical field, format valid, single unambiguous citation.

export interface ConfidenceResult {
  level: ConfidenceLevel;
  detail: {
    formatValid: boolean;
    critical: boolean;
    citationCount: number;
  };
}

export function scoreConfidence(proposal: SuggestionProposal): ConfidenceResult {
  const formatValid = isValidFieldFormat(proposal.targetTable, proposal.targetField, proposal.newValue);
  const critical = isCriticalField(proposal.targetTable, proposal.targetField);
  const citationCount = proposal.citingSectionIds.length;
  const ambiguous = citationCount !== 1; // 0 = ungrounded, >1 = conflicting/overlapping

  const detail = { formatValid, critical, citationCount };

  if (!formatValid) return { level: "low", detail };

  if (critical) {
    // Critical fields never score high: at best medium, and only when cleanly
    // grounded by a single section.
    return { level: ambiguous ? "low" : "medium", detail };
  }

  // Non-critical field, valid format.
  return { level: ambiguous ? "medium" : "high", detail };
}

// Numeric rank for sorting a queue worst-first (low before high).
export function confidenceRank(level: ConfidenceLevel): number {
  return level === "low" ? 0 : level === "medium" ? 1 : 2;
}
