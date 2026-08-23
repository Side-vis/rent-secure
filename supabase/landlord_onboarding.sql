-- Landlord onboarding schema and policies

-- Helper function to check if current user is admin (bypasses RLS)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null,
  email text,
  full_name text,
  phone text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.landlord_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  ownership_type text,
  verification_status text not null default 'not_started',
  payout_method text,
  payout_details jsonb,
  onboarding_step int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.landlord_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  file_path text not null,
  file_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  title text not null,
  address text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.landlord_profiles enable row level security;
alter table public.landlord_documents enable row level security;
alter table public.properties enable row level security;

-- Users can always read their own profile (prevents recursion)
create policy "Users read own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Landlords read own landlord profile" on public.landlord_profiles
  for select using (auth.uid() = user_id);
create policy "Landlords insert own landlord profile" on public.landlord_profiles
  for insert with check (auth.uid() = user_id);
create policy "Landlords update own landlord profile" on public.landlord_profiles
  for update using (auth.uid() = user_id);

create policy "Landlords read own documents" on public.landlord_documents
  for select using (auth.uid() = user_id);
create policy "Landlords insert own documents" on public.landlord_documents
  for insert with check (auth.uid() = user_id);

create policy "Landlords read own properties" on public.properties
  for select using (auth.uid() = owner_id);
create policy "Landlords insert own properties" on public.properties
  for insert with check (auth.uid() = owner_id);
create policy "Landlords update own properties" on public.properties
  for update using (auth.uid() = owner_id);

create policy "Admin read landlord profiles" on public.landlord_profiles
  for select using (public.is_admin());
create policy "Admin update landlord profiles" on public.landlord_profiles
  for update using (public.is_admin());

create policy "Admin read all profiles" on public.profiles
  for select using (auth.uid() = id OR public.is_admin());
create policy "Admin update all profiles" on public.profiles
  for update using (public.is_admin());

create policy "Admin read landlord documents" on public.landlord_documents
  for select using (public.is_admin());

create policy "Admin read properties" on public.properties
  for select using (public.is_admin());
create policy "Admin update properties" on public.properties
  for update using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('landlord-verifications', 'landlord-verifications', false)
on conflict (id) do nothing;

create policy "Landlords manage verification objects" on storage.objects
  for all using (
    bucket_id = 'landlord-verifications'
    and auth.uid()::text = split_part(name, '/', 1)
  )
  with check (
    bucket_id = 'landlord-verifications'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "Admin read verification objects" on storage.objects
  for select using (
    bucket_id = 'landlord-verifications'
    and public.is_admin()
  );
