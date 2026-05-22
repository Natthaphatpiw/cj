# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Thai-first mental-health support bot ("ChordJai") on LINE OA, served from a Next.js 15 App Router app on Node.js runtime. Stack: Supabase (system of record), Upstash Redis (idempotency / locks / rate limits / web-trial counters), Upstash Vector (topic similarity + memory), Upstash QStash (async/delayed jobs), xAI Grok via `ai`/`@ai-sdk/xai` (planner/topic/summary), OpenAI (non-consult classifier — heuristic fallback). The bot also exposes a web-widget trial that funnels users to LINE OA.

Note: `docs/lineoa-mental-health-architecture.md` still names Claude Sonnet 4.6 as the planner, but the live code uses Grok (`src/lib/llm/grok.ts`). Treat the doc as design context, not API truth.

## Commands

```bash
npm install
npm run dev            # next dev (port 3000)
npm run build          # next build
npm run start          # next start (after build)
npm run lint           # next lint (eslint-config-next)
supabase db push       # apply migrations in supabase/migrations/ (requires linked project)
```

No test runner is configured. There is no `.env.example` checked in — `src/lib/config.ts` is the source of truth for env vars and parses them with Zod at module load. Most secrets are required (`nonEmpty` schema), so the app will not start without a populated `.env.local`.

## Layout quirks

- `app/` is at the **repo root**, not under `src/`. The TS path alias `@/*` resolves to `./src/*`, so `@/lib/...` works but there is no `@/app/...`.
- All API routes pin `export const runtime = "nodejs"` because they use `node:crypto` (LINE signature, QStash verifier, web visitor hashing).
- `src/lib/config.ts` calls `serverSchema.parse(process.env)` at import. Any new env var must be added there, and `Next.js` will fail fast on misconfiguration.

## Hot-path architecture

The whole inbound turn is driven by **one orchestrator**: `processLineEvent` in `src/lib/chat/orchestrator.ts`. The webhook (`app/api/line/webhook/route.ts`), the internal test harness (`app/api/chat/respond/route.ts`), and the web widget (`app/api/web-chat/respond/route.ts`) all call this same function — the web widget synthesizes a `web_<sha256>`-prefixed fake LINE userId so it can share the LINE-shaped pipeline. **Keep the `LineWebhookEvent` contract and the `ProcessLineEventOptions` flags stable** when refactoring.

`processLineEvent` runs these steps in this exact order — each step can short-circuit:

1. Resolve/create user from `source.userId` (`resolveUserByLineId` in `repositories.ts`).
2. **Non-consult classifier** (`src/lib/classifier/openai.ts`). If route is `general_other` with confidence ≥ `NON_CONSULT_CLASSIFIER_MIN_CONFIDENCE`, the turn is routed to a `general_operator_handoff` session and the bot stops (optionally auto-acks). No LLM call.
3. **Topic boundary engine** (`src/lib/topic/engine.ts`) — deterministic action hints → explicit Thai/EN regex → time gap (`SESSION_HARD_RESET_HOURS`) → Upstash Vector similarity → Grok `resolveTopicWithGrok` as the last resort. Medium confidence returns a quick-reply "เปิดหัวข้อใหม่ / คุยต่อเรื่องเดิม" instead of replying.
4. Open/reuse session, persist the user message, cancel pending wellbeing follow-ups.
5. **Safety precheck** (`src/lib/safety/precheck.ts`, deterministic Thai/EN regex). `high`/`imminent` short-circuits: session → `crisis_locked`, risk event + handoff written, crisis template returned. The LLM is **never called** on a crisis turn.
6. **Structured-module shortcut** (`src/lib/modules/structured-modules.ts`) — short messages matching `breathing_3m`, `grounding_54321`, etc. get a canned reply and skip the LLM.
7. **Grok response planner** (`buildResponsePlanWithGrok`) returns structured JSON (`responsePlanSchema`). Failures throw `GrokPipelineError`, which the orchestrator converts into a friendly Thai/EN outage message, an `llm_pipeline_failed` audit, and a `safeTrackProductEvent` — never a 500 to LINE.
8. **Safety postcheck** (`src/lib/safety/postcheck.ts`) sanitizes the draft. **Crucial:** it strips markdown (`**`, headings, bullets, backticks, smart quotes) and awkward openers (`โอ้`, `ได้ยินแล้ว`, `เข้าใจเลย`). Do not coach the LLM to emit markdown — postcheck will eat it. The system prompt in `grok.ts` already enforces "no markdown, no checklists" and lists forbidden phrases in `avoid_phrases`.
9. **Low-disclosure guard**: if user message looks like a short greeting/mood-check and the draft opens with premature validation ("ขอบคุณที่เล่าให้ฟัง"…), the draft is replaced with a small invitation. See `isLowDisclosureMessage` / `buildLowDisclosureSafeReply`.
10. Persist assistant message → memory gate → schedule one wellbeing follow-up (deduped via `getScheduledFollowupForUser`) → enqueue `session_maintenance` QStash job → return `buildMainMenuQuickReply(text)`.

