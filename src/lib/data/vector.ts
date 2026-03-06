import { env } from "@/lib/config";
import { logger } from "@/lib/logger";
import { safeJsonParse } from "@/lib/utils/json";

type VectorSimilarityResult = {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
};

async function vectorRequest(path: string, body: Record<string, unknown>) {
  if (!env.UPSTASH_VECTOR_REST_URL.startsWith("https://")) {
    return null;
  }

  const response = await fetch(`${env.UPSTASH_VECTOR_REST_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.UPSTASH_VECTOR_REST_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    logger.warn("Upstash Vector request failed", {
      path,
      status: response.status,
      body: text
    });
    return null;
  }

  const text = await response.text();
  return safeJsonParse<Record<string, unknown>>(text);
}

export async function vectorQueryByText(
  text: string,
  topK = 3,
  namespace?: string
): Promise<VectorSimilarityResult[]> {
  const result = await vectorRequest("/query-data", {
    data: text,
    topK,
    includeMetadata: true,
    namespace: namespace ?? env.UPSTASH_VECTOR_NAMESPACE
  });

  if (!result || !Array.isArray(result.result)) {
    return [];
  }

  return result.result
    .map((item) => {
      const candidate = item as Record<string, unknown>;
      return {
        id: String(candidate.id ?? ""),
        score: Number(candidate.score ?? 0),
        metadata: (candidate.metadata as Record<string, unknown> | undefined) ?? {}
      };
    })
    .filter((item) => item.id.length > 0);
}

export async function vectorUpsertTextRecord(params: {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
  namespace?: string;
}) {
  await vectorRequest("/upsert-data", {
    namespace: params.namespace ?? env.UPSTASH_VECTOR_NAMESPACE,
    data: [
      {
        id: params.id,
        data: params.text,
        metadata: params.metadata ?? {}
      }
    ]
  });
}
