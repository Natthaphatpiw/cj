export type StructuredModuleKey =
  | "breathing_3m"
  | "grounding_54321"
  | "thought_reframing"
  | "sleep_stress_checkin"
  | "mini_journaling";

export type StructuredModuleMatch = {
  key: StructuredModuleKey;
  confidence: number;
};

const modulePatterns: Array<{ key: StructuredModuleKey; patterns: RegExp[] }> = [
  {
    key: "breathing_3m",
    patterns: [/แบบฝึกหายใจ\s*3\s*นาที/i, /หายใจ\s*3\s*นาที/i, /\bbreath(ing)?\b/i]
  },
  {
    key: "grounding_54321",
    patterns: [/grounding/i, /5-4-3-2-1/i, /ดึงสติ/i, /กลับมาอยู่กับปัจจุบัน/i]
  },
  {
    key: "thought_reframing",
    patterns: [/reframing/i, /ปรับมุมมอง/i, /รีเฟรม/i, /จัดความคิด/i]
  },
  {
    key: "sleep_stress_checkin",
    patterns: [/sleep\s*check/i, /stress\s*check/i, /เช็กการนอน/i, /เช็กความเครียด/i]
  },
  {
    key: "mini_journaling",
    patterns: [/journaling/i, /บันทึกใจ/i, /เขียนระบาย/i, /เขียนความรู้สึก/i]
  }
];

function scoreModuleIntent(text: string, key: StructuredModuleKey) {
  const rule = modulePatterns.find((item) => item.key === key);
  if (!rule) {
    return 0;
  }

  return rule.patterns.some((pattern) => pattern.test(text)) ? 0.9 : 0;
}

export function detectStructuredModuleIntent(message: string): StructuredModuleMatch | null {
  const normalized = message.trim();
  if (!normalized) {
    return null;
  }

  const looksLikeLongDisclosure = normalized.length > 120;
  if (looksLikeLongDisclosure) {
    return null;
  }

  let best: StructuredModuleMatch | null = null;
  for (const rule of modulePatterns) {
    const confidence = scoreModuleIntent(normalized, rule.key);
    if (confidence <= 0) {
      continue;
    }
    if (!best || confidence > best.confidence) {
      best = { key: rule.key, confidence };
    }
  }

  return best;
}

export function buildStructuredModuleReply(params: { moduleKey: StructuredModuleKey; locale: string }) {
  const isThai = params.locale !== "en";

  if (!isThai) {
    switch (params.moduleKey) {
      case "breathing_3m":
        return (
          "Let us do a 3-minute breathing reset together.\n\n" +
          "1. 60s: Inhale 4 counts, exhale 6 counts.\n" +
          "2. 60s: Relax shoulders and jaw, keep slow breathing.\n" +
          "3. 60s: Ask yourself, what matters most in the next 1 hour?\n\n" +
          "After this, do you want to continue with grounding or a thought reset?"
        );
      case "grounding_54321":
        return (
          "Grounding 5-4-3-2-1 now.\n\n" +
          "Name 5 things you can see.\n" +
          "Name 4 things you can feel.\n" +
          "Name 3 things you can hear.\n" +
          "Name 2 things you can smell.\n" +
          "Name 1 thing you can taste or one calming word.\n\n" +
          "Send me what you found, and I will help you settle further."
        );
      case "thought_reframing":
        return (
          "Quick thought reframing.\n\n" +
          "1. Trigger thought: what is the sentence repeating in your mind?\n" +
          "2. Evidence check: what facts support it, and what facts do not?\n" +
          "3. Balanced thought: rewrite it into one kinder, more realistic line.\n\n" +
          "Type your trigger thought and I will help you rewrite it."
        );
      case "sleep_stress_checkin":
        return (
          "Sleep and stress check-in.\n\n" +
          "Rate sleep quality (0-10), stress level (0-10), and body tension (0-10).\n" +
          "Then tell me the one strongest trigger today.\n\n" +
          "I can help you choose one small step for tonight."
        );
      case "mini_journaling":
        return (
          "Mini journaling in under 2 minutes.\n\n" +
          "1. Today I feel...\n" +
          "2. The hardest part is...\n" +
          "3. What I need most right now is...\n" +
          "4. One small action I can do in 10 minutes is...\n\n" +
          "Send your draft, and I can help you make it clearer."
        );
      default:
        return "I am here with you. Tell me how you feel right now.";
    }
  }

  switch (params.moduleKey) {
    case "breathing_3m":
      return (
        "มาลองแบบฝึกหายใจ 3 นาทีด้วยกันนะครับ\n\n" +
        "1. นาทีที่ 1 หายใจเข้า 4 จังหวะ ออก 6 จังหวะ\n" +
        "2. นาทีที่ 2 คลายไหล่และกราม พร้อมหายใจช้า ๆ ต่อ\n" +
        "3. นาทีที่ 3 ถามตัวเองว่า ใน 1 ชั่วโมงข้างหน้า อะไรสำคัญที่สุด\n\n" +
        "ครบแล้วอยากต่อด้วย grounding หรือจัดความคิดต่อดีครับ"
      );
    case "grounding_54321":
      return (
        "ลอง grounding แบบ 5-4-3-2-1 ตอนนี้เลยครับ\n\n" +
        "5 อย่างที่มองเห็น\n" +
        "4 อย่างที่สัมผัสได้\n" +
        "3 เสียงที่ได้ยิน\n" +
        "2 กลิ่นที่รับรู้ได้\n" +
        "1 รสชาติหรือ 1 คำที่ทำให้ใจนิ่ง\n\n" +
        "พิมพ์สิ่งที่เจอมาได้เลย เดี๋ยวผมช่วยต่อให้ใจนิ่งขึ้นอีกขั้น"
      );
    case "thought_reframing":
      return (
        "มาจัดความคิดแบบ reframing สั้น ๆ กันครับ\n\n" +
        "1. ประโยคความคิดที่วนอยู่ในหัวคืออะไร\n" +
        "2. หลักฐานที่สนับสนุน และหลักฐานที่ไม่สนับสนุนมีอะไร\n" +
        "3. เขียนประโยคใหม่ที่เมตตาตัวเองขึ้นและตรงความจริงมากขึ้น\n\n" +
        "พิมพ์ประโยคที่วนอยู่มาได้เลย เดี๋ยวผมช่วย rewrite ให้"
      );
    case "sleep_stress_checkin":
      return (
        "เช็กการนอนและความเครียดแบบเร็วกันครับ\n\n" +
        "ให้คะแนน การนอน 0-10, ความเครียด 0-10, ความตึงในร่างกาย 0-10\n" +
        "แล้วบอกทริกเกอร์หลัก 1 เรื่องที่หนักที่สุดวันนี้\n\n" +
        "จากนั้นผมจะช่วยเลือก 1 action ที่ทำได้คืนนี้ทันที"
      );
    case "mini_journaling":
      return (
        "มาทำ mini journaling ไม่เกิน 2 นาทีครับ\n\n" +
        "1) ตอนนี้ฉันรู้สึก...\n" +
        "2) สิ่งที่หนักที่สุดคือ...\n" +
        "3) สิ่งที่ฉันต้องการที่สุดตอนนี้คือ...\n" +
        "4) ก้าวเล็ก ๆ ใน 10 นาทีที่ทำได้คือ...\n\n" +
        "เขียนมาได้เลย เดี๋ยวผมช่วยสรุปให้ชัดขึ้น"
      );
    default:
      return "ผมอยู่ตรงนี้กับคุณนะ ตอนนี้อยากเริ่มจากเล่าเรื่องไหนก่อนครับ";
  }
}
