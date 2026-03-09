import { NextResponse } from "next/server";
import { z } from "zod";
import { getWebChatTrialStatus } from "@/lib/data/redis";

export const runtime = "nodejs";

const requestSchema = z.object({
  visitorId: z.string().regex(/^[a-zA-Z0-9_-]{12,120}$/)
});

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

  const gate = await getWebChatTrialStatus(parsed.data.visitorId);

  return NextResponse.json({
    ok: true,
    allowed: gate.allowed,
    limit: gate.limit,
    usedConversations: gate.usedTurns
  });
}
