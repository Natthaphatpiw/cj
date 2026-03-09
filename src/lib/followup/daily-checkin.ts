import { env } from "@/lib/config";
import { logger } from "@/lib/logger";
import { extractJsonObject, safeJsonParse } from "@/lib/utils/json";

const fallbackDailyCheckinsTh = [
  "วันนี้ใจคุณเป็นยังไงบ้าง อยากเล่าเรื่องไหนให้ผมฟังบ้างครับ",
  "ขอแวะมาเช็กใจสั้น ๆ วันนี้มีเรื่องไหนที่หนักที่สุดสำหรับคุณไหม",
  "วันนี้เจออะไรที่ทำให้ใจล้าไหมครับ ถ้าอยากคุย ผมอยู่ตรงนี้เสมอ",
  "ขอชวนเช็กอารมณ์ตอนเย็น ตอนนี้ความรู้สึกหลักของคุณคืออะไรครับ",
  "วันนี้ผ่านอะไรมาเยอะไหมครับ อยากเล่าต่อจากตรงไหน ผมพร้อมฟัง"
];

const fallbackDailyCheckinsEn = [
  "How has your day been so far, and what feels heaviest right now?",
  "Quick evening check-in: what is one feeling you want to share today?",
  "I am here with you. What happened today that stayed in your mind?",
  "Before you rest, what would you like to let out from today?",
  "How is your heart today, and where do you want to start talking?"
];

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function isTooSimilar(candidate: string, history: string[]) {
  const normalizedCandidate = normalizeText(candidate);
  return history.some((item) => normalizeText(item) === normalizedCandidate);
}

function fallbackMessage(locale: string, history: string[]) {
  const pool = locale === "en" ? fallbackDailyCheckinsEn : fallbackDailyCheckinsTh;
  const filtered = pool.filter((item) => !isTooSimilar(item, history));
  const candidates = filtered.length > 0 ? filtered : pool;
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

function parseGeneratedText(raw: string) {
  const strict = safeJsonParse<Record<string, unknown>>(raw);
  const fromStrict = typeof strict?.text === "string" ? strict.text : null;
  if (fromStrict) {
    return fromStrict.trim();
  }

  const extracted = extractJsonObject(raw);
  if (!extracted) {
    return null;
  }
  const parsed = safeJsonParse<Record<string, unknown>>(extracted);
  if (!parsed || typeof parsed.text !== "string") {
    return null;
  }
  return parsed.text.trim();
}

function sanitizeGeneratedText(text: string, locale: string) {
  let output = text.replace(/\s+/g, " ").trim();
  output = output.replace(/[\"'`]/g, "");

  if (output.length > 180) {
    output = `${output.slice(0, 177).trim()}...`;
  }

  const forbidden = [
    /วินิจฉัย/i,
    /diagnos/i,
    /รับประกัน/i,
    /cure/i,
    /prescription/i
  ];

  if (forbidden.some((pattern) => pattern.test(output))) {
    return locale === "en"
      ? "How are you feeling today, and what would you like to talk about first?"
      : "วันนี้ความรู้สึกคุณเป็นยังไงบ้างครับ และอยากเริ่มเล่าจากตรงไหนก่อน";
  }

  return output;
}

export async function generateDailyOpenCheckinMessage(params: {
  locale: string;
  recentUserMessages: string[];
  recentSentCheckins: string[];
}) {
  if (!env.OPENAI_API_KEY) {
    return {
      text: fallbackMessage(params.locale, params.recentSentCheckins),
      source: "fallback" as const
    };
  }

  const endpoint = `${env.OPENAI_API_BASE_URL.replace(/\/$/, "")}/chat/completions`;
  const contextSnippet = params.recentUserMessages.slice(-5).join(" | ").slice(0, 1200);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: env.OPENAI_CHECKIN_MODEL,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: [
              "Generate one daily emotional check-in message for a mental wellness companion.",
              "Return JSON only: {\"text\":\"...\"}.",
              "Constraints:",
              "- gentle and human tone",
              "- open-ended question",
              "- no diagnosis, no medical claims",
              "- no guilt or pressure",
              "- max 180 characters"
            ].join("\n")
          },
          {
            role: "user",
            content: JSON.stringify({
              locale: params.locale === "en" ? "en" : "th",
              recent_user_context: contextSnippet,
              avoid_repeating: params.recentSentCheckins.slice(0, 12)
            })
          }
        ]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      logger.warn("Daily checkin generator returned non-200", {
        status: response.status,
        bodyPreview: text.slice(0, 160)
      });
      return {
        text: fallbackMessage(params.locale, params.recentSentCheckins),
        source: "fallback" as const
      };
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const choices = Array.isArray(payload.choices) ? (payload.choices as Array<Record<string, unknown>>) : [];
    const first = choices[0];
    const message = first?.message as Record<string, unknown> | undefined;
    const rawContent = typeof message?.content === "string" ? message.content : "";
    const parsed = parseGeneratedText(rawContent);
    if (!parsed) {
      return {
        text: fallbackMessage(params.locale, params.recentSentCheckins),
        source: "fallback" as const
      };
    }

    const sanitized = sanitizeGeneratedText(parsed, params.locale);
    const finalText = isTooSimilar(sanitized, params.recentSentCheckins)
      ? fallbackMessage(params.locale, params.recentSentCheckins)
      : sanitized;

    return {
      text: finalText,
      source: "openai" as const
    };
  } catch (error) {
    logger.warn("Daily checkin generator failed", {
      error: error instanceof Error ? error.message : "unknown_error"
    });
    return {
      text: fallbackMessage(params.locale, params.recentSentCheckins),
      source: "fallback" as const
    };
  }
}
