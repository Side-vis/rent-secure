-- Add flexible billing period range to rent payments (safe for existing deployments)

do $$
begin
  if to_regclass('public.rent_payments') is null then
    raise exception
      'public.rent_payments does not exist. Run supabase/tenant_payments_maintenance.sql first, then run this file.';
  end if;
end
$$;

alter table public.rent_payments
  add column if not exists payment_period_start date;

alter table public.rent_payments
  add column if not exists payment_period_end date;

update public.rent_payments
set payment_period_start = coalesce(payment_period_start, payment_month)
where payment_period_start is null;

update public.rent_payments
set payment_period_end = coalesce(
  payment_period_end,
  (date_trunc('month', payment_month)::date + interval '1 month - 1 day')::date
)
where payment_period_end is null;

alter table public.rent_payments
  alter column payment_period_start set not null;

alter table public.rent_payments
  alter column payment_period_end set not null;

alter table public.rent_payments
  drop constraint if exists rent_payments_period_check;

alter table public.rent_payments
  add constraint rent_payments_period_check check (payment_period_end >= payment_period_start);
