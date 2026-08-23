-- Tenant payments and maintenance workflow schema

create table if not exists public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references public.tenancies(id) on delete cascade,
  tenant_user_id uuid not null references public.profiles(id) on delete cascade,
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'USD',
  payment_month date not null,
  payment_period_start date not null,
  payment_period_end date not null,
  payment_method text not null default 'mobile_money',
  reference_code text not null,
  note text,
  status text not null default 'submitted',
  landlord_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rent_payments_status_check check (status in ('submitted', 'approved', 'rejected')),
  constraint rent_payments_period_check check (payment_period_end >= payment_period_start),
  constraint rent_payments_method_check check (
    payment_method in ('mobile_money', 'bank_transfer', 'cash', 'card', 'other')
  )
);

create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references public.tenancies(id) on delete cascade,
  tenant_user_id uuid not null references public.profiles(id) on delete cascade,
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  title text not null,
  description text not null,
  priority text not null default 'medium',
  status text not null default 'open',
  preferred_visit_date date,
  contact_phone text,
  landlord_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_requests_priority_check check (
    priority in ('low', 'medium', 'high', 'urgent')
  ),
  constraint maintenance_requests_status_check check (
    status in ('open', 'in_progress', 'resolved', 'closed')
  )
);

create index if not exists rent_payments_tenant_status_idx
  on public.rent_payments(tenant_user_id, status, payment_month desc, created_at desc);

create index if not exists rent_payments_landlord_status_idx
  on public.rent_payments(landlord_id, status, payment_month desc, created_at desc);

create index if not exists rent_payments_tenancy_month_idx
  on public.rent_payments(tenancy_id, payment_month desc);

create index if not exists maintenance_requests_tenant_status_idx
  on public.maintenance_requests(tenant_user_id, status, priority, created_at desc);

create index if not exists maintenance_requests_landlord_status_idx
  on public.maintenance_requests(landlord_id, status, priority, created_at desc);

create index if not exists maintenance_requests_property_idx
  on public.maintenance_requests(property_id, created_at desc);

create or replace function public.sync_rent_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_maintenance_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rent_payments_set_updated_at on public.rent_payments;
create trigger rent_payments_set_updated_at
before update on public.rent_payments
for each row execute function public.sync_rent_payments_updated_at();

drop trigger if exists maintenance_requests_set_updated_at on public.maintenance_requests;
create trigger maintenance_requests_set_updated_at
before update on public.maintenance_requests
for each row execute function public.sync_maintenance_requests_updated_at();

alter table public.rent_payments enable row level security;
alter table public.maintenance_requests enable row level security;

-- Rent payment policies

drop policy if exists "Tenants read own rent payments" on public.rent_payments;
create policy "Tenants read own rent payments" on public.rent_payments
  for select using (tenant_user_id = auth.uid());

drop policy if exists "Tenants create rent payments" on public.rent_payments;
create policy "Tenants create rent payments" on public.rent_payments
  for insert with check (
    tenant_user_id = auth.uid()
    and exists (
      select 1
      from public.tenancies t
      where t.id = tenancy_id
        and t.tenant_user_id = auth.uid()
        and t.status = 'active'
        and t.landlord_id = rent_payments.landlord_id
        and t.property_id = rent_payments.property_id
    )
  );

drop policy if exists "Landlords read own rent payments" on public.rent_payments;
create policy "Landlords read own rent payments" on public.rent_payments
  for select using (landlord_id = auth.uid());

drop policy if exists "Landlords update own rent payments" on public.rent_payments;
create policy "Landlords update own rent payments" on public.rent_payments
  for update using (landlord_id = auth.uid())
  with check (landlord_id = auth.uid());

drop policy if exists "Admin read rent payments" on public.rent_payments;
create policy "Admin read rent payments" on public.rent_payments
  for select using (public.is_admin());

drop policy if exists "Admin update rent payments" on public.rent_payments;
create policy "Admin update rent payments" on public.rent_payments
  for update using (public.is_admin());

-- Maintenance request policies

drop policy if exists "Tenants read own maintenance requests" on public.maintenance_requests;
create policy "Tenants read own maintenance requests" on public.maintenance_requests
  for select using (tenant_user_id = auth.uid());

drop policy if exists "Tenants create maintenance requests" on public.maintenance_requests;
create policy "Tenants create maintenance requests" on public.maintenance_requests
  for insert with check (
    tenant_user_id = auth.uid()
    and status = 'open'
    and exists (
      select 1
      from public.tenancies t
      where t.id = tenancy_id
        and t.tenant_user_id = auth.uid()
        and t.status = 'active'
        and t.landlord_id = maintenance_requests.landlord_id
        and t.property_id = maintenance_requests.property_id
    )
  );

drop policy if exists "Landlords read own maintenance requests" on public.maintenance_requests;
create policy "Landlords read own maintenance requests" on public.maintenance_requests
  for select using (landlord_id = auth.uid());

drop policy if exists "Landlords update own maintenance requests" on public.maintenance_requests;
create policy "Landlords update own maintenance requests" on public.maintenance_requests
  for update using (landlord_id = auth.uid())
  with check (landlord_id = auth.uid());

drop policy if exists "Admin read maintenance requests" on public.maintenance_requests;
create policy "Admin read maintenance requests" on public.maintenance_requests
  for select using (public.is_admin());

drop policy if exists "Admin update maintenance requests" on public.maintenance_requests;
create policy "Admin update maintenance requests" on public.maintenance_requests
  for update using (public.is_admin());
