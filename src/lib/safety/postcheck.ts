import type { ResponsePlan, RiskLevel } from "@/lib/domain/types";

const forbiddenPatterns = [
  /ฉันเป็นแพทย์/i,
  /I am your therapist/i,
  /รับประกันความลับ 100%/i,
  /ไม่มีทางที่คุณจะเป็นอะไร/i,
  /ทำตามนี้แล้วจะหายแน่นอน/i
];

function sanitizeText(text: string) {
  let sanitized = text.trim();
  if (sanitized.length === 0) {
    sanitized = "ขอบคุณที่แชร์นะ ผมอยู่ตรงนี้เพื่อช่วยคุณค่อยๆ ไปทีละขั้นครับ";
  }

  sanitized = sanitized.replaceAll("I am your therapist", "I am a support assistant");
  sanitized = sanitized.replaceAll("ฉันเป็นนักบำบัดของคุณ", "ผมเป็นผู้ช่วยด้านการดูแลใจเบื้องต้น");
  return sanitized;
}

export function runSafetyPostcheck(plan: ResponsePlan, preRiskLevel: RiskLevel) {
  const violated = forbiddenPatterns.some((pattern) => pattern.test(plan.messageDraft));
  const shouldForceCrisisMode = preRiskLevel === "high" || preRiskLevel === "imminent";

  const patched: ResponsePlan = {
    ...plan,
    mode: shouldForceCrisisMode ? "crisis_mode" : plan.mode,
    riskLevel: shouldForceCrisisMode ? preRiskLevel : plan.riskLevel,
    messageDraft: sanitizeText(plan.messageDraft)
  };

  if (violated) {
    patched.messageDraft =
      "ผมขอเน้นว่าเราเป็นบริการสนับสนุนใจเบื้องต้น ไม่ใช่การวินิจฉัยทางการแพทย์นะครับ ถ้าตอนนี้เสี่ยงอันตราย กรุณาติดต่อสายด่วนทันที";
    patched.mode = "crisis_mode";
  }

  return {
    violated,
    plan: patched
  };
}
