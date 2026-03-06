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
    "You are Thai-first mental-health support assistant policy planner.",
    "Return valid JSON only.",
    "Never claim medical authority or diagnosis.",
    "Prioritize psychological first-aid style communication.",
    "If risk is high/imminent, choose crisis_mode and include immediate support options.",
    "Keep response concise and empathetic."
  ].join("\n");

  const raw = await callClaude({
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

  const parsed = parseStructuredJson<unknown>(raw);
  if (!parsed) {
    throw new Error("Claude response planner returned non-json output");
  }

  const validated = responsePlanSchema.parse(parsed);
  return {
    mode: validated.mode,
    riskLevel: validated.risk_level,
    topic: validated.topic,
    needsHandoff: validated.needs_handoff,
    shouldScheduleFollowup: validated.should_schedule_followup,
    followupDelayHours: validated.followup_delay_hours,
    memoryCandidate: validated.memory_candidate,
    messageDraft: validated.message_draft
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
