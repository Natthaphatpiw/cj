# LINE OA Mental Health SaaS (Next.js + Supabase + Upstash + Grok)

Production baseline for a Thai-first mental-health support bot on LINE OA with:

- Identity via `source.userId`
- Virtual sessions over LINE single-thread chat
- Topic boundary detection
- Multi-layer safety (pre-check, post-check, crisis mode, handoff lane)
- Follow-up jobs with QStash
- Admin case APIs for human review

## Services to open

Use free tiers where possible:

1. LINE Official Account + Messaging API
2. Supabase (free tier)
3. Upstash Redis (free tier)
4. Upstash Vector (free tier)
5. Upstash QStash / Workflow (free tier)
6. Upstash Search (optional, free tier)
7. Vercel Hobby or Cloudflare for hosting
8. Optional free tools: Sentry, PostHog, Cloudflare Turnstile

xAI Grok API is required and paid.
## Local setup

1. Install dependencies

```bash
npm install
```

2. Copy environment file and fill values

```bash
cp .env.example .env.local
```

3. Run Supabase migration

```bash
# with Supabase CLI linked to your project
supabase db push
```

4. Start dev server

```bash
npm run dev
```

## Main routes

- `POST /api/line/webhook`
- `POST /api/line/push` (internal)
- `POST /api/chat/respond` (internal test harness)
- `POST /api/internal/followup` (QStash/internal jobs)
- `POST /api/web-chat/respond` (web widget chat trial)
- `POST /api/web-chat/session` (web widget trial gate)
- `GET /api/admin/cases` (internal)
- `GET/PATCH /api/admin/cases/:id` (internal)
- `GET /api/auth/line/start` (optional)
- `GET /api/auth/line/callback` (optional)
- `GET /api/health`

Internal routes require header: `x-internal-secret: <INTERNAL_API_SECRET>`.

`/api/internal/followup` supports job payload types:

- `followup_send`
- `session_maintenance`
- `daily_open_checkin_run`

## Deploy checklist

1. Set LINE webhook URL to `/api/line/webhook`.
2. Add all environment variables from `.env.example`.
3. Set QStash callback target to `/api/internal/followup`.
4. (Optional) Configure a daily 18:00 job to POST `{"type":"daily_open_checkin_run"}` to `/api/internal/followup`.
5. Confirm LINE reply + push permissions.
6. Run load and crisis-path tests before launch.
