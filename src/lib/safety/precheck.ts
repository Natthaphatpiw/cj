import { env } from "@/lib/config";
import type { SafetyPrecheckResult } from "@/lib/domain/types";

const imminentPatterns = [
  /ไม่อยากอยู่แล้ว/i,
  /ไม่อยากมีชีวิตอยู่/i,
  /ไม่อยากมีชีวิตแล้ว/i,
  /ไม่อยากอยู่ต่อ/i,
  /อยากจบชีวิต/i,
  /ไม่อยากตื่นขึ้นมา/i,
  /ใจนึงก็ไม่อยากมีชีวิตอยู่/i,
  /อยากตาย/i,
  /ฆ่าตัวตาย/i,
  /จะกระโดด/i,
  /ทำร้ายตัวเอง/i,
  /ไม่อยากอยู่บนโลกนี้/i,
  /I want to die/i,
  /I don't want to live/i,
  /kill myself/i
];

const highRiskPatterns = [
  /ไม่มีทางออก/i,
  /อยากหายไป/i,
  /อยากหายไปจากโลกนี้/i,
  /อยู่ไปทำไม/i,
  /ทำร้าย/i,
  /โดนทำร้าย/i,
  /หมดหวัง/i,
  /can't go on/i,
  /self[- ]harm/i
];

const mediumRiskPatterns = [
  /เครียดมาก/i,
  /นอนไม่หลับ/i,
  /แพนิค/i,
  /วิตก/i,
  /เศร้า/i,
  /depressed/i,
  /anxious/i
];

export function runSafetyPrecheck(message: string): SafetyPrecheckResult {
  const normalized = message.trim();
  const reasonCodes: string[] = [];

  if (imminentPatterns.some((pattern) => pattern.test(normalized))) {
    reasonCodes.push("imminent_self_harm_pattern");
    return {
      riskLevel: "imminent",
      confidence: 0.92,
      reasonCodes,
      requiresCrisisProtocol: true,
      requiresHumanHandoff: true
    };
  }

  if (highRiskPatterns.some((pattern) => pattern.test(normalized))) {
    reasonCodes.push("high_risk_distress_pattern");
    return {
      riskLevel: "high",
      confidence: 0.82,
      reasonCodes,
      requiresCrisisProtocol: true,
      requiresHumanHandoff: env.ENABLE_HUMAN_HANDOFF
    };
  }

  if (mediumRiskPatterns.some((pattern) => pattern.test(normalized))) {
    reasonCodes.push("medium_risk_distress_pattern");
    return {
      riskLevel: "medium",
      confidence: 0.71,
      reasonCodes,
      requiresCrisisProtocol: false,
      requiresHumanHandoff: false
    };
  }

  return {
    riskLevel: "low",
    confidence: 0.62,
    reasonCodes: ["no_pattern_match"],
    requiresCrisisProtocol: false,
    requiresHumanHandoff: false
  };
}

export function buildCrisisMessage() {
  return [
    {
      type: "text" as const,
      text: `ตอนนี้ความปลอดภัยของคุณสำคัญที่สุดนะครับ\nถ้าคุณอยู่ในความเสี่ยงทันที กรุณาโทร ${env.CRISIS_EMERGENCY_NUMBER} หรือ ${env.CRISIS_PRIMARY_PHONE} (${env.CRISIS_PRIMARY_LABEL}) ทันที`
    },
    {
      type: "text" as const,
      text: "ถ้าสะดวก ลองบอกผมสั้นๆ ตอนนี้คุณอยู่กับใครหรืออยู่คนเดียว เพื่อที่ผมจะช่วยแนะนำขั้นตอนที่ปลอดภัยที่สุดต่อได้"
    }
  ];
}
