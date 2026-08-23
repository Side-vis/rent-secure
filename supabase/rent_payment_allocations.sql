-- Persist month-level rent payment allocations for accurate timeline reporting.

DO $$
BEGIN
  IF to_regclass('public.rent_payments') IS NULL THEN
    RAISE EXCEPTION
      'public.rent_payments does not exist. Run supabase/tenant_payments_maintenance.sql first, then run this file.';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.rent_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.rent_payments(id) ON DELETE CASCADE,
  tenancy_id uuid NOT NULL REFERENCES public.tenancies(id) ON DELETE CASCADE,
  tenant_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  landlord_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  lease_month_key text NOT NULL,
  allocated_amount numeric(12, 2) NOT NULL,
  expected_amount_snapshot numeric(12, 2),
  allocation_method text NOT NULL DEFAULT 'equal_split',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rent_payment_allocations_unique_payment_month UNIQUE (payment_id, lease_month_key),
  CONSTRAINT rent_payment_allocations_month_key_check CHECK (
    lease_month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  ),
  CONSTRAINT rent_payment_allocations_amount_check CHECK (allocated_amount >= 0),
  CONSTRAINT rent_payment_allocations_expected_snapshot_check CHECK (
    expected_amount_snapshot IS NULL OR expected_amount_snapshot > 0
  ),
  CONSTRAINT rent_payment_allocations_method_check CHECK (
    allocation_method IN ('equal_split', 'sequential_fill')
  )
);

CREATE INDEX IF NOT EXISTS rent_payment_allocations_tenant_month_idx
  ON public.rent_payment_allocations(tenancy_id, lease_month_key);

CREATE INDEX IF NOT EXISTS rent_payment_allocations_tenant_created_idx
  ON public.rent_payment_allocations(tenant_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rent_payment_allocations_landlord_created_idx
  ON public.rent_payment_allocations(landlord_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.validate_rent_payment_allocation_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_payment public.rent_payments%ROWTYPE;
BEGIN
  SELECT * INTO parent_payment
  FROM public.rent_payments rp
  WHERE rp.id = NEW.payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent rent payment % was not found.', NEW.payment_id;
  END IF;

  IF NEW.tenancy_id <> parent_payment.tenancy_id
     OR NEW.tenant_user_id <> parent_payment.tenant_user_id
     OR NEW.landlord_id <> parent_payment.landlord_id
     OR NEW.property_id <> parent_payment.property_id THEN
    RAISE EXCEPTION 'Allocation parent fields must match the parent rent payment.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rent_payment_allocations_parent_guard
  ON public.rent_payment_allocations;

CREATE TRIGGER rent_payment_allocations_parent_guard
BEFORE INSERT OR UPDATE ON public.rent_payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.validate_rent_payment_allocation_parent();

ALTER TABLE public.rent_payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants read own payment allocations" ON public.rent_payment_allocations;
CREATE POLICY "Tenants read own payment allocations" ON public.rent_payment_allocations
  FOR SELECT USING (tenant_user_id = auth.uid());

DROP POLICY IF EXISTS "Tenants create payment allocations" ON public.rent_payment_allocations;
CREATE POLICY "Tenants create payment allocations" ON public.rent_payment_allocations
  FOR INSERT WITH CHECK (
    tenant_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.rent_payments rp
      WHERE rp.id = payment_id
        AND rp.tenant_user_id = auth.uid()
        AND rp.tenancy_id = rent_payment_allocations.tenancy_id
        AND rp.landlord_id = rent_payment_allocations.landlord_id
        AND rp.property_id = rent_payment_allocations.property_id
        AND rp.status = 'submitted'
    )
  );

DROP POLICY IF EXISTS "Landlords read own payment allocations" ON public.rent_payment_allocations;
CREATE POLICY "Landlords read own payment allocations" ON public.rent_payment_allocations
  FOR SELECT USING (landlord_id = auth.uid());

DROP POLICY IF EXISTS "Admin read payment allocations" ON public.rent_payment_allocations;
CREATE POLICY "Admin read payment allocations" ON public.rent_payment_allocations
  FOR SELECT USING (public.is_admin());
