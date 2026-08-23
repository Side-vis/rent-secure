-- Tenant assignment visibility fix migration
-- Ensures tenant dashboard can read assigned property and landlord profile details.

-- Tenants can read properties linked to their active tenancy
-- or pending invitation addressed to their account/email.
DROP POLICY IF EXISTS "Tenants read assigned properties" ON public.properties;
CREATE POLICY "Tenants read assigned properties" ON public.properties
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.tenancies t
      WHERE t.property_id = properties.id
        AND t.tenant_user_id = auth.uid()
        AND t.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.tenant_invitations i
      WHERE i.property_id = properties.id
        AND i.status = 'pending'
        AND (
          i.tenant_user_id = auth.uid()
          OR lower(i.tenant_email) = lower(auth.jwt() ->> 'email')
        )
    )
  );

-- Tenants can read landlord profile details for active tenancies.
DROP POLICY IF EXISTS "Tenants read linked landlord profiles" ON public.profiles;
CREATE POLICY "Tenants read linked landlord profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.tenancies t
      WHERE t.landlord_id = profiles.id
        AND t.tenant_user_id = auth.uid()
        AND t.status = 'active'
    )
  );
