import { env } from "@/lib/config";
import {
  cancelScheduledFollowupsForUser,
  createFollowup,
  createHandoff,
  getActiveSession,
  getFollowupById,
  getScheduledFollowupForUser,
  getLineIdentityByUserId,
  hasUserReplyAfter,
  listSentFollowupTemplateKeys,
  listRecentMessages,
  listRecentSessionSummaries,
  listUserMemories,
  markFollowupAsCancelled,
  markFollowupAsSent,
  openSession,
  recordRiskEvent,
  resolveUserByLineId,
  saveMessage,
  saveSessionSummary,
  saveUserMemory,
  updateSessionState,
  writeAudit
} from "@/lib/data/repositories";
import { hasFollowupSentMarker, setFollowupSentMarker, withFollowupSendLock } from "@/lib/data/redis";
import { publishQStashJob } from "@/lib/data/qstash";
import { upsertSearchDocument } from "@/lib/data/search";
import { vectorUpsertTextRecord } from "@/lib/data/vector";
import { classifyIncomingUserText } from "@/lib/classifier/openai";
import {
  buildResponsePlanWithClaude,
  resolveTopicWithClaude,
  summarizeSessionWithClaude
} from "@/lib/llm/anthropic";
import { evaluateMemoryWrite } from "@/lib/memory/gate";
import { buildMainMenuQuickReply, buildTopicConfirmationMessage } from "@/lib/line/messages";
import { pushMessage } from "@/lib/line/client";
import type { LineMessage, LineWebhookEvent } from "@/lib/line/types";
import { logger } from "@/lib/logger";
import { pickWellbeingCheckinTemplate } from "@/lib/followup/checkin-messages";
import { buildCrisisMessage, runSafetyPrecheck } from "@/lib/safety/precheck";
import { runSafetyPostcheck } from "@/lib/safety/postcheck";
import { resolveTopicBoundary } from "@/lib/topic/engine";

type OrchestratorResult = {
  replyMessages: LineMessage[];
  shouldReply: boolean;
  handled: boolean;
};

const WELLBEING_FOLLOWUP_PURPOSE = "wellbeing_checkin";

function getTextFromEvent(event: LineWebhookEvent) {
  if (event.type === "message" && event.message?.type === "text") {
    return event.message.text?.trim() ?? "";
  }
  if (event.type === "postback" && event.postback?.data) {
    return event.postback.data;
  }
  return "";
}

function parseActionHint(event: LineWebhookEvent): "new_topic" | "continue_topic" | undefined {
  if (event.type !== "postback" || !event.postback?.data) {
    return undefined;
  }
  if (event.postback.data.includes("action=new_topic")) {
    return "new_topic";
  }
  if (event.postback.data.includes("action=continue_topic")) {
    return "continue_topic";
  }
  return undefined;
}

function crisisLabelFromRisk(risk: "high" | "imminent") {
  return risk === "imminent" ? "imminent_crisis_detected" : "high_risk_detected";
}

function userAsksImmediateAction(message: string) {
  return /ทำยังไง|ควรทำไง|ควรทำอย่างไร|ต้องทำอะไร|เริ่มจากอะไร|ทางออก|help/i.test(message);
}

function hasAcuteHardshipSignals(text: string) {
  return /รถชน|อุบัติเหตุ|ขาหัก|ไม่มีรายได้|นมผง|ลูกเล็ก|ทารก|หนี้|financial|debt/i.test(text);
}

function isMoodCheckTrigger(message: string) {
  return /เช็กอารมณ์วันนี้|เช็คอารมณ์วันนี้|mood\s*check|check[\s-]*in/i.test(message);
}

function isLowDisclosureMessage(message: string) {
  const trimmed = message.trim();
  if (!trimmed) {
    return true;
  }

  if (isMoodCheckTrigger(trimmed)) {
    return true;
  }

  const normalized = trimmed.toLowerCase();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const hasDisclosureSignals =
    /รู้สึก|เครียด|กังวล|ไม่ไหว|นอนไม่หลับ|เสียใจ|กลัว|โกรธ|ร้องไห้|โดน|เจ็บ|เหนื่อย|สับสน|stress|anxious|panic|depressed|sad/i.test(
      normalized
    );

  if (!hasDisclosureSignals && (tokens.length <= 7 || normalized.length <= 32)) {
    return true;
  }

  return false;
}

