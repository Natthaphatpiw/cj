import { env } from "@/lib/config";
import { logger } from "@/lib/logger";
import { safeJsonParse } from "@/lib/utils/json";

async function searchRequest(path: string, body: Record<string, unknown>) {
  if (!env.UPSTASH_SEARCH_REST_URL || !env.UPSTASH_SEARCH_REST_TOKEN) {
    return null;
  }

  const response = await fetch(`${env.UPSTASH_SEARCH_REST_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.UPSTASH_SEARCH_REST_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    logger.warn("Upstash Search request failed", {
      path,
      status: response.status,
      body: text
    });
    return null;
  }

  const text = await response.text();
  return safeJsonParse<Record<string, unknown>>(text);
}

export async function upsertSearchDocument(document: Record<string, unknown>) {
  if (!env.UPSTASH_SEARCH_REST_URL || !env.UPSTASH_SEARCH_REST_TOKEN) {
    return;
  }

  await searchRequest(`/indexes/${env.UPSTASH_SEARCH_INDEX_NAME}/docs`, {
    docs: [document]
  });
}

export async function searchSessionSummaries(query: string, limit = 10) {
  if (!env.UPSTASH_SEARCH_REST_URL || !env.UPSTASH_SEARCH_REST_TOKEN) {
    return [];
  }

  const result = await searchRequest(`/indexes/${env.UPSTASH_SEARCH_INDEX_NAME}/search`, {
    query,
    topK: limit
  });

  if (!result || !Array.isArray(result.results)) {
    return [];
  }

  return result.results as Array<Record<string, unknown>>;
}
