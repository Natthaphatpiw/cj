import { env } from "@/lib/config";
import { logger } from "@/lib/logger";
import { extractJsonObject, safeJsonParse } from "@/lib/utils/json";

export type InputRoute = "mental_health_consult" | "general_other";

export type InputClassification = {
  route: InputRoute;
  confidence: number;
  reason: string;
  source: "openai" | "heuristic";
};

function clampConfidence(value: unknown) {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, numeric));
}

function parseOpenAiJson(rawText: string) {
  const strict = safeJsonParse<Record<string, unknown>>(rawText);
  if (strict) {
    return strict;
  }
  const extracted = extractJsonObject(rawText);
  if (!extracted) {
    return null;
  }
  return safeJsonParse<Record<string, unknown>>(extracted);
}

function toValidRoute(value: unknown): InputRoute | null {
  if (typeof value !== "string") {
    return null;
  }
  if (value === "mental_health_consult" || value === "general_other") {
    return value;
  }
  if (/consult|mental|emotion|support/i.test(value)) {
    return "mental_health_consult";
  }
  if (/general|other|operator|handoff/i.test(value)) {
    return "general_other";
  }
  return null;
}

function heuristicClassify(text: string): InputClassification {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return {
      route: "general_other",
      confidence: 0.95,
      reason: "empty_or_non_text",
      source: "heuristic"
    };
  }

  const mentalSignals =
    /เครียด|กังวล|ไม่ไหว|นอนไม่หลับ|เศร้า|ร้องไห้|เหนื่อยใจ|สับสน|กลัว|โกรธ|แฟน|ครอบครัว|งานกดดัน|ระบาย|ปรึกษา|mental|stress|anxiety|panic|depressed|sleep|sad|emotion|relationship/i;
  const operationalSignals =
    /สวัสดี|หวัดดี|hello|hi|test|ทดลอง|ok|โอเค|ขอบคุณ|thank|ยินดี|รับทราบ|ระบบมีปัญหา|บัค|error|แจ้งปัญหา|เปิดระบบ|ปิดระบบ|แอดมิน/i;
  const explicitPracticeSignals = /เช็กอารมณ์วันนี้|เช็คอารมณ์วันนี้|แบบฝึกหายใจ|mood\s*check|breathing/i;

  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;

  if (explicitPracticeSignals.test(normalized) || mentalSignals.test(normalized)) {
    return {
      route: "mental_health_consult",
      confidence: 0.92,
      reason: "mental_signal_detected",
      source: "heuristic"
    };
  }

  if (operationalSignals.test(normalized) || tokenCount <= 4 || normalized.length <= 20) {
    return {
      route: "general_other",
      confidence: 0.88,
      reason: "general_signal_detected",
      source: "heuristic"
    };
  }

  return {
    route: "mental_health_consult",
    confidence: 0.56,
    reason: "default_to_consult_on_uncertain",
    source: "heuristic"
  };
}

function extractCompletionText(payload: unknown) {
  const root = payload as Record<string, unknown> | null;
  const choices = Array.isArray(root?.choices) ? (root?.choices as Array<Record<string, unknown>>) : [];
  const first = choices[0];
  const message = (first?.message ?? null) as Record<string, unknown> | null;
  const content = message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part || typeof part !== "object") {
          return "";
        }
        const value = (part as Record<string, unknown>).text;
        return typeof value === "string" ? value : "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

async function classifyWithOpenAi(text: string): Promise<InputClassification | null> {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  const endpoint = `${env.OPENAI_API_BASE_URL.replace(/\/$/, "")}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.OPENAI_CLASSIFIER_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: env.OPENAI_CLASSIFIER_MODEL,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: [
              "Classify incoming LINE user text for routing.",
              "Return JSON only: {\"route\":\"mental_health_consult|general_other\",\"confidence\":0-1,\"reason\":\"string\"}.",
              "mental_health_consult: emotional support, stress, anxiety, relationship, life hardship, mood check, breathing exercise.",
              "general_other: greeting, thanks, admin/technical/reporting text, casual unrelated chat, tiny acknowledgements.",
              "If unsure, choose general_other with lower confidence."
            ].join("\n")
          },
          {
            role: "user",
            content: JSON.stringify({
              text
            })
          }
        ]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.warn("OpenAI classifier non-200 response", {
        status: response.status,
        bodyPreview: errText.slice(0, 200)
      });
      return null;
    }

    const payload = (await response.json()) as unknown;
    const raw = extractCompletionText(payload);
    if (!raw) {
      return null;
    }

    const parsed = parseOpenAiJson(raw);
    if (!parsed) {
      return null;
    }

    const route = toValidRoute(parsed.route);
    if (!route) {
      return null;
    }

    return {
      route,
      confidence: clampConfidence(parsed.confidence),
      reason: typeof parsed.reason === "string" && parsed.reason.length > 0 ? parsed.reason : "openai_classified",
      source: "openai"
    };
  } catch (error) {
    logger.warn("OpenAI classifier request failed, fallback to heuristic", {
      error: error instanceof Error ? error.message : "unknown_error"
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function classifyIncomingUserText(text: string): Promise<InputClassification> {
  if (!env.ENABLE_NON_CONSULT_CLASSIFIER) {
    return {
      route: "mental_health_consult",
      confidence: 0,
      reason: "classifier_disabled",
      source: "heuristic"
    };
  }

  const openaiResult = await classifyWithOpenAi(text);
  if (openaiResult) {
    return openaiResult;
  }

  return heuristicClassify(text);
}
