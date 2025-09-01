-- Conversations and Messages schema for chat between room seekers and property owners
-- Assumptions:
-- - room_seeker(id uuid) and property_owner(id uuid) exist.
-- - property(property_id uuid) exists.
-- - auth.uid() equals the seeker/owner id (adjust RLS if you use a different mapping).

-- Ensure pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

-- 1) Enum for message acknowledgement status
do $$
begin
  if not exists (select 1 from pg_type where typname = 'message_ack_status') then
    create type message_ack_status as enum ('sent', 'delivered', 'seen');
  end if;
end $$;

-- 2) Conversations
create table if not exists public.conversations (
  conversation_id uuid primary key default gen_random_uuid(),
  seeker_id uuid not null references public.room_seeker(user_id) on delete cascade,
  owner_id uuid not null references public.property_owner(user_id) on delete cascade,
  property_id uuid null references public.property(property_id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz null,
  last_message text null,
  seeker_unread_count int not null default 0,
  owner_unread_count int not null default 0,
  constraint conversations_unique_per_property unique (seeker_id, owner_id, property_id)
);

-- helpful indexes
create index if not exists conversations_seeker_id_idx on public.conversations(seeker_id);
create index if not exists conversations_owner_id_idx on public.conversations(owner_id);
create index if not exists conversations_property_id_idx on public.conversations(property_id);
create index if not exists conversations_last_message_at_idx on public.conversations(last_message_at desc nulls last);

-- 3) Messages
create table if not exists public.messages (
  message_id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(conversation_id) on delete cascade,
  sender_type text not null check (sender_type in ('seeker','owner')),
  sender_id uuid not null,
  body text not null,
  ack_status message_ack_status not null default 'sent',
  created_at timestamptz not null default now(),
  delivered_at timestamptz null,
  seen_at timestamptz null
);

-- helpful indexes
create index if not exists messages_conversation_id_created_at_idx on public.messages(conversation_id, created_at asc);
create index if not exists messages_sender_id_idx on public.messages(sender_id);

-- 4) Trigger: update conversation last_message and unread counters on new message
create or replace function public.on_message_insert() returns trigger as $$
declare
  is_seeker boolean;
begin
  -- Update last message fields
  update public.conversations c
    set last_message = new.body,
        last_message_at = new.created_at,
        owner_unread_count = case when new.sender_type = 'seeker' then c.owner_unread_count + 1 else c.owner_unread_count end,
        seeker_unread_count = case when new.sender_type = 'owner' then c.seeker_unread_count + 1 else c.seeker_unread_count end
  where c.conversation_id = new.conversation_id;

  return new;
end;
$$ language plpgsql security definer;

create trigger trg_on_message_insert
after insert on public.messages
for each row execute function public.on_message_insert();

-- 5) RLS: enable and basic policies
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Conversations policies
-- Assumes seeker_id or owner_id match auth.uid(). Adjust if your schema uses a different mapping.
create policy conversations_select
on public.conversations
for select
using (seeker_id = auth.uid() or owner_id = auth.uid());

create policy conversations_insert
on public.conversations
for insert
with check (seeker_id = auth.uid() or owner_id = auth.uid());

create policy conversations_update
on public.conversations
for update
using (seeker_id = auth.uid() or owner_id = auth.uid())
with check (seeker_id = auth.uid() or owner_id = auth.uid());

-- Messages policies
create policy messages_select
on public.messages
for select
using (exists (
  select 1 from public.conversations c
  where c.conversation_id = messages.conversation_id
    and (c.seeker_id = auth.uid() or c.owner_id = auth.uid())
));

create policy messages_insert
on public.messages
for insert
with check (exists (
  select 1 from public.conversations c
  where c.conversation_id = messages.conversation_id
    and (
      (messages.sender_type = 'seeker' and c.seeker_id = auth.uid() and messages.sender_id = auth.uid()) or
      (messages.sender_type = 'owner'  and c.owner_id = auth.uid() and messages.sender_id = auth.uid())
    )
));

create policy messages_update_ack
on public.messages
for update
using (exists (
  select 1 from public.conversations c
  where c.conversation_id = messages.conversation_id
    and (c.seeker_id = auth.uid() or c.owner_id = auth.uid())
))
with check (true);

-- Notes:
-- - Consider adding a trigger or explicit API to reset unread counters when a participant opens the conversation.
-- - If your seeker/owner tables map to auth.users via a different column (e.g., user_id), update RLS conditions accordingly.
