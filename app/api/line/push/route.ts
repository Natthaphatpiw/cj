import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/config";
import { pushMessage } from "@/lib/line/client";

export const runtime = "nodejs";

const payloadSchema = z.object({
  to: z.string().min(10),
  text: z.string().min(1).max(5000)
});

export async function POST(request: Request) {
  const secret = request.headers.get("x-internal-secret");
  if (secret !== env.INTERNAL_API_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
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

  await pushMessage(parsed.data.to, [
    {
      type: "text",
      text: parsed.data.text
    }
  ]);

  return NextResponse.json({ ok: true });
}