function hasPrematureValidationOpener(message: string) {
  const text = message.trim();
  return /^(ขอบคุณที่เล่าให้ฟัง|ขอบคุณที่ไว้ใจเล่า|ขอบคุณที่แชร์|เรื่องที่คุณกำลังเจอ|ดีใจที่คุณเล่า|ผมได้ยินแล้ว)/i.test(
    text
  );
}

function buildLowDisclosureSafeReply(userMessage: string) {
  if (isMoodCheckTrigger(userMessage)) {
    return "ได้เลย เราเช็กอารมณ์แบบสั้นๆ ตอนนี้กันนะ ตอนนี้อารมณ์ใกล้ข้อไหนที่สุด สงบ / กังวล / เครียด / เหนื่อย แล้วผมจะช่วยต่อให้ตรงกับที่คุณเป็นอยู่";
  }

  return "ผมอยู่ตรงนี้กับคุณนะ ถ้ายังไม่พร้อมเล่ายาวๆ พิมพ์สั้นๆ ได้เลย เช่น ตอนนี้เครียด เหนื่อย หรือสับสน เดี๋ยวผมช่วยค่อยๆ ต่อบทสนทนาให้";
}

function isRepetitiveSupportReply(candidate: string, recentMessages: Array<{ role: string; content_text: string }>) {
  const lastAssistant = [...recentMessages].reverse().find((message) => message.role === "assistant");
  if (!lastAssistant) {
    return false;
  }

  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
  const current = normalize(candidate);
  const previous = normalize(lastAssistant.content_text);

  if (current === previous) {
    return true;
  }

  return (
    current.includes("ตอนนี้อยากให้เราเริ่มแบบไหนดี") &&
    previous.includes("ตอนนี้อยากให้เราเริ่มแบบไหนดี")
  );
}

function hardshipImmediatePlanReply() {
  return (
    "ได้เลย เราโฟกัสแบบทำได้ตอนนี้ทันทีนะ ขั้นแรกโทร 1300 เพื่อขอประสานความช่วยเหลือฉุกเฉินเรื่องของจำเป็นสำหรับเด็กเล็ก ขั้นถัดไปโทรโรงพยาบาลที่รักษาเพื่อขอส่งต่อหน่วยสังคมสงเคราะห์ และขั้นสุดท้ายให้ผมช่วยร่างข้อความสั้นๆ ส่งหาคนใกล้ตัวเพื่อขอช่วยค่านมรอบนี้ก่อน\n\n" +
    "คุณไม่ได้ล้มเหลวเลยนะ ในสถานการณ์หนักขนาดนี้คุณยังพยายามเพื่อลูกเต็มที่มากแล้ว ตอนนี้อยากให้ผมเริ่มจากร่างข้อความขอความช่วยเหลือให้เลยไหม"
  );
}

async function enqueueFollowup(followupId: string, delayHours: number) {
  if (!env.ENABLE_PUSH_FOLLOWUPS) {
    return;
  }

  const delaySeconds = Math.max(300, Math.floor(delayHours * 3600));
  await publishQStashJob({
    url: `${env.APP_BASE_URL}/api/internal/followup`,
    body: {
      type: "followup_send",
      followupId
    },
    delaySeconds,
    deduplicationId: `followup-${followupId}`,
    forwardHeaders: {
      "x-internal-secret": env.INTERNAL_API_SECRET
    }
  });
}

async function enqueueSessionMaintenance(params: {
  userId: string;
  sessionId: string;
  topicLabel: string;
}) {
  await publishQStashJob({
    url: `${env.APP_BASE_URL}/api/internal/followup`,
    body: {
      type: "session_maintenance",
      userId: params.userId,
      sessionId: params.sessionId,
      topicLabel: params.topicLabel
    },
    deduplicationId: `maintenance-${params.sessionId}-${Date.now()}`,
    forwardHeaders: {
      "x-internal-secret": env.INTERNAL_API_SECRET
    }
  });
}

