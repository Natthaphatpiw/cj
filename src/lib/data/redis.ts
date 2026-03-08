import { Redis } from "@upstash/redis";
import { env } from "@/lib/config";

let redisClient: Redis | null = null;
const FOLLOWUP_SEND_LOCK_TTL_SECONDS = 180;
const FOLLOWUP_SENT_MARKER_TTL_SECONDS = 60 * 60 * 24 * 14;

function getRedis() {
  if (!redisClient) {
    if (!env.UPSTASH_REDIS_REST_URL.startsWith("https://")) {
      throw new Error("UPSTASH_REDIS_REST_URL is not configured correctly");
    }
    redisClient = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN
    });
  }
  return redisClient;
}

export async function acquireDedupLock(eventId: string) {
  const redis = getRedis();
  const key = `line:event:${eventId}`;
  const result = await redis.set(key, "1", {
    nx: true,
    ex: env.WEBHOOK_DEDUP_TTL_SECONDS
  });
  return result === "OK";
}

export async function checkAndConsumeRateLimit(userId: string) {
  const redis = getRedis();
  const key = `line:rate:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60);
  }

  return {
    allowed: count <= env.RATE_LIMIT_MESSAGES_PER_MINUTE,
    count
  };
}

export async function withSessionLock<T>(userId: string, handler: () => Promise<T>) {
  const redis = getRedis();
  const key = `line:lock:${userId}`;
  const lock = await redis.set(key, "1", {
    nx: true,
    ex: env.SESSION_LOCK_TTL_SECONDS
  });

  if (lock !== "OK") {
    throw new Error("Concurrent session lock");
  }

  try {
    return await handler();
  } finally {
    await redis.del(key);
  }
}

export async function withFollowupSendLock<T>(followupId: string, handler: () => Promise<T>) {
  const redis = getRedis();
  const key = `line:followup:lock:${followupId}`;
  const lock = await redis.set(key, "1", {
    nx: true,
    ex: FOLLOWUP_SEND_LOCK_TTL_SECONDS
  });

  if (lock !== "OK") {
    return null;
  }

  try {
    return await handler();
  } finally {
    await redis.del(key);
  }
}

export async function hasFollowupSentMarker(followupId: string) {
  const redis = getRedis();
  const key = `line:followup:sent:${followupId}`;
  const value = await redis.get<string | null>(key);
  return value === "1";
}

export async function setFollowupSentMarker(followupId: string) {
  const redis = getRedis();
  const key = `line:followup:sent:${followupId}`;
  await redis.set(key, "1", {
    ex: FOLLOWUP_SENT_MARKER_TTL_SECONDS
  });
}
