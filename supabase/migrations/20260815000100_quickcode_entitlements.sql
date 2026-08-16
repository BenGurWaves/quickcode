create table if not exists public.qc_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text not null default 'free' check (plan in ('free', 'paid')),
  status text not null default 'free',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qc_dynamic_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_slug text not null unique,
  current_destination_url text not null,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.qc_scan_log (
  id bigint generated always as identity primary key,
  dynamic_code_id uuid not null references public.qc_dynamic_codes(id) on delete cascade,
  scanned_at timestamptz not null default now()
);

alter table public.qc_subscriptions enable row level security;
alter table public.qc_dynamic_codes enable row level security;
alter table public.qc_scan_log enable row level security;

drop policy if exists "Users can read their QuickCode subscription" on public.qc_subscriptions;
create policy "Users can read their QuickCode subscription" on public.qc_subscriptions for select using (auth.uid() = user_id);

drop policy if exists "Users can read their QuickCode codes" on public.qc_dynamic_codes;
create policy "Users can read their QuickCode codes" on public.qc_dynamic_codes for select using (auth.uid() = user_id);

drop policy if exists "Users can read their QuickCode scans" on public.qc_scan_log;
create policy "Users can read their QuickCode scans" on public.qc_scan_log for select using (
  exists (select 1 from public.qc_dynamic_codes c where c.id = dynamic_code_id and c.user_id = auth.uid())
);

create index if not exists qc_dynamic_codes_user_id_idx on public.qc_dynamic_codes(user_id);
create index if not exists qc_scan_log_dynamic_code_id_idx on public.qc_scan_log(dynamic_code_id);
