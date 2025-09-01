-- Create table: property_facilities
create table if not exists public.property_facilities (
  property_id uuid primary key references public.property(property_id) on delete cascade,
  wifi boolean not null default false,
  kitchen boolean not null default false,
  washing_machine boolean not null default false,
  gym boolean not null default false,
  cctv boolean not null default false,
  parking boolean not null default false,
  water_bill_policy text not null check (water_bill_policy in ('property','visitor')),
  water_bill_cost numeric(10,2),
  electricity_bill_policy text not null check (electricity_bill_policy in ('property','visitor')),
  electricity_bill_cost numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforce cost presence depending on policy
alter table public.property_facilities
  add constraint property_facilities_water_cost_policy_chk
  check (
    (water_bill_policy = 'visitor' and water_bill_cost is not null)
    or (water_bill_policy = 'property' and water_bill_cost is null)
  );

alter table public.property_facilities
  add constraint property_facilities_electric_cost_policy_chk
  check (
    (electricity_bill_policy = 'visitor' and electricity_bill_cost is not null)
    or (electricity_bill_policy = 'property' and electricity_bill_cost is null)
  );

-- Trigger to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'property_facilities_set_updated_at'
  ) then
    create trigger property_facilities_set_updated_at
    before update on public.property_facilities
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- Enable RLS
alter table public.property_facilities enable row level security;

-- Policies (idempotent)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'property_facilities'
      and policyname = 'Facilities are readable by all'
  ) then
    create policy "Facilities are readable by all"
      on public.property_facilities for select
      using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'property_facilities'
      and policyname = 'Owners can insert facilities for their properties'
  ) then
    create policy "Owners can insert facilities for their properties"
      on public.property_facilities for insert
      with check (
        exists (
          select 1 from public.property p
          where p.property_id = property_facilities.property_id
            and p.owner_id = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'property_facilities'
      and policyname = 'Owners can update facilities for their properties'
  ) then
    create policy "Owners can update facilities for their properties"
      on public.property_facilities for update
      using (
        exists (
          select 1 from public.property p
          where p.property_id = property_facilities.property_id
            and p.owner_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.property p
          where p.property_id = property_facilities.property_id
            and p.owner_id = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'property_facilities'
      and policyname = 'Owners can delete facilities for their properties'
  ) then
    create policy "Owners can delete facilities for their properties"
      on public.property_facilities for delete
      using (
        exists (
          select 1 from public.property p
          where p.property_id = property_facilities.property_id
            and p.owner_id = auth.uid()
        )
      );
  end if;
end $$;
