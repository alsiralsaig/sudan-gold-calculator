create table if not exists public.app_users (
  id text primary key,
  email text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_user_data (
  user_id text primary key references public.app_users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_users enable row level security;
alter table public.app_user_data enable row level security;
-- The server uses the service role key; no public client policy is intentionally added.