export async function processLineEvent(event: LineWebhookEvent): Promise<OrchestratorResult> {
  if (event.source.type !== "user" || !event.source.userId) {
    return {
      shouldReply: false,
      handled: false,
      replyMessages: []
    };
  }

  const actionHint = parseActionHint(event);
  const userText = getTextFromEvent(event);
  if (!userText) {
    return {
      shouldReply: true,
      handled: true,
      replyMessages: [
        buildMainMenuQuickReply("ตอนนี้ผมรองรับข้อความตัวอักษรเป็นหลัก คุณสามารถพิมพ์เล่าได้เลยครับ")
      ]
    };
  }

  const lineUserId = event.source.userId;
  const user = await resolveUserByLineId(lineUserId);
  const activeSession = await getActiveSession(user.id);

  const inputClassification = await classifyIncomingUserText(userText);
  const shouldRouteToHumanOnly =
    inputClassification.route === "general_other" &&
    inputClassification.confidence >= env.NON_CONSULT_CLASSIFIER_MIN_CONFIDENCE;

  if (shouldRouteToHumanOnly) {
    const targetSession =
      activeSession && activeSession.topic_label === "general_operator_handoff"
        ? activeSession
        : await openSession({
            userId: user.id,
            topicLabel: "general_operator_handoff",
            linkedPriorSessionId: activeSession?.id
          });

    await saveMessage({
      userId: user.id,
      sessionId: targetSession.id,
      role: "user",
      contentType: "text",
      contentText: userText,
      lineWebhookEventId: event.webhookEventId,
      lineMessageId: event.message?.id
    });
    await cancelScheduledFollowupsForUser(user.id, WELLBEING_FOLLOWUP_PURPOSE);

    await writeAudit({
      actorType: "system",
      action: "non_consultation_routed_to_human",
      entityType: "session",
      entityId: targetSession.id,
      metadata: {
        route: inputClassification.route,
        confidence: inputClassification.confidence,
        reason: inputClassification.reason,
        source: inputClassification.source
      }
    });

    if (env.NON_CONSULT_AUTO_ACK) {
      await saveMessage({
        userId: user.id,
        sessionId: targetSession.id,
        role: "assistant",
        contentType: "text",
        contentText: env.NON_CONSULT_ACK_MESSAGE
      });

      return {
        shouldReply: true,
        handled: true,
        replyMessages: [
          {
            type: "text",
            text: env.NON_CONSULT_ACK_MESSAGE
          }
        ]
      };
    }

    return {
      shouldReply: false,
      handled: true,
      replyMessages: []
    };
  }

  const recentSummaries = await listRecentSessionSummaries(user.id, 5);

  const topicDecision = await resolveTopicBoundary({
    message: userText,
    actionHint,
    activeSession,
    recentSummaries,
    llmResolver: resolveTopicWithClaude
  });

  if (topicDecision.needsUserConfirmation) {
    const confirmation = buildTopicConfirmationMessage(
      "ฟังดูเหมือนเป็นอีกเรื่องจากที่เราคุยก่อนหน้า ต้องการเปิดหัวข้อใหม่ไหมครับ"
    );
    return {
      shouldReply: true,
      handled: true,
      replyMessages: [confirmation]
    };
  }

  const targetSession =
    topicDecision.shouldOpenNewSession || !activeSession
      ? await openSession({
          userId: user.id,
          topicLabel: topicDecision.topicLabel,
          linkedPriorSessionId: activeSession?.id
        })
      : activeSession;

  if (!targetSession) {
    throw new Error("No target session available");
  }

  await saveMessage({
    userId: user.id,
    sessionId: targetSession.id,
    role: "user",
    contentType: "text",
    contentText: userText,
    lineWebhookEventId: event.webhookEventId,
    lineMessageId: event.message?.id
  });
  await cancelScheduledFollowupsForUser(user.id, WELLBEING_FOLLOWUP_PURPOSE);

  const precheck = runSafetyPrecheck(userText);
  if (precheck.riskLevel === "high" || precheck.riskLevel === "imminent") {
    await updateSessionState({
      sessionId: targetSession.id,
      status: "crisis_locked",
      riskPeak: precheck.riskLevel
    });

    const riskEventId = await recordRiskEvent({
      userId: user.id,
      sessionId: targetSession.id,
      riskLevel: precheck.riskLevel,
      triggerReason: precheck.reasonCodes.join(","),
      actionTaken: "crisis_template",
      requiresHumanReview: true
    });

    if (env.ENABLE_HUMAN_HANDOFF) {
      await createHandoff({
        userId: user.id,
        sessionId: targetSession.id,
        riskEventId,
        reason: crisisLabelFromRisk(precheck.riskLevel)
      });
    }

    const crisisMessages = buildCrisisMessage();
    await saveMessage({
      userId: user.id,
      sessionId: targetSession.id,
      role: "assistant",
      contentType: "text",
      contentText: crisisMessages.map((message) => message.text).join("\n"),
      safetyLabel: precheck.riskLevel
    });

    return {
      shouldReply: true,
      handled: true,
      replyMessages: crisisMessages
    };
  }

  const recentMessages = await listRecentMessages(targetSession.id, 12);
  const userMemories = await listUserMemories(user.id, 8);

  const plan = await buildResponsePlanWithClaude({
    message: userText,
    locale: user.language,
    riskLevel: precheck.riskLevel,
    topicLabel: targetSession.topic_label,
    recentMessages: recentMessages.map((message) => ({
      role: message.role,
      text: message.content_text
    })),
    userMemories: userMemories.map((memory) => ({
      type: memory.memory_type,
      content: memory.content
    })),
    productBoundary: {
      crisisPrimaryLabel: env.CRISIS_PRIMARY_LABEL,
      crisisPhone: env.CRISIS_PRIMARY_PHONE,
      emergencyNumber: env.CRISIS_EMERGENCY_NUMBER
    }
  });

  const postcheck = runSafetyPostcheck(plan, precheck.riskLevel);
  let outgoingText = postcheck.plan.messageDraft;
  const contextCorpus = [userText, ...recentMessages.map((message) => message.content_text)].join(" ");
  if (
    userAsksImmediateAction(userText) &&
    hasAcuteHardshipSignals(contextCorpus) &&
    isRepetitiveSupportReply(outgoingText, recentMessages)
  ) {
    outgoingText = hardshipImmediatePlanReply();
  }
  if (isLowDisclosureMessage(userText) && hasPrematureValidationOpener(outgoingText)) {
    outgoingText = buildLowDisclosureSafeReply(userText);
  }

  await saveMessage({
    userId: user.id,
    sessionId: targetSession.id,
    role: "assistant",
    contentType: "text",
    contentText: outgoingText,
    safetyLabel: postcheck.plan.riskLevel
  });

  if (postcheck.plan.riskLevel === "medium") {
    await recordRiskEvent({
      userId: user.id,
      sessionId: targetSession.id,
      riskLevel: "medium",
      triggerReason: precheck.reasonCodes.join(","),
      actionTaken: "supportive_response",
      requiresHumanReview: false
    });
  }

  const memoryDecision = evaluateMemoryWrite({
    plan: postcheck.plan,
    memoryConsent: user.memory_consent_status
  });

  if (memoryDecision.shouldWrite && memoryDecision.content && memoryDecision.memoryType) {
    const expiresAt = new Date(Date.now() + (memoryDecision.retentionDays ?? 90) * 86400000).toISOString();
    await saveUserMemory({
      userId: user.id,
      memoryType: memoryDecision.memoryType,
      content: memoryDecision.content,
      sensitivity: memoryDecision.sensitivity ?? "low",
      confidence: 0.8,
      expiresAt
    });
  }

  if (postcheck.plan.shouldScheduleFollowup) {
    const existing = await getScheduledFollowupForUser(user.id, WELLBEING_FOLLOWUP_PURPOSE);
    if (!existing) {
      const delay = Math.max(6, postcheck.plan.followupDelayHours ?? 18);
      const scheduledFor = new Date(Date.now() + delay * 3600000).toISOString();
      const sentTemplateKeys = await listSentFollowupTemplateKeys(user.id, WELLBEING_FOLLOWUP_PURPOSE);
      const template = pickWellbeingCheckinTemplate({
        usedKeys: sentTemplateKeys,
        lastKey: sentTemplateKeys[0]
      });
      const followupId = await createFollowup({
        userId: user.id,
        sessionId: targetSession.id,
        scheduledFor,
        purpose: WELLBEING_FOLLOWUP_PURPOSE,
        payload: {
          templateKey: template.key,
          text: template.text
        }
      });
      await enqueueFollowup(followupId, delay);
    } else {
      logger.info("Skipped followup scheduling because one is already pending", {
        userId: user.id,
        followupId: existing.id
      });
    }
  }

  await writeAudit({
    actorType: "system",
    action: "chat_turn_processed",
    entityType: "session",
    entityId: targetSession.id,
    metadata: {
      topicDecision,
      riskLevel: postcheck.plan.riskLevel
    }
  });

  await enqueueSessionMaintenance({
    userId: user.id,
    sessionId: targetSession.id,
    topicLabel: targetSession.topic_label
  });

  const response = buildMainMenuQuickReply(outgoingText);
  return {
    shouldReply: true,
    handled: true,
    replyMessages: [response]
  };
}

