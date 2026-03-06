import { env } from "@/lib/config";

type Level = "debug" | "info" | "warn" | "error";

const levelWeight: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function canLog(level: Level) {
  return levelWeight[level] >= levelWeight[env.LOG_LEVEL];
}

function emit(level: Level, message: string, meta?: Record<string, unknown>) {
  if (!canLog(level)) {
    return;
  }

  const payload = {
    level,
    message,
    ts: new Date().toISOString(),
    ...meta
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === "warn") {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.log(JSON.stringify(payload));
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => emit("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => emit("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit("error", message, meta)
};
