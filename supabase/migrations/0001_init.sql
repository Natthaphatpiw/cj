create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  timezone text not null default 'Asia/Bangkok',
  language text not null default 'th',
  risk_baseline text not null default 'low' check (risk_baseline in ('low', 'medium', 'high', 'imminent')),
  memory_consent_status boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists line_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  line_user_id text not null unique,
  line_provider_id text,
  display_name_snapshot text,
  picture_url_snapshot text,
  language_snapshot text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_line_identities_user_id on line_identities(user_id);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  current_session_id uuid,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'dormant', 'closed', 'escalated', 'crisis_locked')),
  topic_label text not null default 'general_support',
  linked_prior_session_id uuid references sessions(id) on delete set null,
  risk_peak text not null default 'low' check (risk_peak in ('low', 'medium', 'high', 'imminent')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_sessions_user_status on sessions(user_id, status, opened_at desc);
create index if not exists idx_sessions_conversation on sessions(conversation_id, opened_at desc);

alter table conversations
  drop constraint if exists conversations_current_session_id_fkey;
alter table conversations
  add constraint conversations_current_session_id_fkey
  foreign key (current_session_id) references sessions(id) on delete set null;

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content_type text not null default 'text',
  content_text text not null,
  line_webhook_event_id text,
  line_message_id text,
  safety_label text,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_session_created on messages(session_id, created_at desc);
create index if not exists idx_messages_user_created on messages(user_id, created_at desc);

create table if not exists session_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_id uuid not null unique references sessions(id) on delete cascade,
  topic_label text not null,
  summary_text text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_session_summaries_user_updated on session_summaries(user_id, updated_at desc);

create table if not exists user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  memory_type text not null,
  content text not null,
  sensitivity text not null check (sensitivity in ('low', 'medium', 'high')),
  confidence double precision not null default 0.5,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_user_memories_user_updated on user_memories(user_id, updated_at desc);
create index if not exists idx_user_memories_expires on user_memories(expires_at);

create table if not exists risk_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'imminent')),
  trigger_reason text not null,
  action_taken text not null,
  requires_human_review boolean not null default false,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_risk_events_status_created on risk_events(status, created_at desc);
create index if not exists idx_risk_events_user_created on risk_events(user_id, created_at desc);

create table if not exists handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  risk_event_id uuid references risk_events(id) on delete set null,
  reason text not null,
  status text not null default 'queued' check (status in ('queued', 'accepted', 'closed')),
  assigned_to text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_handoffs_status_created on handoffs(status, created_at desc);

create table if not exists followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  scheduled_for timestamptz not null,
  purpose text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'failed', 'cancelled')),
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_followups_status_time on followups(status, scheduled_for asc);

create table if not exists audits (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('system', 'human', 'user')),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audits_entity on audits(entity_type, entity_id, created_at desc);

create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  webhook_event_id text not null unique,
  line_user_id text,
  payload jsonb not null,
  is_redelivery boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_webhook_events_line_user on webhook_events(line_user_id, created_at desc);

create or replace function set_updated_at_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at before update on users
for each row execute function set_updated_at_timestamp();

drop trigger if exists trg_conversations_updated_at on conversations;
create trigger trg_conversations_updated_at before update on conversations
for each row execute function set_updated_at_timestamp();

drop trigger if exists trg_handoffs_updated_at on handoffs;
create trigger trg_handoffs_updated_at before update on handoffs
for each row execute function set_updated_at_timestamp();
