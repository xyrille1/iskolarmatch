import type { Profile, Rule } from '@/lib/types/profile';
import type { MatchResult, RuleResult } from '@/lib/types/matching';
import { applyOperator } from './apply-operator';

export function evaluateScholarship(profile: Profile, rules: Rule[], scholarshipId: string): MatchResult {
  const passedReasons: RuleResult[] = [];
  const failedReasons: RuleResult[] = [];
  let mandatoryFailCount = 0;

  for (const rule of rules) {
    const profileValue = (profile as Record<string, unknown>)[rule.field];
    // Missing field is treated as a failed rule -- never infer eligibility on
    // unknown data, even if the operator would otherwise be satisfiable.
    const passed = profileValue !== undefined && applyOperator(profileValue, rule.operator, rule.value);

    if (!rule.is_mandatory) {
      // Non-mandatory rules never appear in passedReasons/failedReasons and
      // never affect the bucket.
      continue;
    }

    const ruleResult: RuleResult = {
      ruleId: rule.id,
      humanLabel: rule.human_label ?? null,
      guidanceText: rule.guidance_text ?? null,
      passed,
    };

    if (passed) {
      passedReasons.push(ruleResult);
    } else {
      failedReasons.push(ruleResult);
      mandatoryFailCount += 1;
    }
  }

  const bucket = mandatoryFailCount === 0 ? 'eligible' : mandatoryFailCount === 1 ? 'near_miss' : 'not_eligible';

  return {
    scholarshipId,
    bucket,
    passedReasons,
    failedReasons,
  };
}
