-- Prevent non-admin users from changing fields that only admins should control.
--
-- Why: the existing RLS policies let users update their own rows without column
-- restrictions, so a user could set profiles.role = 'admin', a landlord could set
-- their own verification_status = 'approved', or mark their listing 'active'.
--
-- Requests made with the service role (API routes using supabaseAdmin) have no
-- auth.uid() and are not affected. Admins (public.is_admin()) are not affected.
-- Run after admin_review_reasons.sql.

create or replace function public.is_privileged_actor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is null or public.is_admin();
$$;

-- profiles: role is admin-controlled once set; nobody can self-assign admin.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_privileged_actor() then
    return new;
  end if;

  if tg_op = 'INSERT' and new.role = 'admin' then
    raise exception 'Not allowed to assign the admin role';
  end if;

  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    raise exception 'Not allowed to change role';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role
  before insert or update on public.profiles
  for each row execute function public.guard_profile_role();

-- landlord_profiles: landlords may only move themselves to 'pending' (submit/resubmit)
-- and may clear, but never set, review fields.
create or replace function public.guard_landlord_review_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_privileged_actor() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.verification_status not in ('not_started', 'pending')
       or new.rejection_reason is not null
       or new.reviewed_at is not null
       or new.reviewed_by is not null then
      raise exception 'Not allowed to set review fields';
    end if;
    return new;
  end if;

  if new.verification_status is distinct from old.verification_status
     and not (new.verification_status = 'pending'
              and old.verification_status in ('not_started', 'rejected')) then
    raise exception 'Not allowed to change verification status to %', new.verification_status;
  end if;

  if (new.rejection_reason is distinct from old.rejection_reason and new.rejection_reason is not null)
     or new.reviewed_at is distinct from old.reviewed_at
     or new.reviewed_by is distinct from old.reviewed_by then
    raise exception 'Not allowed to set review fields';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_landlord_review_fields on public.landlord_profiles;
create trigger guard_landlord_review_fields
  before insert or update on public.landlord_profiles
  for each row execute function public.guard_landlord_review_fields();

-- properties: landlords cannot approve or reject their own listings.
-- A listing that was already approved (verified) may be set back to 'active'
-- by its owner, e.g. after pausing it.
create or replace function public.guard_property_review_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_privileged_actor() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status in ('active', 'rejected')
       or coalesce(new.verified, false)
       or new.rejection_reason is not null
       or new.reviewed_at is not null
       or new.reviewed_by is not null then
      raise exception 'Not allowed to set review fields';
    end if;
    return new;
  end if;

  if new.verified is distinct from old.verified and coalesce(new.verified, false) then
    raise exception 'Not allowed to verify a listing';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'rejected'
       or (new.status = 'active' and not coalesce(old.verified, false)) then
      raise exception 'Not allowed to change listing status to %', new.status;
    end if;
  end if;

  if (new.rejection_reason is distinct from old.rejection_reason and new.rejection_reason is not null)
     or new.reviewed_at is distinct from old.reviewed_at
     or new.reviewed_by is distinct from old.reviewed_by then
    raise exception 'Not allowed to set review fields';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_property_review_fields on public.properties;
create trigger guard_property_review_fields
  before insert or update on public.properties
  for each row execute function public.guard_property_review_fields();
