import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/config";
import type { ResponsePlan, TopicDecision } from "@/lib/domain/types";
import { logger } from "@/lib/logger";
import { responsePlanSchema, sessionSummarySchema, topicDecisionSchema } from "@/lib/llm/schemas";
import { extractJsonObject, safeJsonParse } from "@/lib/utils/json";

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
  baseURL: env.ANTHROPIC_API_BASE_URL,
  defaultHeaders: env.ANTHROPIC_CONTEXT_WINDOW_BETA
    ? {
        "anthropic-beta": env.ANTHROPIC_CONTEXT_WINDOW_BETA
      }
    : undefined
});

function getTextFromResponse(response: Anthropic.Messages.Message) {
  const textBlocks = response.content.filter((block) => block.type === "text");
  return textBlocks.map((block) => block.text).join("\n").trim();
}

async function callClaude(params: {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}) {
  const response = await anthropic.messages.create({
    model: params.model,
    max_tokens: params.maxTokens ?? 900,
    temperature: params.temperature ?? 0.2,
    system: params.system,
    messages: [
      {
        role: "user",
        content: params.user
      }
    ]
  });

  return getTextFromResponse(response);
}

function parseStructuredJson<T>(rawText: string): T | null {
  const maybeJson = extractJsonObject(rawText);
  if (!maybeJson) {
    return null;
  }

  return safeJsonParse<T>(maybeJson);
}

function buildPlannerFallback(params: {
  riskLevel: "low" | "medium" | "high" | "imminent";
  topicLabel: string;
  rawText?: string;
}): ResponsePlan {
  const rawCandidate = params.rawText?.replace(/\s+/g, " ").trim();
  const lowRiskDraft =
    "ขอบคุณที่เล่าให้ฟังนะ เรื่องนี้กดดันใจมากจริงๆ เราไม่ต้องรีบแก้ทุกอย่างในครั้งเดียว ตอนนี้อยากให้เราเริ่มแบบไหนดี ระบายต่ออีกหน่อย / ช่วยเรียงความคิดในหัว / พักหายใจช้าๆ 1 นาที";
  const mediumRiskDraft =
    "ขอบคุณที่ไว้ใจเล่าให้ฟังนะ ตอนนี้ความเครียดค่อนข้างหนักกับใจ เราจะค่อยๆ จัดการทีละจุดแบบไม่กดดันเกินไป ตอนนี้อยากให้ช่วยแบบไหนดี ระบายสิ่งที่หนักสุดก่อน / ช่วยจัดลำดับเรื่องที่ค้างในหัว / พักใจสั้นๆ ก่อน";

  const messageDraft =
    rawCandidate && rawCandidate.length >= 16
      ? rawCandidate.slice(0, 1200)
      : params.riskLevel === "medium"
        ? mediumRiskDraft
        : lowRiskDraft;

  return {
    mode: params.riskLevel === "medium" ? "grounding_coach" : "reflective_listener",
    riskLevel: params.riskLevel,
    topic: params.topicLabel,
    needsHandoff: false,
    shouldScheduleFollowup: params.riskLevel === "medium",
    followupDelayHours: params.riskLevel === "medium" ? 12 : undefined,
    messageDraft
  };
}

function fallbackTopicDecision(parsed: unknown): Partial<TopicDecision> | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const data = parsed as Record<string, unknown>;
  const topicCandidate = [data.topic_label, data.topic, data.topicLabel]
    .find((value) => typeof value === "string" && value.trim().length > 0);

  const confidenceRaw = data.confidence;
  const confidence =
    typeof confidenceRaw === "number"
      ? confidenceRaw
      : typeof confidenceRaw === "string"
        ? Number(confidenceRaw)
        : 0.5;

  const isNewTopicRaw = data.is_new_topic;
  const isNewTopic =
    typeof isNewTopicRaw === "boolean"
      ? isNewTopicRaw
      : typeof isNewTopicRaw === "string"
        ? isNewTopicRaw.toLowerCase() === "true"
        : false;

  return {
    isNewTopic,
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
    topicLabel: topicCandidate ? String(topicCandidate) : "general_support",
    relationToPrevious:
      data.relation_to_previous === "shift" || data.relation_to_previous === "reopen"
        ? (data.relation_to_previous as "shift" | "reopen")
        : "same",
    shouldOpenNewSession:
      typeof data.should_open_new_session === "boolean" ? data.should_open_new_session : undefined,
    shouldReopenPriorSessionId:
      typeof data.should_reopen_prior_session_id === "string"
        ? data.should_reopen_prior_session_id
        : undefined,
    reason: typeof data.reason === "string" ? data.reason : "llm_topic_resolver_fallback"
  };
}

