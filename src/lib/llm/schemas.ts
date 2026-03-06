import { z } from "zod";

const booleanLike = z.union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) => (typeof value === "boolean" ? value : value === "true"));

const numberLike = z.union([z.number(), z.string()])
  .transform((value) => {
    if (typeof value === "number") {
      return value;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0.5;
  })
  .pipe(z.number().min(0).max(1));

export const topicDecisionSchema = z
  .object({
    is_new_topic: booleanLike.default(false),
    confidence: numberLike.default(0.5),
    topic_label: z.string().optional(),
    topic: z.string().optional(),
    topicLabel: z.string().optional(),
    relation_to_previous: z.enum(["same", "shift", "reopen"]).default("same"),
    should_open_new_session: booleanLike.optional(),
    should_reopen_prior_session_id: z.string().nullable().optional(),
    reason: z.string().default("llm_topic_resolver")
  })
  .transform((data) => ({
    is_new_topic: data.is_new_topic,
    confidence: data.confidence,
    topic_label: data.topic_label ?? data.topic ?? data.topicLabel ?? "general_support",
    relation_to_previous: data.relation_to_previous,
    should_open_new_session: data.should_open_new_session,
    should_reopen_prior_session_id: data.should_reopen_prior_session_id,
    reason: data.reason
  }));

export const responsePlanSchema = z.object({
  mode: z.enum([
    "gentle_short",
    "reflective_listener",
    "grounding_coach",
    "psychoeducation_light",
    "crisis_mode"
  ]),
  risk_level: z.enum(["low", "medium", "high", "imminent"]),
  topic: z.string(),
  needs_handoff: z.boolean(),
  should_schedule_followup: z.boolean(),
  followup_delay_hours: z.number().int().positive().max(168).optional(),
  memory_candidate: z
    .object({
      type: z.enum(["preference", "stable_fact", "support_pattern"]),
      content: z.string(),
      sensitivity: z.enum(["low", "medium", "high"])
    })
    .optional(),
  message_draft: z.string().min(1)
});

export const sessionSummarySchema = z.object({
  topic_label: z.string(),
  summary_text: z.string().min(1).max(1500),
  unresolved_items: z.array(z.string()).max(8).default([])
});
