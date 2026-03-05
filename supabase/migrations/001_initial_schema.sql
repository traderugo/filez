-- Station Portal: Initial Schema
-- Run in Supabase SQL Editor

-- 1. Users (profile extension of auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  phone text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- Users can read/update their own row
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

-- Admins can read all users
create policy "admins_select_all_users" on public.users
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- Allow insert during registration (user creates own profile)
create policy "users_insert_own" on public.users
  for insert with check (auth.uid() = id);

-- 2. Subscriptions
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'revoked')),
  payment_reference text,
  proof_url text,
  start_date date,
  end_date date,
  renewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create index idx_subscriptions_user_id on public.subscriptions(user_id);
create index idx_subscriptions_status on public.subscriptions(status);

-- Users can read their own subscriptions
create policy "subs_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Users can insert their own subscriptions
create policy "subs_insert_own" on public.subscriptions
  for insert with check (auth.uid() = user_id);

-- Admins can read all subscriptions
create policy "admins_select_all_subs" on public.subscriptions
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- Admins can update any subscription (approve/reject)
create policy "admins_update_all_subs" on public.subscriptions
  for update using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- 3. User Files (admin assigns OneDrive links to users)
create table public.user_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  file_name text not null,
  share_link text not null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.user_files enable row level security;

create index idx_user_files_user_id on public.user_files(user_id);

-- Users can read their own files
create policy "files_select_own" on public.user_files
  for select using (auth.uid() = user_id);

-- Admins can do everything with files
create policy "admins_select_all_files" on public.user_files
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "admins_insert_files" on public.user_files
  for insert with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "admins_update_files" on public.user_files
  for update using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "admins_delete_files" on public.user_files
  for delete using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- 4. Feedback
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  message text not null,
  rating int not null check (rating >= 1 and rating <= 5),
  submitted_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Users can insert their own feedback
create policy "feedback_insert_own" on public.feedback
  for insert with check (auth.uid() = user_id);

-- Users can read their own feedback
create policy "feedback_select_own" on public.feedback
  for select using (auth.uid() = user_id);

-- Admins can read all feedback
create policy "admins_select_all_feedback" on public.feedback
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- 5. Supabase Storage bucket for subscription proofs
insert into storage.buckets (id, name, public)
values ('subscription-proofs', 'subscription-proofs', false)
on conflict (id) do nothing;

-- Users can upload to their own folder
create policy "proofs_insert" on storage.objects
  for insert with check (
    bucket_id = 'subscription-proofs' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own proofs
create policy "proofs_select" on storage.objects
  for select using (
    bucket_id = 'subscription-proofs' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all proofs
create policy "admins_proofs_select" on storage.objects
  for select using (
    bucket_id = 'subscription-proofs' and
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
