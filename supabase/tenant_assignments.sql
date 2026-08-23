-- Tenant invitation and tenancy assignment schema

create table if not exists public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  tenant_email text not null,
  tenant_user_id uuid references public.profiles(id) on delete set null,
  unit_label text,
  token_hash text not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_invitations_status_check check (
    status in ('pending', 'accepted', 'expired', 'revoked')
  )
);

create table if not exists public.tenancies (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid references public.tenant_invitations(id) on delete set null,
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  tenant_user_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_label text,
  status text not null default 'active',
  start_date date default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenancies_status_check check (status in ('active', 'ended'))
);

create unique index if not exists tenant_invitations_token_hash_key
  on public.tenant_invitations(token_hash);

create index if not exists tenant_invitations_landlord_status_idx
  on public.tenant_invitations(landlord_id, status, created_at desc);

create index if not exists tenant_invitations_email_status_idx
  on public.tenant_invitations(lower(tenant_email), status);

create unique index if not exists tenancies_invitation_id_key
  on public.tenancies(invitation_id)
  where invitation_id is not null;

create unique index if not exists tenancies_active_unique_idx
  on public.tenancies(property_id, tenant_user_id, coalesce(unit_label, ''))
  where status = 'active';

create index if not exists tenancies_tenant_status_idx
  on public.tenancies(tenant_user_id, status, created_at desc);

create index if not exists tenancies_landlord_status_idx
  on public.tenancies(landlord_id, status, created_at desc);

alter table public.tenant_invitations enable row level security;
alter table public.tenancies enable row level security;

drop policy if exists "Landlords read own invitations" on public.tenant_invitations;
create policy "Landlords read own invitations" on public.tenant_invitations
  for select using (landlord_id = auth.uid());

drop policy if exists "Landlords create invitations" on public.tenant_invitations;
create policy "Landlords create invitations" on public.tenant_invitations
  for insert with check (
    landlord_id = auth.uid()
    and exists (
      select 1
      from public.properties p
      where p.id = property_id
        and (p.owner_id = auth.uid() or p.landlord_id = auth.uid())
    )
  );

drop policy if exists "Landlords update invitations" on public.tenant_invitations;
create policy "Landlords update invitations" on public.tenant_invitations
  for update using (landlord_id = auth.uid())
  with check (landlord_id = auth.uid());

drop policy if exists "Tenants read their invitations" on public.tenant_invitations;
create policy "Tenants read their invitations" on public.tenant_invitations
  for select using (
    tenant_user_id = auth.uid()
    or lower(tenant_email) = lower(auth.jwt() ->> 'email')
  );

drop policy if exists "Admin read invitations" on public.tenant_invitations;
create policy "Admin read invitations" on public.tenant_invitations
  for select using (public.is_admin());

drop policy if exists "Admin update invitations" on public.tenant_invitations;
create policy "Admin update invitations" on public.tenant_invitations
  for update using (public.is_admin());

drop policy if exists "Landlords read own tenancies" on public.tenancies;
create policy "Landlords read own tenancies" on public.tenancies
  for select using (landlord_id = auth.uid());

drop policy if exists "Landlords create own tenancies" on public.tenancies;
create policy "Landlords create own tenancies" on public.tenancies
  for insert with check (
    landlord_id = auth.uid()
    and exists (
      select 1
      from public.properties p
      where p.id = property_id
        and (p.owner_id = auth.uid() or p.landlord_id = auth.uid())
    )
  );

drop policy if exists "Landlords update own tenancies" on public.tenancies;
create policy "Landlords update own tenancies" on public.tenancies
  for update using (landlord_id = auth.uid())
  with check (landlord_id = auth.uid());

drop policy if exists "Tenants read own tenancies" on public.tenancies;
create policy "Tenants read own tenancies" on public.tenancies
  for select using (tenant_user_id = auth.uid());

drop policy if exists "Admin read tenancies" on public.tenancies;
create policy "Admin read tenancies" on public.tenancies
  for select using (public.is_admin());

drop policy if exists "Admin update tenancies" on public.tenancies;
create policy "Admin update tenancies" on public.tenancies
  for update using (public.is_admin());

drop policy if exists "Tenants read assigned properties" on public.properties;
create policy "Tenants read assigned properties" on public.properties
  for select using (
    exists (
      select 1
      from public.tenancies t
      where t.property_id = properties.id
        and t.tenant_user_id = auth.uid()
        and t.status = 'active'
    )
    or exists (
      select 1
      from public.tenant_invitations i
      where i.property_id = properties.id
        and i.status = 'pending'
        and (
          i.tenant_user_id = auth.uid()
          or lower(i.tenant_email) = lower(auth.jwt() ->> 'email')
        )
    )
  );

drop policy if exists "Tenants read linked landlord profiles" on public.profiles;
create policy "Tenants read linked landlord profiles" on public.profiles
  for select using (
    exists (
      select 1
      from public.tenancies t
      where t.landlord_id = profiles.id
        and t.tenant_user_id = auth.uid()
        and t.status = 'active'
    )
  );
