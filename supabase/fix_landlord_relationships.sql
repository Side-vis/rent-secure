-- Fix landlord_profiles foreign key and create missing records

-- Step 0: Create helper function to check admin role (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Step 1: Update the foreign key to reference profiles instead of auth.users
ALTER TABLE public.landlord_profiles 
DROP CONSTRAINT IF EXISTS landlord_profiles_user_id_fkey;

ALTER TABLE public.landlord_profiles 
ADD CONSTRAINT landlord_profiles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Step 2: Fix admin RLS policies to use security definer function (prevents recursion)
-- Drop old policies
DROP POLICY IF EXISTS "Admin read landlord profiles" ON public.landlord_profiles;
DROP POLICY IF EXISTS "Admin update landlord profiles" ON public.landlord_profiles;
DROP POLICY IF EXISTS "Admin read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Landlords read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Landlords insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Landlords update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin read landlord documents" ON public.landlord_documents;
DROP POLICY IF EXISTS "Admin read properties" ON public.properties;
DROP POLICY IF EXISTS "Admin update properties" ON public.properties;
DROP POLICY IF EXISTS "Admin read verification objects" ON storage.objects;

-- Create new policies using security definer function
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admin read landlord profiles" ON public.landlord_profiles
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admin update landlord profiles" ON public.landlord_profiles
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admin read all profiles" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Admin update all profiles" ON public.profiles
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admin read landlord documents" ON public.landlord_documents
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admin read properties" ON public.properties
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admin update properties" ON public.properties
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admin read verification objects" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'landlord-verifications'
    AND public.is_admin()
  );

-- Step 3: Insert landlord_profiles for all landlords who don't have one yet
INSERT INTO public.landlord_profiles (user_id, verification_status, onboarding_step)
SELECT 
  p.id,
  CASE 
    -- If they have documents, set to pending for admin review
    WHEN EXISTS (
      SELECT 1 FROM public.landlord_documents ld WHERE ld.user_id = p.id
    ) THEN 'pending'
    -- Otherwise set to not_started
    ELSE 'not_started'
  END as verification_status,
  CASE 
    -- If they have documents, they're at least on step 2
    WHEN EXISTS (
      SELECT 1 FROM public.landlord_documents ld WHERE ld.user_id = p.id
    ) THEN 2
    -- Otherwise they're on step 1
    ELSE 1
  END as onboarding_step
FROM public.profiles p
WHERE p.role = 'landlord'
  AND NOT EXISTS (
    SELECT 1 FROM public.landlord_profiles lp WHERE lp.user_id = p.id
  )
ON CONFLICT (user_id) DO NOTHING;

-- Step 4: Verify the data
SELECT 
  p.id,
  p.full_name,
  p.role,
  lp.verification_status,
  lp.onboarding_step,
  COUNT(ld.id) as document_count
FROM public.profiles p
LEFT JOIN public.landlord_profiles lp ON lp.user_id = p.id
LEFT JOIN public.landlord_documents ld ON ld.user_id = p.id
WHERE p.role = 'landlord'
GROUP BY p.id, p.full_name, p.role, lp.verification_status, lp.onboarding_step
ORDER BY p.created_at DESC;