export async function resolveTopicWithClaude(params: {
  message: string;
  activeTopic: string | null;
  activeSummary: string | null;
  recentSummaries: Array<{ sessionId: string; topicLabel: string; summary: string }>;
}): Promise<Partial<TopicDecision> | null> {
  const systemPrompt = [
    "You are a topic-boundary classifier for a mental-health support bot on LINE OA.",
    "Return JSON only.",
    "Decide if latest message starts a new topic session.",
    "Be conservative. If uncertain, keep same topic and lower confidence."
  ].join("\n");

  const raw = await callClaude({
    model: env.ANTHROPIC_MODEL_TOPIC,
    system: systemPrompt,
    user: JSON.stringify(
      {
        latest_message: params.message,
        active_topic: params.activeTopic,
        active_summary: params.activeSummary,
        recent_summaries: params.recentSummaries
      },
      null,
      2
    ),
    maxTokens: 300,
    temperature: 0
  });

  const parsed = parseStructuredJson<unknown>(raw);
  if (!parsed) {
    logger.warn("Topic resolver returned non-json", { raw });
    return null;
  }

  const validated = topicDecisionSchema.safeParse(parsed);
  if (!validated.success) {
    const fallback = fallbackTopicDecision(parsed);
    if (fallback) {
      logger.warn("Topic resolver schema mismatch, using fallback parse", {
        issues: validated.error.issues
      });
      return fallback;
    }

    logger.warn("Topic resolver json schema mismatch", {
      issues: validated.error.issues
    });
    return null;
  }

  return {
    isNewTopic: validated.data.is_new_topic,
    confidence: validated.data.confidence,
    topicLabel: validated.data.topic_label,
    relationToPrevious: validated.data.relation_to_previous,
    shouldOpenNewSession: validated.data.should_open_new_session,
    shouldReopenPriorSessionId: validated.data.should_reopen_prior_session_id ?? undefined,
    reason: validated.data.reason
  };
}