Both LLM endpoints use **strict JSON pipelines**: `parseStructuredJson` + Zod schemas in `src/lib/llm/schemas.ts`. Any new LLM call should follow the same pattern — throw `GrokPipelineError` on `request_failed | non_json | schema_mismatch` so the orchestrator's outage handler kicks in.

## Idempotency, locks, async

- **Webhook dedup**: `acquireDedupLock(eventId)` on the `webhookEventId` (or sha256 of the event if missing). TTL `WEBHOOK_DEDUP_TTL_SECONDS` (default 24h).
- **Per-user serialization**: `withSessionLock(lineUserId, …)` wraps each event. Throws "Concurrent session lock" — by design, LINE will redeliver.
- **Per-followup dedup**: `withFollowupSendLock` + `hasFollowupSentMarker` / `setFollowupSentMarker` ensures a follow-up is pushed at most once even under QStash retry.
- **Rate limiting**: `checkAndConsumeRateLimit` keyed by `line:rate:<userId>` (or `web_<visitorId>`), `RATE_LIMIT_MESSAGES_PER_MINUTE`.
- **LINE loading animation** is started for every message event and refreshed on `LINE_LOADING_REFRESH_SECONDS`; the keep-alive interval **must** be cleared in `finally`.

Cold path runs through **QStash → `/api/internal/followup`** with a discriminated-union payload (`followup_send | session_maintenance | daily_open_checkin_run`). Authorize either by `x-internal-secret` header or by `verifyQStashSignature`. The same route is used by an optional cron (daily 18:00) POSTing `{type:"daily_open_checkin_run"}`.

## Conventions worth following

- **App config**: never read `process.env` outside `src/lib/config.ts`; import `env` instead.
- **Feature flags** are env-driven booleans on `env` (`ENABLE_PUSH_FOLLOWUPS`, `ENABLE_DAILY_OPEN_CHECKIN`, `ENABLE_HUMAN_HANDOFF`, `ENABLE_NON_CONSULT_CLASSIFIER`, `NON_CONSULT_AUTO_ACK`). Default daily check-in is **off**.
- **Crisis triggers** live as regex arrays at the top of `src/lib/safety/precheck.ts`; add Thai patterns there, not at the LLM layer.
- **Quick replies**: every normal reply is wrapped with `buildMainMenuQuickReply` from `src/lib/line/messages.ts`. Topic-confirmation prompts use `buildTopicConfirmationMessage` with `action=new_topic` / `action=continue_topic` postback data — `parseActionHint` in the orchestrator reads those exact strings.
- **Memory writes** go through `evaluateMemoryWrite` (`src/lib/memory/gate.ts`): requires consent, drops `sensitivity: "high"`, requires content ≥ 12 chars, retention bounded by `USER_MEMORY_RETENTION_DAYS` and sensitivity.
- **Product events**: prefer `safeTrackProductEvent` (swallows + logs); never let analytics writes break the hot path.
- **Logging**: use the `logger` from `src/lib/logger.ts`. Levels gated by `LOG_LEVEL`.
- **Admin & internal routes** require `x-internal-secret: <INTERNAL_API_SECRET>`. The QStash callback also accepts `upstash-signature` verified by `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY`.

## Data model

Migrations live in `supabase/migrations/` (`0001_init.sql` for core domain — users, line_identities, conversations, sessions, messages, session_summaries, user_memories, risk_events, handoffs, followups, webhook_events, audits; `0002_product_growth_system.sql` for `product_events` + `user_engagement_profiles`). The `repositories.ts` module is the only place that talks to Supabase (`supabaseAdmin` is service-role). Session statuses: `active | dormant | closed | escalated | crisis_locked`. Risk levels: `low | medium | high | imminent`.
