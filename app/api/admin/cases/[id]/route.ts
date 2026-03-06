import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/config";
import { getRiskCaseById, updateRiskCase, writeAudit } from "@/lib/data/repositories";

export const runtime = "nodejs";

function authorize(request: Request) {
  const secret = request.headers.get("x-internal-secret");
  return secret === env.INTERNAL_API_SECRET;
}

const patchSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved"]),
  resolutionNote: z.string().max(2000).optional()
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const row = await getRiskCaseById(id);
  return NextResponse.json({
    ok: true,
    case: row
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
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

  const updated = await updateRiskCase(id, {
    status: parsed.data.status,
    resolution_note: parsed.data.resolutionNote ?? null,
    resolved_at: parsed.data.status === "resolved" ? new Date().toISOString() : null
  });

  await writeAudit({
    actorType: "human",
    action: "risk_case_updated",
    entityType: "risk_event",
    entityId: id,
    metadata: {
      status: parsed.data.status
    }
  });

  return NextResponse.json({
    ok: true,
    case: updated
  });
}
