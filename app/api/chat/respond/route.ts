import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/config";
import { processLineEvent } from "@/lib/chat/orchestrator";
import type { LineWebhookEvent } from "@/lib/line/types";

export const runtime = "nodejs";

const requestSchema = z.object({
  lineUserId: z.string().min(6),
  message: z.string().min(1).max(5000)
});

export async function POST(request: Request) {
  const secret = request.headers.get("x-internal-secret");
  if (secret !== env.INTERNAL_API_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
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

  const event: LineWebhookEvent = {
    type: "message",
    timestamp: Date.now(),
    source: {
      type: "user",
      userId: parsed.data.lineUserId
    },
    webhookEventId: `internal-${crypto.randomUUID()}`,
    replyToken: "internal",
    message: {
      id: crypto.randomUUID(),
      type: "text",
      text: parsed.data.message
    }
  };

  const result = await processLineEvent(event);
  return NextResponse.json({
    ok: true,
    result
  });
}
