import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { processLineEvent } from "@/lib/chat/orchestrator";
import { checkAndConsumeRateLimit, consumeWebChatTrialTurn, getWebChatTrialStatus } from "@/lib/data/redis";
import type { LineMessage, LineWebhookEvent } from "@/lib/line/types";

export const runtime = "nodejs";

const requestSchema = z.object({
  visitorId: z.string().regex(/^[a-zA-Z0-9_-]{12,120}$/),
  conversationId: z.string().regex(/^[a-zA-Z0-9_-]{12,120}$/),
  locale: z.enum(["th", "en"]).default("th"),
  message: z.string().min(1).max(5000)
});

function buildWebLineUserId(visitorId: string, conversationId: string) {
  const digest = crypto.createHash("sha256").update(`${visitorId}:${conversationId}`).digest("hex");
  return `web_${digest.slice(0, 28)}`;
}

function extractTextReply(messages: LineMessage[]) {
  const texts = messages
    .map((message) => (message.type === "text" ? message.text.trim() : ""))
    .filter((message) => message.length > 0);

  if (texts.length === 0) {
    return null;
  }

  return texts.join("\n\n");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_payload",
        issues: parsed.error.issues
      },
      { status: 400 }
    );
  }

  const trialStatus = await getWebChatTrialStatus(parsed.data.visitorId);
  if (!trialStatus.allowed) {
    return NextResponse.json({
      ok: true,
      limited: true,
      usedConversations: trialStatus.usedTurns,
      conversationLimit: trialStatus.limit
    });
  }

  const rate = await checkAndConsumeRateLimit(`web_${parsed.data.visitorId}`);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        message:
          parsed.data.locale === "en"
            ? "Too many messages in a short time. Please wait a moment and try again."
            : "มีข้อความจำนวนมากในช่วงสั้น ๆ ขอพักสักครู่แล้วลองใหม่อีกครั้งนะครับ"
      },
      { status: 429 }
    );
  }

  const lineUserId = buildWebLineUserId(parsed.data.visitorId, parsed.data.conversationId);
  const event: LineWebhookEvent = {
    type: "message",
    timestamp: Date.now(),
    source: {
      type: "user",
      userId: lineUserId
    },
    webhookEventId: `web-${crypto.randomUUID()}`,
    message: {
      id: crypto.randomUUID(),
      type: "text",
      text: parsed.data.message.trim()
    }
  };

  const result = await processLineEvent(event, {
    disableFollowupScheduling: true,
    disableSessionMaintenance: true,
    profileSnapshot: {
      language: parsed.data.locale
    }
  });

  const replyText =
    extractTextReply(result.replyMessages) ??
    (parsed.data.locale === "en"
      ? "Thanks for reaching out. I am here with you."
      : "ขอบคุณที่ทักมานะ ผมอยู่ตรงนี้กับคุณเสมอ");

  const usageAfterReply = await consumeWebChatTrialTurn(parsed.data.visitorId);

  return NextResponse.json({
    ok: true,
    limited: false,
    reply: replyText,
    usedConversations: usageAfterReply.usedTurns,
    conversationLimit: usageAfterReply.limit
  });
}
