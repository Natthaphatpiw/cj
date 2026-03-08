import { supabaseAdmin } from "@/lib/data/supabase";
import type { RiskLevel, SessionStatus } from "@/lib/domain/types";

type LineProfileSnapshot = {
  displayName?: string;
  pictureUrl?: string;
  language?: string;
};

export type UserRecord = {
  id: string;
  timezone: string;
  language: string;
  risk_baseline: RiskLevel;
  memory_consent_status: boolean;
  created_at: string;
};

export type SessionRecord = {
  id: string;
  user_id: string;
  conversation_id: string;
  status: SessionStatus;
  topic_label: string;
  linked_prior_session_id: string | null;
  risk_peak: RiskLevel;
  opened_at: string;
  closed_at: string | null;
  last_message_at: string | null;
};

export type MessageRecord = {
  id: string;
  user_id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content_type: string;
  content_text: string;
  line_webhook_event_id: string | null;
  line_message_id: string | null;
  safety_label: string | null;
  created_at: string;
};

export type MemoryRecord = {
  id: string;
  user_id: string;
  memory_type: string;
  content: string;
  sensitivity: string;
  confidence: number;
  expires_at: string | null;
};

export type FollowupRecord = {
  id: string;
  user_id: string;
  session_id: string;
  scheduled_for: string;
  purpose: string;
  status: "scheduled" | "sent" | "failed" | "cancelled" | string;
  payload: Record<string, unknown> | null;
  sent_at: string | null;
  created_at: string;
};

function assertDb<T>(value: T | null, error: { message: string } | null, context: string) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
  if (!value) {
    throw new Error(`${context}: missing data`);
  }
  return value;
}

export async function recordWebhookEvent(params: {
  webhookEventId: string;
  lineUserId: string | null;
  payload: Record<string, unknown>;
  isRedelivery: boolean;
}) {
  const { error } = await supabaseAdmin.from("webhook_events").insert({
    webhook_event_id: params.webhookEventId,
    line_user_id: params.lineUserId,
    payload: params.payload,
    is_redelivery: params.isRedelivery
  });

  if (error) {
    throw new Error(`recordWebhookEvent: ${error.message}`);
  }
}

export async function resolveUserByLineId(
  lineUserId: string,
  profile?: LineProfileSnapshot
): Promise<UserRecord> {
  const identityResult = await supabaseAdmin
    .from("line_identities")
    .select("user_id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (identityResult.error) {
    throw new Error(`resolveUserByLineId(identity): ${identityResult.error.message}`);
  }

  if (identityResult.data?.user_id) {
    const userResult = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", identityResult.data.user_id)
      .single();
    const user = assertDb<UserRecord>(
      userResult.data as UserRecord | null,
      userResult.error,
      "resolveUserByLineId(user)"
    );

    await supabaseAdmin.from("line_identities").upsert(
      {
        line_user_id: lineUserId,
        user_id: user.id,
        display_name_snapshot: profile?.displayName ?? null,
        picture_url_snapshot: profile?.pictureUrl ?? null,
        language_snapshot: profile?.language ?? null,
        last_seen_at: new Date().toISOString()
      },
      {
        onConflict: "line_user_id"
      }
    );

    return user;
  }

  const newUserResult = await supabaseAdmin
    .from("users")
    .insert({
      language: profile?.language ?? "th",
      timezone: "Asia/Bangkok",
      risk_baseline: "low",
      memory_consent_status: true
    })
    .select("*")
    .single();

  const user = assertDb<UserRecord>(
    newUserResult.data as UserRecord | null,
    newUserResult.error,
    "resolveUserByLineId(insert user)"
  );

  const identityInsert = await supabaseAdmin.from("line_identities").insert({
    user_id: user.id,
    line_user_id: lineUserId,
    display_name_snapshot: profile?.displayName ?? null,
    picture_url_snapshot: profile?.pictureUrl ?? null,
    language_snapshot: profile?.language ?? null,
    last_seen_at: new Date().toISOString()
  });

  if (identityInsert.error) {
    throw new Error(`resolveUserByLineId(insert identity): ${identityInsert.error.message}`);
  }

  await ensureConversation(user.id);
  return user;
}

export async function ensureConversation(userId: string) {
  const existing = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`ensureConversation(select): ${existing.error.message}`);
  }

  if (existing.data?.id) {
    return existing.data.id as string;
  }

  const inserted = await supabaseAdmin
    .from("conversations")
    .insert({
      user_id: userId
    })
    .select("id")
    .single();

  const row = assertDb<{ id: string }>(
    inserted.data as { id: string } | null,
    inserted.error,
    "ensureConversation(insert)"
  );
  return row.id;
}

export async function getActiveSession(userId: string): Promise<SessionRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "dormant", "crisis_locked"])
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`getActiveSession: ${error.message}`);
  }

  return (data as SessionRecord | null) ?? null;
}

export async function listRecentMessages(sessionId: string, limit = 12): Promise<MessageRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`listRecentMessages: ${error.message}`);
  }

  return ((data as MessageRecord[] | null) ?? []).reverse();
}

