import { Redis } from "@upstash/redis";
import { env } from "@/lib/config";

let redisClient: Redis | null = null;

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
