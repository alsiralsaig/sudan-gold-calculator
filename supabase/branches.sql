-- =========================================================
-- الفروع (Branches) — جدول Supabase لتعدد الفروع
-- نفّذ هذا الملف مرة واحدة في: Supabase Dashboard → SQL Editor
-- (آمن للتشغيل أكثر من مرة، ولا يمسّ البيانات الموجودة)
-- =========================================================

-- 1) الفروع: مرآة لجداول الفروع المحفوظة داخل بيانات الحساب
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

-- ربط بالحساب إن كان جدول المستخدمين موجوداً (نوع المعرّف text في هذا المشروع)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'app_users') then
    begin
      alter table public.branches
        add constraint branches_user_id_fkey
        foreign key (user_id) references public.app_users (id) on delete cascade;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

-- 2) الحماية: السيرفر يستخدم مفتاح service_role فقط، لا وصول مباشر من العميل
alter table public.branches enable row level security;

-- تحقق سريع بعد التنفيذ:
-- select id, name, code, archived, updated_at from public.branches order by updated_at desc limit 10;