export async function listRecentSessionSummaries(userId: string, limit = 5) {
  const { data, error } = await supabaseAdmin
    .from("session_summaries")
    .select("session_id, topic_label, summary_text, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`listRecentSessionSummaries: ${error.message}`);
  }

  return (data ?? []) as Array<{
    session_id: string;
    topic_label: string;
    summary_text: string;
    updated_at: string;
  }>;
}

export async function openSession(params: {
  userId: string;
  topicLabel: string;
  linkedPriorSessionId?: string;
  status?: SessionStatus;
}) {
  const conversationId = await ensureConversation(params.userId);
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .insert({
      user_id: params.userId,
      conversation_id: conversationId,
      topic_label: params.topicLabel,
      linked_prior_session_id: params.linkedPriorSessionId ?? null,
      status: params.status ?? "active",
      risk_peak: "low",
      opened_at: new Date().toISOString(),
      last_message_at: new Date().toISOString()
    })
    .select("*")
    .single();

  const row = assertDb<SessionRecord>(data as SessionRecord | null, error, "openSession");

  await supabaseAdmin
    .from("conversations")
    .update({
      current_session_id: row.id,
      last_message_at: new Date().toISOString()
    })
    .eq("id", row.conversation_id);

  return row;
}

export async function updateSessionState(params: {
  sessionId: string;
  status?: SessionStatus;
  riskPeak?: RiskLevel;
  topicLabel?: string;
}) {
  const payload: Record<string, unknown> = {};
  if (params.status) {
    payload.status = params.status;
    if (params.status === "closed") {
      payload.closed_at = new Date().toISOString();
    }
  }
  if (params.riskPeak) {
    payload.risk_peak = params.riskPeak;
  }
  if (params.topicLabel) {
    payload.topic_label = params.topicLabel;
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  const { error } = await supabaseAdmin.from("sessions").update(payload).eq("id", params.sessionId);
  if (error) {
    throw new Error(`updateSessionState: ${error.message}`);
  }
}

export async function saveMessage(params: {
  userId: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  contentType: string;
  contentText: string;
  lineWebhookEventId?: string;
  lineMessageId?: string;
  safetyLabel?: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({
      user_id: params.userId,
      session_id: params.sessionId,
      role: params.role,
      content_type: params.contentType,
      content_text: params.contentText,
      line_webhook_event_id: params.lineWebhookEventId ?? null,
      line_message_id: params.lineMessageId ?? null,
      safety_label: params.safetyLabel ?? null
    })
    .select("*")
    .single();

  const row = assertDb<MessageRecord>(data as MessageRecord | null, error, "saveMessage");

  await supabaseAdmin
    .from("sessions")
    .update({ last_message_at: row.created_at })
    .eq("id", params.sessionId);

  return row;
}

export async function saveSessionSummary(params: {
  userId: string;
  sessionId: string;
  topicLabel: string;
  summaryText: string;
}) {
  const { error } = await supabaseAdmin.from("session_summaries").upsert(
    {
      user_id: params.userId,
      session_id: params.sessionId,
      topic_label: params.topicLabel,
      summary_text: params.summaryText,
      updated_at: new Date().toISOString()
    },
    { onConflict: "session_id" }
  );

  if (error) {
    throw new Error(`saveSessionSummary: ${error.message}`);
  }
}

export async function listUserMemories(userId: string, limit = 10): Promise<MemoryRecord[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("user_memories")
    .select("*")
    .eq("user_id", userId)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`listUserMemories: ${error.message}`);
  }

  return (data as MemoryRecord[] | null) ?? [];
}

export async function saveUserMemory(params: {
  userId: string;
  memoryType: string;
  content: string;
  sensitivity: "low" | "medium" | "high";
  confidence: number;
  expiresAt?: string;
}) {
  const { error } = await supabaseAdmin.from("user_memories").insert({
    user_id: params.userId,
    memory_type: params.memoryType,
    content: params.content,
    sensitivity: params.sensitivity,
    confidence: params.confidence,
    expires_at: params.expiresAt ?? null
  });

  if (error) {
    throw new Error(`saveUserMemory: ${error.message}`);
  }
}

export async function recordRiskEvent(params: {
  userId: string;
  sessionId: string;
  riskLevel: RiskLevel;
  triggerReason: string;
  actionTaken: string;
  requiresHumanReview: boolean;
}) {
  const { data, error } = await supabaseAdmin
    .from("risk_events")
    .insert({
      user_id: params.userId,
      session_id: params.sessionId,
      risk_level: params.riskLevel,
      trigger_reason: params.triggerReason,
      action_taken: params.actionTaken,
      requires_human_review: params.requiresHumanReview,
      status: params.requiresHumanReview ? "open" : "resolved"
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`recordRiskEvent: ${error.message}`);
  }

  return (data as { id: string }).id;
}

