import { NextResponse } from "next/server";
import { env } from "@/lib/config";
import { listOpenRiskCases } from "@/lib/data/repositories";

export const runtime = "nodejs";

function authorize(request: Request) {
  const secret = request.headers.get("x-internal-secret");
  return secret === env.INTERNAL_API_SECRET;
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const rows = await listOpenRiskCases(100);
  return NextResponse.json({
    ok: true,
    count: rows.length,
    cases: rows
  });
}