export async function buildResponsePlanWithClaude(params: {
  message: string;
  locale: string;
  riskLevel: "low" | "medium" | "high" | "imminent";
  topicLabel: string;
  recentMessages: Array<{ role: string; text: string }>;
  userMemories: Array<{ type: string; content: string }>;
  productBoundary: {
    crisisPrimaryLabel: string;
    crisisPhone: string;
    emergencyNumber: string;
  };
}): Promise<ResponsePlan> {
  const systemPrompt = [
    "You are Thai-first emotional support companion for LINE chat with therapist-informed skills.",
    "Return valid JSON only.",
    "Never claim medical authority or diagnosis.",
    "Sound human, warm, and grounded. Avoid robotic helper tone.",
    "Use advanced but gentle psychological communication: emotion validation, meaning reflection, self-compassion reframe, and one practical micro-step.",
    "Do not do lecture style. Do not dump generic tips.",
    "Open with a natural validating sentence. Avoid awkward interjections.",
    "Use clean paragraph layout only.",
    "Do not use markdown syntax such as bold markers, headings, bullets, code ticks, or quoted-highlight formatting.",
    "No checklist style unless user explicitly asks for a checklist.",
    "Each response should aim to make the user feel slightly safer and less alone in this turn.",
    "Include one insight that helps user understand their inner pattern, not only listening.",
    "Then offer one concrete, low-effort step for now.",
    "End with one gentle low-friction question that invites continued chat.",
    "The ending question should reduce resistance by offering 2-3 easy options in the same sentence.",
    "Ask one question only. Do not ask stacked questions.",
    "If risk is high/imminent, choose crisis_mode and include immediate support options."
  ].join("\n");

  let raw = "";
  try {
    raw = await callClaude({
      model: env.ANTHROPIC_MODEL_PRIMARY,
      system: systemPrompt,
      user: JSON.stringify(
        {
          latest_message: params.message,
          locale: params.locale,
          risk_level_from_precheck: params.riskLevel,
          topic_label: params.topicLabel,
          recent_messages: params.recentMessages,
          user_memories: params.userMemories,
          product_boundary: params.productBoundary,
          style_targets: {
            primary_goal:
              "make the user feel understood, emotionally held, and slightly better in this turn",
            natural_human_tone: true,
            therapist_informed_tone: true,
            paragraph_layout_only: true,
            no_markdown_syntax: true,
            no_checklist_by_default: true,
            avoid_excessive_emoji: true,
            max_sentences_non_crisis: 6,
            must_include: [
              "specific emotional validation from user wording",
              "one gentle psychological reframe",
              "one immediate micro-step",
              "one low-friction closing question"
            ],
            closing_question_pattern:
              "one gentle question with options, such as: ตอนนี้อยากให้เราเริ่มแบบไหนดี ระบายต่อ / จัดการความคิดไม่พอในหัวก่อน / พักใจ 1 นาที"
          },
          avoid_phrases: [
            "โอ้",
            "ได้ยินแล้ว",
            "ลองทำสิ่งเหล่านี้ดูได้เลย",
            "นี่คือวิธี",
            "checklist",
            "step 1",
            "step 2",
            "**",
            "\""
          ],
          required_schema: {
            mode: "gentle_short | reflective_listener | grounding_coach | psychoeducation_light | crisis_mode",
            risk_level: "low | medium | high | imminent",
            topic: "string",
            needs_handoff: "boolean",
            should_schedule_followup: "boolean",
            followup_delay_hours: "number (optional)",
            memory_candidate: {
              type: "preference | stable_fact | support_pattern",
              content: "string",
              sensitivity: "low | medium | high"
            },
            message_draft: "string"
          }
        },
        null,
        2
      ),
      maxTokens: 700,
      temperature: 0.15
    });
  } catch (error) {
    logger.error("Claude response planner request failed", {
      error: error instanceof Error ? error.message : "unknown_error"
    });
    return buildPlannerFallback({
      riskLevel: params.riskLevel,
      topicLabel: params.topicLabel
    });
  }

  const parsed = parseStructuredJson<unknown>(raw);
  if (!parsed) {
    logger.warn("Claude response planner returned non-json output, using fallback", {
      rawPreview: raw.slice(0, 300)
    });
    return buildPlannerFallback({
      riskLevel: params.riskLevel,
      topicLabel: params.topicLabel,
      rawText: raw
    });
  }

  const validated = responsePlanSchema.safeParse(parsed);
  if (!validated.success) {
    logger.warn("Claude response planner schema mismatch, using fallback", {
      issues: validated.error.issues
    });
    return buildPlannerFallback({
      riskLevel: params.riskLevel,
      topicLabel: params.topicLabel,
      rawText: raw
    });
  }

  return {
    mode: validated.data.mode,
    riskLevel: validated.data.risk_level,
    topic: validated.data.topic,
    needsHandoff: validated.data.needs_handoff,
    shouldScheduleFollowup: validated.data.should_schedule_followup,
    followupDelayHours: validated.data.followup_delay_hours,
    memoryCandidate: validated.data.memory_candidate,
    messageDraft: validated.data.message_draft
  };
}

export async function summarizeSessionWithClaude(params: {
  topicLabel: string;
  recentMessages: Array<{ role: string; text: string }>;
}): Promise<{ topicLabel: string; summaryText: string; unresolvedItems: string[] }> {
  const systemPrompt = [
    "You summarize a mental-health support session.",
    "Return concise JSON only.",
    "Do not include diagnosis.",
    "Capture unresolved items and coping attempts."
  ].join("\n");

  const raw = await callClaude({
    model: env.ANTHROPIC_MODEL_SUMMARY,
    system: systemPrompt,
    user: JSON.stringify(
      {
        topic_label: params.topicLabel,
        recent_messages: params.recentMessages
      },
      null,
      2
    ),
    maxTokens: 450,
    temperature: 0
  });

  const parsed = parseStructuredJson<unknown>(raw);
  if (!parsed) {
    throw new Error("Claude summary returned non-json output");
  }

  const validated = sessionSummarySchema.parse(parsed);
  return {
    topicLabel: validated.topic_label,
    summaryText: validated.summary_text,
    unresolvedItems: validated.unresolved_items
  };
}
