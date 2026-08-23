-- Listing room and unit inventory schema + RLS

create table if not exists public.property_units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_number text not null,
  unit_type text not null default 'single',
  monthly_rent numeric,
  bathrooms numeric,
  furnished boolean not null default false,
  is_available boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_units_unit_type_check check (
    unit_type in ('single', 'double', 'self_contained', 'studio', 'apartment', 'other')
  )
);

create unique index if not exists property_units_property_id_unit_number_key
  on public.property_units(property_id, lower(unit_number));

create index if not exists property_units_property_id_is_available_idx
  on public.property_units(property_id, is_available);

alter table public.property_units enable row level security;

drop policy if exists "Landlords read own property units" on public.property_units;
create policy "Landlords read own property units" on public.property_units
  for select using (
    exists (
      select 1
      from public.properties p
      where p.id = property_id
        and (p.owner_id = auth.uid() or p.landlord_id = auth.uid())
    )
  );

drop policy if exists "Tenants read assigned property units" on public.property_units;
create policy "Tenants read assigned property units" on public.property_units
  for select using (
    exists (
      select 1
      from public.tenancies t
      where t.property_id = property_units.property_id
        and t.tenant_user_id = auth.uid()
        and t.status = 'active'
        and lower(coalesce(t.unit_label, '')) = lower(property_units.unit_number)
    )
  );

drop policy if exists "Landlords insert own property units" on public.property_units;
create policy "Landlords insert own property units" on public.property_units
  for insert with check (
    exists (
      select 1
      from public.properties p
      where p.id = property_id
        and (p.owner_id = auth.uid() or p.landlord_id = auth.uid())
    )
  );

drop policy if exists "Landlords update own property units" on public.property_units;
create policy "Landlords update own property units" on public.property_units
  for update using (
    exists (
      select 1
      from public.properties p
      where p.id = property_id
        and (p.owner_id = auth.uid() or p.landlord_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.properties p
      where p.id = property_id
        and (p.owner_id = auth.uid() or p.landlord_id = auth.uid())
    )
  );

drop policy if exists "Landlords delete own property units" on public.property_units;
create policy "Landlords delete own property units" on public.property_units
  for delete using (
    exists (
      select 1
      from public.properties p
      where p.id = property_id
        and (p.owner_id = auth.uid() or p.landlord_id = auth.uid())
    )
  );

create or replace function public.sync_property_units_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists property_units_set_updated_at on public.property_units;
create trigger property_units_set_updated_at
before update on public.property_units
for each row execute function public.sync_property_units_updated_at();
