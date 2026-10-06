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

-- =========================================================
-- جدول الفروع (تعدد الفروع) — راجع supabase/branches.sql
-- =========================================================
create table if not exists public.branches (
  id text primary key,
  user_id text not null,
  name text not null,
  code text,
  phone text,
  address text,
  receipt_name text,
  notes text,
  archived boolean not null default false,
  created_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists branches_user_id_idx on public.branches (user_id);

alter table public.branches enable row level security;
