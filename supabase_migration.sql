-- Jalankan file ini di Supabase SQL Editor.
-- Semua persistence aplikasi dipusatkan ke Supabase.

create extension if not exists pgcrypto;

create table if not exists soap_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_identity text not null,
  final_soap text not null,
  interpretation text,
  created_at timestamptz not null default now()
);

alter table soap_history enable row level security;

drop policy if exists "Users can view own history" on soap_history;
create policy "Users can view own history" on soap_history
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own history" on soap_history;
create policy "Users can insert own history" on soap_history
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete own history" on soap_history;
create policy "Users can delete own history" on soap_history
  for delete using (auth.uid() = user_id);

create index if not exists idx_soap_history_user_id on soap_history(user_id);
create index if not exists idx_soap_history_created_at on soap_history(created_at desc);

create table if not exists status_checks (
  id uuid primary key,
  client_name text not null,
  timestamp timestamptz not null default now()
);

create table if not exists whitelist_emails (
  email text primary key,
  expiry_datetime timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null
);

create table if not exists bypass_settings (
  key text primary key,
  is_active boolean not null default false,
  expiry_datetime timestamptz null,
  updated_at timestamptz not null default now()
);

insert into bypass_settings (key, is_active)
values ('global', false)
on conflict (key) do nothing;

create table if not exists password_attempts (
  client_id text primary key,
  attempts integer not null default 0,
  locked_until timestamptz null,
  reset_attempts integer not null default 0,
  last_attempt timestamptz null,
  last_reset timestamptz null
);

create table if not exists system_prompts (
  agent_id text primary key,
  prompt text not null,
  updated_at timestamptz not null default now()
);

create table if not exists user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status_generalis_template text null,
  updated_at timestamptz not null default now()
);

alter table user_preferences enable row level security;

drop policy if exists "Users can view own preferences" on user_preferences;
create policy "Users can view own preferences" on user_preferences
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own preferences" on user_preferences;
create policy "Users can insert own preferences" on user_preferences
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own preferences" on user_preferences;
create policy "Users can update own preferences" on user_preferences
  for update using (auth.uid() = user_id);
