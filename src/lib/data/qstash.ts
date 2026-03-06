import { Client, Receiver } from "@upstash/qstash";
import { env } from "@/lib/config";

type PublishOptions = {
  url: string;
  body: Record<string, unknown>;
  delaySeconds?: number;
  deduplicationId?: string;
  forwardHeaders?: Record<string, string>;
};

function sanitizeDeduplicationId(value?: string) {
  if (!value) {
    return undefined;
  }

  const sanitized = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);

  return sanitized.length > 0 ? sanitized : undefined;
}

export async function publishQStashJob(options: PublishOptions) {
  const client = new Client({
    token: env.QSTASH_TOKEN
  });

  return client.publishJSON({
    url: options.url,
    body: options.body,
    delay: options.delaySeconds,
    deduplicationId: sanitizeDeduplicationId(options.deduplicationId),
    headers: options.forwardHeaders
  });
}

export async function verifyQStashSignature(params: {
  signature: string | null;
  body: string;
  url: string;
}) {
  if (!env.QSTASH_CURRENT_SIGNING_KEY || !params.signature) {
    return false;
  }

  const receiver = new Receiver({
    currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY
  });

  try {
    await receiver.verify({
      signature: params.signature,
      body: params.body,
      url: params.url
    });
    return true;
  } catch {
    return false;
  }
}
