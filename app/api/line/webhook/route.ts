import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/config";
import { processLineEvent } from "@/lib/chat/orchestrator";
import { acquireDedupLock, checkAndConsumeRateLimit, withSessionLock } from "@/lib/data/redis";
import { recordWebhookEvent } from "@/lib/data/repositories";
import { replyMessage, tryDisplayLoadingAnimation } from "@/lib/line/client";
import { verifyLineSignature } from "@/lib/line/signature";
import type { LineWebhookEvent, LineWebhookPayload } from "@/lib/line/types";
import { logger } from "@/lib/logger";
import { safeJsonParse } from "@/lib/utils/json";

export const runtime = "nodejs";

function deriveEventId(event: LineWebhookEvent) {
  if (event.webhookEventId) {
    return event.webhookEventId;
  }
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(event))
    .digest("hex");
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");
  const valid = verifyLineSignature(rawBody, signature);
  if (!valid) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  const payload = safeJsonParse<LineWebhookPayload>(rawBody);
  if (!payload || !Array.isArray(payload.events)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  for (const event of payload.events) {
    const eventId = deriveEventId(event);
    const isOneOnOneChat = event.source.type === "user" && Boolean(event.source.userId);
    const lineUserId = isOneOnOneChat ? event.source.userId : undefined;

    try {
      const lock = await acquireDedupLock(eventId);
      if (!lock) {
        logger.info("Duplicate LINE event skipped", { eventId });
        continue;
      }

      await recordWebhookEvent({
        webhookEventId: eventId,
        lineUserId: event.source.userId ?? null,
        payload: event as unknown as Record<string, unknown>,
        isRedelivery: Boolean(event.deliveryContext?.isRedelivery)
      });

      if (lineUserId) {
        const rate = await checkAndConsumeRateLimit(lineUserId);
        if (!rate.allowed) {
          if (event.replyToken) {
            await replyMessage(event.replyToken, [
              {
                type: "text",
                text: "ตอนนี้มีข้อความจำนวนมากในช่วงสั้น ๆ ขอพักสักครู่แล้วลองส่งใหม่อีกครั้งนะครับ"
              }
            ]);
          }
          continue;
        }
      }

      let loadingKeepAlive: ReturnType<typeof setInterval> | null = null;
      if (lineUserId && event.type === "message") {
        await tryDisplayLoadingAnimation(lineUserId, env.LINE_LOADING_SECONDS);
        loadingKeepAlive = setInterval(() => {
          void tryDisplayLoadingAnimation(lineUserId, env.LINE_LOADING_SECONDS);
        }, env.LINE_LOADING_REFRESH_SECONDS * 1000);
      }

      const handle = async () => {
        const result = await processLineEvent(event);
        if (result.shouldReply && event.replyToken) {
          await replyMessage(event.replyToken, result.replyMessages);
        }
      };

      try {
        if (lineUserId) {
          await withSessionLock(lineUserId, handle);
        } else {
          await handle();
        }
      } finally {
        if (loadingKeepAlive) {
          clearInterval(loadingKeepAlive);
        }
      }
    } catch (error) {
      logger.error("Webhook event processing failed", {
        eventId,
        error: error instanceof Error ? error.message : "unknown_error"
      });

      if (event.replyToken) {
        try {
          await replyMessage(event.replyToken, [
            {
              type: "text",
              text: `ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งใน 1-2 นาทีได้เลยครับ`
            }
          ]);
        } catch (replyError) {
          logger.error("Failed to send fallback LINE reply", {
            eventId,
            error: replyError instanceof Error ? replyError.message : "unknown_error"
          });
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    env: env.APP_ENV
  });
}
