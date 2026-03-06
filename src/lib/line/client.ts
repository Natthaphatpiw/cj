import { env } from "@/lib/config";
import type { LineMessage } from "@/lib/line/types";
import { logger } from "@/lib/logger";

const baseUrl = "https://api.line.me/v2/bot";

async function lineRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LINE API ${path} failed (${response.status}): ${text}`);
  }
}

export async function replyMessage(replyToken: string, messages: LineMessage[]) {
  await lineRequest("/message/reply", {
    replyToken,
    messages
  });
}

export async function pushMessage(to: string, messages: LineMessage[]) {
  if (!env.LINE_ENABLE_PUSH) {
    logger.warn("LINE push disabled by configuration", { to });
    return;
  }

  await lineRequest("/message/push", {
    to,
    messages
  });
}

export async function fetchLineProfile(userId: string) {
  const response = await fetch(`${baseUrl}/profile/${userId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    logger.warn("Unable to fetch LINE profile", {
      userId,
      status: response.status,
      body: text
    });
    return null;
  }

  return (await response.json()) as {
    userId: string;
    displayName?: string;
    pictureUrl?: string;
    statusMessage?: string;
    language?: string;
  };
}
