create table if not exists product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  session_id uuid references sessions(id) on delete set null,
  channel text not null default 'line_oa' check (channel in ('line_oa', 'web_widget', 'system')),
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_events_event_created on product_events(event_name, created_at desc);
create index if not exists idx_product_events_user_created on product_events(user_id, created_at desc);
create index if not exists idx_product_events_channel_created on product_events(channel, created_at desc);

create table if not exists user_engagement_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  preferred_modules text[] not null default '{}'::text[],
  preferred_checkin_hour smallint check (preferred_checkin_hour between 0 and 23),
  checkin_frequency text not null default 'adaptive' check (checkin_frequency in ('off', 'adaptive', 'daily', 'twice_weekly')),
  checkin_opt_out boolean not null default false,
  last_daily_checkin_at timestamptz,
  trust_score numeric(5,2) not null default 0,
  engagement_score numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_engagement_profiles_checkin on user_engagement_profiles(checkin_opt_out, checkin_frequency);

drop trigger if exists trg_user_engagement_profiles_updated_at on user_engagement_profiles;
create trigger trg_user_engagement_profiles_updated_at before update on user_engagement_profiles
for each row execute function set_updated_at_timestamp();
