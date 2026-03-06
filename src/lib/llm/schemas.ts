import { z } from "zod";

export const topicDecisionSchema = z.object({
  is_new_topic: z.boolean(),
  confidence: z.number().min(0).max(1),
  topic_label: z.string(),
  relation_to_previous: z.enum(["same", "shift", "reopen"]).default("same"),
  should_open_new_session: z.boolean().optional(),
  should_reopen_prior_session_id: z.string().nullable().optional(),
  reason: z.string().default("llm_topic_resolver")
});

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
