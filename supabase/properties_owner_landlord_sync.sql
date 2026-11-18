-- Keep properties.owner_id and properties.landlord_id in sync.
-- Older rows (e.g. the first property created during onboarding) only set owner_id,
-- so some pages and joins that use landlord_id could not see them.

update public.properties
set landlord_id = owner_id
where landlord_id is null and owner_id is not null;

update public.properties
set owner_id = landlord_id
where owner_id is null and landlord_id is not null;

create or replace function public.sync_property_owner_landlord()
returns trigger
language plpgsql
as $$
begin
  if new.landlord_id is null then
    new.landlord_id := new.owner_id;
  end if;
  if new.owner_id is null then
    new.owner_id := new.landlord_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_property_owner_landlord on public.properties;
create trigger sync_property_owner_landlord
  before insert or update on public.properties
  for each row execute function public.sync_property_owner_landlord();