export async function createFollowup(params: {
  userId: string;
  sessionId: string;
  scheduledFor: string;
  purpose: string;
  payload: Record<string, unknown>;
}) {
  const { data, error } = await supabaseAdmin
    .from("followups")
    .insert({
      user_id: params.userId,
      session_id: params.sessionId,
      scheduled_for: params.scheduledFor,
      purpose: params.purpose,
      payload: params.payload,
      status: "scheduled"
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`createFollowup: ${error.message}`);
  }

  return (data as { id: string }).id;
}

export async function markFollowupAsSent(followupId: string) {
  const { data, error } = await supabaseAdmin
    .from("followups")
    .update({
      status: "sent",
      sent_at: new Date().toISOString()
    })
    .eq("id", followupId)
    .eq("status", "scheduled")
    .select("id");

  if (error) {
    throw new Error(`markFollowupAsSent: ${error.message}`);
  }

  return (data?.length ?? 0) > 0;
}

export async function markFollowupAsCancelled(followupId: string) {
  const { data, error } = await supabaseAdmin
    .from("followups")
    .update({
      status: "cancelled"
    })
    .eq("id", followupId)
    .eq("status", "scheduled")
    .select("id");

  if (error) {
    throw new Error(`markFollowupAsCancelled: ${error.message}`);
  }

  return (data?.length ?? 0) > 0;
}

export async function cancelScheduledFollowupsForUser(userId: string, purpose?: string) {
  let query = supabaseAdmin
    .from("followups")
    .update({
      status: "cancelled"
    })
    .eq("user_id", userId)
    .eq("status", "scheduled");

  if (purpose) {
    query = query.eq("purpose", purpose);
  }

  const { data, error } = await query.select("id");
  if (error) {
    throw new Error(`cancelScheduledFollowupsForUser: ${error.message}`);
  }

  return data?.length ?? 0;
}

export async function getScheduledFollowupForUser(userId: string, purpose?: string): Promise<FollowupRecord | null> {
  let query = supabaseAdmin
    .from("followups")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .order("scheduled_for", { ascending: true })
    .limit(1);

  if (purpose) {
    query = query.eq("purpose", purpose);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`getScheduledFollowupForUser: ${error.message}`);
  }

  return (data as FollowupRecord | null) ?? null;
}

export async function hasUserReplyAfter(userId: string, sinceIso: string) {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "user")
    .gt("created_at", sinceIso)
    .limit(1);

  if (error) {
    throw new Error(`hasUserReplyAfter: ${error.message}`);
  }

  return (data?.length ?? 0) > 0;
}

export async function listSentFollowupTemplateKeys(userId: string, purpose: string, limit = 200) {
  const { data, error } = await supabaseAdmin
    .from("followups")
    .select("payload")
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`listSentFollowupTemplateKeys: ${error.message}`);
  }

  const keys: string[] = [];
  for (const row of data ?? []) {
    const payload = row.payload as Record<string, unknown> | null;
    const key =
      typeof payload?.templateKey === "string"
        ? payload.templateKey
        : typeof payload?.template_key === "string"
          ? payload.template_key
          : undefined;
    if (key) {
      keys.push(key);
    }
  }

  return keys;
}

export async function createHandoff(params: {
  userId: string;
  sessionId: string;
  riskEventId?: string;
  reason: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("handoffs")
    .insert({
      user_id: params.userId,
      session_id: params.sessionId,
      risk_event_id: params.riskEventId ?? null,
      reason: params.reason,
      status: "queued"
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`createHandoff: ${error.message}`);
  }

  return (data as { id: string }).id;
}

export async function writeAudit(params: {
  actorType: "system" | "human" | "user";
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("audits").insert({
    actor_type: params.actorType,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    metadata: params.metadata ?? {}
  });

  if (error) {
    throw new Error(`writeAudit: ${error.message}`);
  }
}

export async function listOpenRiskCases(limit = 50) {
  const { data, error } = await supabaseAdmin
    .from("risk_events")
    .select(
      "id, user_id, session_id, risk_level, trigger_reason, action_taken, status, created_at, resolved_at"
    )
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`listOpenRiskCases: ${error.message}`);
  }

  return data ?? [];
}

export async function getRiskCaseById(caseId: string) {
  const { data, error } = await supabaseAdmin
    .from("risk_events")
    .select("*")
    .eq("id", caseId)
    .single();

  if (error) {
    throw new Error(`getRiskCaseById: ${error.message}`);
  }

  return data;
}

export async function updateRiskCase(caseId: string, patch: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin
    .from("risk_events")
    .update(patch)
    .eq("id", caseId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`updateRiskCase: ${error.message}`);
  }

  return data;
}

export async function getLineIdentityByUserId(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("line_identities")
    .select("line_user_id")
    .eq("user_id", userId)
    .single();

  if (error) {
    throw new Error(`getLineIdentityByUserId: ${error.message}`);
  }

  return data as { line_user_id: string };
}

export async function getFollowupById(followupId: string): Promise<FollowupRecord> {
  const { data, error } = await supabaseAdmin.from("followups").select("*").eq("id", followupId).single();
  if (error) {
    throw new Error(`getFollowupById: ${error.message}`);
  }

  return data as FollowupRecord;
}
