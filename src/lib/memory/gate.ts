import { env } from "@/lib/config";
import type { MemoryWriteDecision, ResponsePlan } from "@/lib/domain/types";

function retentionDaysForSensitivity(sensitivity: "low" | "medium" | "high") {
  if (sensitivity === "high") {
    return Math.min(30, env.USER_MEMORY_RETENTION_DAYS);
  }
  if (sensitivity === "medium") {
    return Math.min(90, env.USER_MEMORY_RETENTION_DAYS);
  }
  return env.USER_MEMORY_RETENTION_DAYS;
}

export function evaluateMemoryWrite(params: {
  plan: ResponsePlan;
  memoryConsent: boolean;
}): MemoryWriteDecision {
  if (!params.memoryConsent) {
    return {
      shouldWrite: false,
      reason: "consent_disabled"
    };
  }

  if (!params.plan.memoryCandidate) {
    return {
      shouldWrite: false,
      reason: "no_memory_candidate"
    };
  }

  const candidate = params.plan.memoryCandidate;
  if (candidate.sensitivity === "high") {
    return {
      shouldWrite: false,
      reason: "high_sensitivity_not_persisted_by_default"
    };
  }

  if (candidate.content.length < 12) {
    return {
      shouldWrite: false,
      reason: "content_too_short"
    };
  }

  return {
    shouldWrite: true,
    memoryType: candidate.type,
    content: candidate.content,
    sensitivity: candidate.sensitivity,
    retentionDays: retentionDaysForSensitivity(candidate.sensitivity),
    reason: "policy_pass"
  };
}
