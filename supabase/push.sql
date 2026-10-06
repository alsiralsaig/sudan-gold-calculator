-- ============================================================
--  إشعارات Web Push (تظهر حتى لو التطبيق مقفول)
--  شغّل هذا الملف مرة واحدة في Supabase → SQL Editor
-- ============================================================

create table if not exists public.push_subscriptions (
  endpoint     text primary key,
  user_id      uuid not null,
  p256dh       text,
  auth         text,
  device       text default 'other',   -- ios | android | desktop | other
  user_agent   text default '',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- كل مستخدم يرى ويعدّل اشتراكات أجهزته فقط.
-- (السيرفر يرسل الإشعارات بمفتاح الخدمة service_role ويتجاوز RLS.)
drop policy if exists push_own_rows on public.push_subscriptions;
create policy push_own_rows on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
--  مطلوب أيضاً على السيرفر (Vercel → Settings → Environment Variables)
--    VAPID_PUBLIC_KEY       = المفتاح العام
--    VAPID_PRIVATE_KEY      = المفتاح الخاص
--    NEXT_PUBLIC_VAPID_PUBLIC_KEY = نفس المفتاح العام (اختياري)
--    VAPID_SUBJECT          = mailto:بريدك
--  توليد المفاتيح:
--    npx web-push generate-vapid-keys
-- ============================================================
