import { NextResponse } from "next/server";
import { env } from "@/lib/config";

export const runtime = "nodejs";

async function exchangeCode(code: string) {
  const form = new URLSearchParams();
  form.set("grant_type", "authorization_code");
  form.set("code", code);
  form.set("redirect_uri", env.LINE_LOGIN_REDIRECT_URI ?? "");
  form.set("client_id", env.LINE_LOGIN_CHANNEL_ID ?? "");
  form.set("client_secret", env.LINE_LOGIN_CHANNEL_SECRET ?? "");

  const response = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LINE Login token exchange failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

export async function GET(request: Request) {
  if (!env.LINE_LOGIN_CHANNEL_ID || !env.LINE_LOGIN_CHANNEL_SECRET || !env.LINE_LOGIN_REDIRECT_URI) {
    return NextResponse.json(
      {
        ok: false,
        error: "line_login_not_configured"
      },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error,
        detail: url.searchParams.get("error_description")
      },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json({ ok: false, error: "missing_code" }, { status: 400 });
  }

  const tokenData = await exchangeCode(code);
  return NextResponse.json({
    ok: true,
    state,
    tokenData
  });
}
