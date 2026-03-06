import { Receiver } from "@upstash/qstash";
import { env } from "@/lib/config";

type PublishOptions = {
  url: string;
  body: Record<string, unknown>;
  delaySeconds?: number;
  deduplicationId?: string;
  forwardHeaders?: Record<string, string>;
};

export async function publishQStashJob(options: PublishOptions) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.QSTASH_TOKEN}`,
    "Content-Type": "application/json"
  };

  if (options.deduplicationId) {
    headers["Upstash-Deduplication-Id"] = options.deduplicationId;
  }

  if (options.delaySeconds && options.delaySeconds > 0) {
    headers["Upstash-Delay"] = `${options.delaySeconds}s`;
  }

  if (options.forwardHeaders) {
    for (const [key, value] of Object.entries(options.forwardHeaders)) {
      headers[`Upstash-Forward-${key}`] = value;
    }
  }

  const encodedDestination = encodeURIComponent(options.url);
  const response = await fetch(`${env.QSTASH_API_BASE_URL}/publish/${encodedDestination}`, {
    method: "POST",
    headers,
    body: JSON.stringify(options.body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`QStash publish failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
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
