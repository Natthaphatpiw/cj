import { NextResponse } from "next/server";
import { env } from "@/lib/config";

export const runtime = "nodejs";

function randomString(length = 24) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function GET() {
  if (!env.LINE_LOGIN_CHANNEL_ID || !env.LINE_LOGIN_REDIRECT_URI) {
    return NextResponse.json(
      {
        ok: false,
        error: "line_login_not_configured"
      },
      { status: 400 }
    );
  }

  const state = randomString();
  const nonce = randomString();
  const url = new URL("https://access.line.me/oauth2/v2.1/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.LINE_LOGIN_CHANNEL_ID);
  url.searchParams.set("redirect_uri", env.LINE_LOGIN_REDIRECT_URI);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "openid profile");
  url.searchParams.set("nonce", nonce);

  return NextResponse.json({
    ok: true,
    authUrl: url.toString(),
    state,
    nonce
  });
}
