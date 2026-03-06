import { z } from "zod";

const trueFalse = z.enum(["true", "false"]).transform((value) => value === "true");
const nonEmpty = z.string().min(1).default("__MISSING__");
const loadingSecondsSchema = z
  .coerce
  .number()
  .int()
  .min(5)
  .max(60)
  .default(20);
const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional()
);
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional()
);

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.string().default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  APP_TIMEZONE: z.string().default("Asia/Bangkok"),
  DEFAULT_LOCALE: z.string().default("th"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  INTERNAL_API_SECRET: nonEmpty,
  PII_ENCRYPTION_KEY: nonEmpty,
  PII_HASH_SALT: nonEmpty,
  ADMIN_EMAIL_ALLOWLIST: z.string().default(""),
  LINE_CHANNEL_ID: nonEmpty,
  LINE_CHANNEL_SECRET: nonEmpty,
  LINE_CHANNEL_ACCESS_TOKEN: nonEmpty,
  LINE_RICH_MENU_DEFAULT_ID: optionalString,
  LINE_RICH_MENU_CRISIS_ID: optionalString,
  LINE_ENABLE_PUSH: trueFalse.default(true),
  LINE_ENABLE_RICH_MENU: trueFalse.default(true),
  LINE_ENABLE_LOADING_ANIMATION: trueFalse.default(true),
  LINE_LOADING_SECONDS: loadingSecondsSchema,
  LINE_LOGIN_CHANNEL_ID: optionalString,
  LINE_LOGIN_CHANNEL_SECRET: optionalString,
  LINE_LOGIN_REDIRECT_URI: optionalUrl,
  LIFF_ID: optionalString,
  NEXT_PUBLIC_LIFF_ID: optionalString,
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default("https://example.supabase.co"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: nonEmpty,
  SUPABASE_SERVICE_ROLE_KEY: nonEmpty,
  DATABASE_URL: nonEmpty,
  SUPABASE_STORAGE_BUCKET_ATTACHMENTS: z.string().default("attachments"),
  SUPABASE_STORAGE_BUCKET_PRIVATE_MEDIA: z.string().default("private-media"),
  SUPABASE_STORAGE_BUCKET_EXPORTS: z.string().default("exports"),
  ANTHROPIC_API_KEY: nonEmpty,
  ANTHROPIC_API_BASE_URL: z.string().url().default("https://api.anthropic.com"),
  ANTHROPIC_API_VERSION: z.string().default("2023-06-01"),
  ANTHROPIC_MODEL_PRIMARY: z.string().default("claude-sonnet-4-6"),
  ANTHROPIC_MODEL_SAFETY: z.string().default("claude-sonnet-4-6"),
  ANTHROPIC_MODEL_TOPIC: z.string().default("claude-sonnet-4-6"),
  ANTHROPIC_MODEL_SUMMARY: z.string().default("claude-sonnet-4-6"),
  ANTHROPIC_MODEL_FALLBACK: z.string().default("claude-sonnet-4-5"),
  ANTHROPIC_ENABLE_EXTENDED_THINKING: trueFalse.default(true),
  ANTHROPIC_THINKING_EFFORT: z.enum(["low", "medium", "high"]).default("medium"),
  ANTHROPIC_CONTEXT_WINDOW_BETA: optionalString,
  UPSTASH_REDIS_REST_URL: nonEmpty,
  UPSTASH_REDIS_REST_TOKEN: nonEmpty,
  WEBHOOK_DEDUP_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  RATE_LIMIT_MESSAGES_PER_MINUTE: z.coerce.number().int().positive().default(20),
  SESSION_LOCK_TTL_SECONDS: z.coerce.number().int().positive().default(30),
  UPSTASH_VECTOR_REST_URL: nonEmpty,
  UPSTASH_VECTOR_REST_TOKEN: nonEmpty,
  UPSTASH_VECTOR_NAMESPACE: z.string().default("session-memory"),
  TOPIC_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.68),
  MEMORY_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.76),
  UPSTASH_SEARCH_REST_URL: optionalString,
  UPSTASH_SEARCH_REST_TOKEN: optionalString,
  UPSTASH_SEARCH_INDEX_NAME: z.string().default("session-summaries"),
  ENABLE_HYBRID_SEARCH: trueFalse.default(true),
  QSTASH_TOKEN: nonEmpty,
  QSTASH_CURRENT_SIGNING_KEY: optionalString,
  QSTASH_NEXT_SIGNING_KEY: optionalString,
  QSTASH_API_BASE_URL: z.string().url().default("https://qstash.upstash.io/v2"),
  ENABLE_PUSH_FOLLOWUPS: trueFalse.default(true),
  ENABLE_HUMAN_HANDOFF: trueFalse.default(true),
  MENTAL_HEALTH_COUNTRY: z.string().default("TH"),
  CRISIS_PRIMARY_LABEL: z.string().default("สายด่วนสุขภาพจิต"),
  CRISIS_PRIMARY_PHONE: z.string().default("1323"),
  CRISIS_EMERGENCY_NUMBER: z.string().default("191"),
  RAW_MESSAGE_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  SESSION_SUMMARY_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
  USER_MEMORY_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  SESSION_IDLE_MINUTES: z.coerce.number().int().positive().default(480),
  SESSION_HARD_RESET_HOURS: z.coerce.number().int().positive().default(72),
  NEW_TOPIC_CONFIDENCE_CONFIRM_MIN: z.coerce.number().min(0).max(1).default(0.55),
  NEW_TOPIC_CONFIDENCE_AUTO_OPEN_MIN: z.coerce.number().min(0).max(1).default(0.8),
  HIGH_RISK_REVIEW_WINDOW_MINUTES: z.coerce.number().int().positive().default(30),
  SENTRY_DSN: optionalString,
  SENTRY_ENVIRONMENT: z.string().default("development"),
  POSTHOG_KEY: optionalString,
  POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.string().default("th"),
  NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID: optionalString,
  NEXT_PUBLIC_ENABLE_LINE_LOGIN: trueFalse.default(false),
  NEXT_PUBLIC_SENTRY_DSN: optionalString,
  NEXT_PUBLIC_POSTHOG_KEY: optionalString,
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalString,
  TURNSTILE_SECRET_KEY: optionalString
});

const parsed = serverSchema.parse(process.env);
export const env = parsed;

export function isProduction() {
  return env.NODE_ENV === "production";
}
