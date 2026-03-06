import { env } from "@/lib/config";
import { vectorQueryByText } from "@/lib/data/vector";
import type { SessionRecord } from "@/lib/data/repositories";
import type { TopicDecision } from "@/lib/domain/types";

const explicitNewTopicPatterns = [
  /^เริ่มเรื่องใหม่$/i,
  /เรื่องใหม่/i,
  /อีกเรื่อง/i,
  /เปลี่ยนเรื่อง/i,
  /new topic/i,
  /different issue/i
];

const explicitContinuePatterns = [
  /คุยต่อเรื่องเดิม/i,
  /continue/i
];

const topicKeywords: Array<{ topic: string; keywords: string[] }> = [
  { topic: "exam_stress", keywords: ["สอบ", "เกรด", "งานส่ง", "เรียน", "exam", "study"] },
  { topic: "family_conflict", keywords: ["แม่", "พ่อ", "ครอบครัว", "ทะเลาะ", "family"] },
  { topic: "relationship", keywords: ["แฟน", "เลิก", "relationship", "boyfriend", "girlfriend"] },
  { topic: "work_stress", keywords: ["งาน", "หัวหน้า", "บริษัท", "burnout", "work"] },
  { topic: "anxiety", keywords: ["วิตก", "กังวล", "panic", "anxiety", "ใจสั่น"] },
  { topic: "depression", keywords: ["เศร้า", "หมดหวัง", "depressed", "ไม่มีแรง", "ร้องไห้"] }
];

function inferTopicLabel(message: string) {
  const normalized = message.toLowerCase();
  for (const candidate of topicKeywords) {
    if (candidate.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return candidate.topic;
    }
  }
  return "general_support";
}

function getHoursGap(previousTimestamp?: string | null) {
  if (!previousTimestamp) {
    return null;
  }
  const previous = new Date(previousTimestamp).getTime();
  if (Number.isNaN(previous)) {
    return null;
  }
  return (Date.now() - previous) / (1000 * 60 * 60);
}

type TopicResolverInput = {
  message: string;
  actionHint?: "new_topic" | "continue_topic";
  activeSession: SessionRecord | null;
  recentSummaries: Array<{
    session_id: string;
    topic_label: string;
    summary_text: string;
  }>;
  llmResolver?: (params: {
    message: string;
    activeTopic: string | null;
    activeSummary: string | null;
    recentSummaries: Array<{ sessionId: string; topicLabel: string; summary: string }>;
  }) => Promise<Partial<TopicDecision> | null>;
};

export async function resolveTopicBoundary(input: TopicResolverInput): Promise<TopicDecision> {
  const message = input.message.trim();
  const inferredTopic = inferTopicLabel(message);

  if (input.actionHint === "new_topic") {
    return {
      isNewTopic: true,
      confidence: 0.99,
      topicLabel: inferredTopic,
      relationToPrevious: "shift",
      shouldOpenNewSession: true,
      needsUserConfirmation: false,
      reason: "user_explicit_postback_new_topic"
    };
  }

  if (input.actionHint === "continue_topic") {
    return {
      isNewTopic: false,
      confidence: 0.99,
      topicLabel: input.activeSession?.topic_label ?? inferredTopic,
      relationToPrevious: "same",
      shouldOpenNewSession: false,
      needsUserConfirmation: false,
      reason: "user_explicit_postback_continue"
    };
  }

  if (explicitContinuePatterns.some((pattern) => pattern.test(message))) {
    return {
      isNewTopic: false,
      confidence: 0.9,
      topicLabel: input.activeSession?.topic_label ?? inferredTopic,
      relationToPrevious: "same",
      shouldOpenNewSession: false,
      needsUserConfirmation: false,
      reason: "user_explicit_continue_text"
    };
  }

  if (explicitNewTopicPatterns.some((pattern) => pattern.test(message))) {
    return {
      isNewTopic: true,
      confidence: 0.9,
      topicLabel: inferredTopic,
      relationToPrevious: "shift",
      shouldOpenNewSession: true,
      needsUserConfirmation: false,
      reason: "user_explicit_new_topic_text"
    };
  }

  if (!input.activeSession) {
    return {
      isNewTopic: true,
      confidence: 1,
      topicLabel: inferredTopic,
      relationToPrevious: "shift",
      shouldOpenNewSession: true,
      needsUserConfirmation: false,
      reason: "no_active_session"
    };
  }

  const gapHours = getHoursGap(input.activeSession.last_message_at);
  if (gapHours && gapHours >= env.SESSION_HARD_RESET_HOURS) {
    return {
      isNewTopic: true,
      confidence: 0.86,
      topicLabel: inferredTopic,
      relationToPrevious: "shift",
      shouldOpenNewSession: true,
      needsUserConfirmation: false,
      reason: "hard_reset_gap"
    };
  }

  const vectorMatches = await vectorQueryByText(message, 3);
  const bestMatch = vectorMatches[0];
  if (bestMatch?.metadata && String(bestMatch.metadata.session_id ?? "") === input.activeSession.id) {
    return {
      isNewTopic: false,
      confidence: Math.max(0.62, bestMatch.score),
      topicLabel: input.activeSession.topic_label,
      relationToPrevious: "same",
      shouldOpenNewSession: false,
      needsUserConfirmation: false,
      reason: "vector_match_active_session"
    };
  }

  if (bestMatch && bestMatch.score < env.TOPIC_SIMILARITY_THRESHOLD * 0.8) {
    return {
      isNewTopic: true,
      confidence: 0.74,
      topicLabel: inferredTopic,
      relationToPrevious: "shift",
      shouldOpenNewSession: false,
      needsUserConfirmation: true,
      reason: "vector_low_similarity"
    };
  }

  if (input.llmResolver) {
    const llmDecision = await input.llmResolver({
      message,
      activeTopic: input.activeSession.topic_label,
      activeSummary: input.recentSummaries[0]?.summary_text ?? null,
      recentSummaries: input.recentSummaries.map((summary) => ({
        sessionId: summary.session_id,
        topicLabel: summary.topic_label,
        summary: summary.summary_text
      }))
    });

    if (llmDecision) {
      const confidence = Math.min(1, Math.max(0, llmDecision.confidence ?? 0.5));
      const isNewTopic = Boolean(llmDecision.isNewTopic);
      const shouldOpenNewSession = confidence >= env.NEW_TOPIC_CONFIDENCE_AUTO_OPEN_MIN && isNewTopic;
      const needsUserConfirmation =
        isNewTopic && confidence >= env.NEW_TOPIC_CONFIDENCE_CONFIRM_MIN && !shouldOpenNewSession;

      return {
        isNewTopic,
        confidence,
        topicLabel: llmDecision.topicLabel ?? inferredTopic,
        relationToPrevious: llmDecision.relationToPrevious ?? (isNewTopic ? "shift" : "same"),
        shouldOpenNewSession,
        shouldReopenPriorSessionId: llmDecision.shouldReopenPriorSessionId,
        needsUserConfirmation,
        reason: llmDecision.reason ?? "llm_topic_resolver"
      };
    }
  }

  return {
    isNewTopic: false,
    confidence: 0.5,
    topicLabel: input.activeSession.topic_label,
    relationToPrevious: "same",
    shouldOpenNewSession: false,
    needsUserConfirmation: false,
    reason: "fallback_keep_current"
  };
}
