import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/config";
import { runSessionMaintenanceJob, sendScheduledFollowup } from "@/lib/chat/orchestrator";
import { verifyQStashSignature } from "@/lib/data/qstash";
import { logger } from "@/lib/logger";
import { safeJsonParse } from "@/lib/utils/json";

export const runtime = "nodejs";

const payloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("followup_send"),
    followupId: z.string().uuid()
  }),
  z.object({
    type: z.literal("session_maintenance"),
    userId: z.string().uuid(),
    sessionId: z.string().uuid(),
    topicLabel: z.string().min(1)
  })
]);

async function authorize(request: Request, rawBody: string) {
  const internalSecret = request.headers.get("x-internal-secret");
  if (internalSecret === env.INTERNAL_API_SECRET) {
    return true;
  }

  const qstashSignature = request.headers.get("upstash-signature");
  if (!qstashSignature) {
    return false;
  }

  return verifyQStashSignature({
    signature: qstashSignature,
    body: rawBody,
    url: `${env.APP_BASE_URL}/api/internal/followup`
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const authorized = await authorize(request, rawBody);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = safeJsonParse<unknown>(rawBody);
  const parsed = payloadSchema.safeParse(body);
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

  if (parsed.data.type === "followup_send") {
    await sendScheduledFollowup(parsed.data.followupId);
    return NextResponse.json({ ok: true, type: parsed.data.type });
  }

  await runSessionMaintenanceJob({
    userId: parsed.data.userId,
    sessionId: parsed.data.sessionId,
    topicLabel: parsed.data.topicLabel
  });

  logger.info("Session maintenance done", {
    sessionId: parsed.data.sessionId
  });

  return NextResponse.json({
    ok: true,
    type: parsed.data.type
  });
}
