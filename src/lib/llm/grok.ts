import { generateText } from "ai";
import { createXai } from "@ai-sdk/xai";
import { env } from "@/lib/config";
import type { ResponsePlan, TopicDecision } from "@/lib/domain/types";
import { responsePlanSchema, sessionSummarySchema, topicDecisionSchema } from "@/lib/llm/schemas";
import { extractJsonObject, safeJsonParse } from "@/lib/utils/json";

const xai = createXai({
  apiKey: env.XAI_API_KEY
});

async function callGrok(params: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}) {
  const response = await generateText({
    model: xai.responses(env.XAI_MODEL),
    maxOutputTokens: params.maxTokens ?? 900,
    temperature: params.temperature ?? 0.2,
    system: params.system,
    prompt: params.user
  });

  return response.text.trim();
}

export type GrokPipelineStage = "topic_resolver" | "response_planner" | "session_summary";
export type GrokPipelineReason = "request_failed" | "non_json" | "schema_mismatch";

export class GrokPipelineError extends Error {
  stage: GrokPipelineStage;
  reason: GrokPipelineReason;
  rawPreview?: string;
  details?: unknown;

  constructor(params: {
    stage: GrokPipelineStage;
    reason: GrokPipelineReason;
    message: string;
    rawPreview?: string;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "GrokPipelineError";
    this.stage = params.stage;
    this.reason = params.reason;
    this.rawPreview = params.rawPreview;
    this.details = params.details;
  }
}

function parseStructuredJson<T>(rawText: string): T | null {
  const maybeJson = extractJsonObject(rawText);
  if (!maybeJson) {
    return null;
  }

  return safeJsonParse<T>(maybeJson);
}

export async function resolveTopicWithGrok(params: {
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

  let raw = "";
  try {
    raw = await callGrok({
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
  } catch (error) {
    throw new GrokPipelineError({
      stage: "topic_resolver",
      reason: "request_failed",
      message: "Grok topic resolver request failed",
      details: error instanceof Error ? error.message : String(error)
    });
  }

  const parsed = parseStructuredJson<unknown>(raw);
  if (!parsed) {
    throw new GrokPipelineError({
      stage: "topic_resolver",
      reason: "non_json",
      message: "Grok topic resolver returned non-json",
      rawPreview: raw.slice(0, 300)
    });
  }

  const validated = topicDecisionSchema.safeParse(parsed);
  if (!validated.success) {
    throw new GrokPipelineError({
      stage: "topic_resolver",
      reason: "schema_mismatch",
      message: "Grok topic resolver schema mismatch",
      details: validated.error.issues,
      rawPreview: raw.slice(0, 300)
    });
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

export async function buildResponsePlanWithGrok(params: {
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
    raw = await callGrok({
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
            message_draft: "string (max 1200 chars, end with one gentle question)"
          }
        },
        null,
        2
      ),
      maxTokens: 900,
      temperature: 0.15
    });
  } catch (error) {
    throw new GrokPipelineError({
      stage: "response_planner",
      reason: "request_failed",
      message: "Grok response planner request failed",
      details: error instanceof Error ? error.message : String(error)
    });
  }

  const parsed = parseStructuredJson<unknown>(raw);
  if (!parsed) {
    throw new GrokPipelineError({
      stage: "response_planner",
      reason: "non_json",
      message: "Grok response planner returned non-json output",
      rawPreview: raw.slice(0, 300)
    });
  }

  const validated = responsePlanSchema.safeParse(parsed);
  if (!validated.success) {
    throw new GrokPipelineError({
      stage: "response_planner",
      reason: "schema_mismatch",
      message: "Grok response planner schema mismatch",
      details: validated.error.issues,
      rawPreview: raw.slice(0, 300)
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

export async function summarizeSessionWithGrok(params: {
  topicLabel: string;
  recentMessages: Array<{ role: string; text: string }>;
}): Promise<{ topicLabel: string; summaryText: string; unresolvedItems: string[] }> {
  const systemPrompt = [
    "You summarize a mental-health support session.",
    "Return concise JSON only.",
    "Do not include diagnosis.",
    "Capture unresolved items and coping attempts."
  ].join("\n");

  let raw = "";
  try {
    raw = await callGrok({
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
  } catch (error) {
    throw new GrokPipelineError({
      stage: "session_summary",
      reason: "request_failed",
      message: "Grok summary request failed",
      details: error instanceof Error ? error.message : String(error)
    });
  }

  const parsed = parseStructuredJson<unknown>(raw);
  if (!parsed) {
    throw new GrokPipelineError({
      stage: "session_summary",
      reason: "non_json",
      message: "Grok summary returned non-json output",
      rawPreview: raw.slice(0, 300)
    });
  }

  const validated = sessionSummarySchema.safeParse(parsed);
  if (!validated.success) {
    throw new GrokPipelineError({
      stage: "session_summary",
      reason: "schema_mismatch",
      message: "Grok summary schema mismatch",
      details: validated.error.issues,
      rawPreview: raw.slice(0, 300)
    });
  }

  return {
    topicLabel: validated.data.topic_label,
    summaryText: validated.data.summary_text,
    unresolvedItems: validated.data.unresolved_items
  };
}
