-- Create viewing_requests table
create table if not exists public.viewing_requests (
  request_id uuid primary key default gen_random_uuid(),
  seeker_id uuid not null references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.property(property_id) on delete cascade,
  requested_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  decline_reason text,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.viewing_requests enable row level security;

-- Policies: seeker and owner of the row can select it
drop policy if exists "viewing_requests_select" on public.viewing_requests;
create policy "viewing_requests_select"
  on public.viewing_requests for select
  using (auth.uid() = seeker_id or auth.uid() = owner_id);

-- Only seeker can insert for themselves
drop policy if exists "viewing_requests_insert_seeker" on public.viewing_requests;
create policy "viewing_requests_insert_seeker"
  on public.viewing_requests for insert
  with check (auth.uid() = seeker_id);

-- Only owner for the row can update status/reason
drop policy if exists "viewing_requests_update_owner" on public.viewing_requests;
create policy "viewing_requests_update_owner"
  on public.viewing_requests for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