export async function runSessionMaintenanceJob(params: {
  userId: string;
  sessionId: string;
  topicLabel: string;
}) {
  const messages = await listRecentMessages(params.sessionId, 16);
  if (messages.length < 4) {
    return;
  }

  const summary = await summarizeSessionWithClaude({
    topicLabel: params.topicLabel,
    recentMessages: messages.map((message) => ({
      role: message.role,
      text: message.content_text
    }))
  });

  const summaryText = summary.summaryText;
  await saveSessionSummary({
    userId: params.userId,
    sessionId: params.sessionId,
    topicLabel: summary.topicLabel,
    summaryText
  });

  await vectorUpsertTextRecord({
    id: `session:${params.sessionId}`,
    text: summaryText,
    metadata: {
      user_id: params.userId,
      session_id: params.sessionId,
      topic_label: summary.topicLabel,
      unresolved_items: summary.unresolvedItems
    }
  });

  await upsertSearchDocument({
    id: `session:${params.sessionId}`,
    user_id: params.userId,
    session_id: params.sessionId,
    topic_label: summary.topicLabel,
    summary_text: summaryText,
    unresolved_items: summary.unresolvedItems,
    updated_at: new Date().toISOString()
  });
}

export async function sendScheduledFollowup(followupId: string) {
  const lockResult = await withFollowupSendLock(followupId, async () => {
    const followup = await getFollowupById(followupId);
    if (followup.status !== "scheduled") {
      logger.info("Skipped followup send because status is not scheduled", {
        followupId,
        status: followup.status
      });
      return;
    }

    const hasReplyAfterCreated = await hasUserReplyAfter(followup.user_id, followup.created_at);
    if (hasReplyAfterCreated) {
      await markFollowupAsCancelled(followupId);
      logger.info("Cancelled followup because user already replied", {
        followupId
      });
      return;
    }

    const alreadySent = await hasFollowupSentMarker(followupId);
    if (alreadySent) {
      await markFollowupAsSent(followupId);
      logger.warn("Followup had sent marker, skipped duplicate push", {
        followupId
      });
      return;
    }

    const resolveIdentity = await getLineIdentityByUserId(followup.user_id);
    const payloadText =
      typeof followup.payload?.text === "string"
        ? followup.payload.text
        : "ขอเช็กอินสั้นๆ ตอนนี้คุณโอเคขึ้นไหมครับ";

    await pushMessage(resolveIdentity.line_user_id, [buildMainMenuQuickReply(payloadText)]);
    await setFollowupSentMarker(followupId);
    const marked = await markFollowupAsSent(followupId);

    logger.info("Followup sent", {
      followupId,
      marked
    });
  });

  if (lockResult === null) {
    logger.info("Skipped followup send because lock is already held", {
      followupId
    });
  }
}
