-- Tenant unit details visibility migration
-- Allows tenants to read room/unit metadata for their assigned active tenancy.

DROP POLICY IF EXISTS "Tenants read assigned property units" ON public.property_units;
CREATE POLICY "Tenants read assigned property units" ON public.property_units
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.tenancies t
      WHERE t.property_id = property_units.property_id
        AND t.tenant_user_id = auth.uid()
        AND t.status = 'active'
        AND lower(coalesce(t.unit_label, '')) = lower(property_units.unit_number)
    )
  );
