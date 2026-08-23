-- Property listings schema + RLS

-- Add extended property fields
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS landlord_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS property_type text,
  ADD COLUMN IF NOT EXISTS bedrooms int,
  ADD COLUMN IF NOT EXISTS bathrooms numeric,
  ADD COLUMN IF NOT EXISTS furnished boolean default false,
  ADD COLUMN IF NOT EXISTS parking boolean default false,
  ADD COLUMN IF NOT EXISTS pet_policy text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS monthly_rent numeric,
  ADD COLUMN IF NOT EXISTS currency text default 'USD',
  ADD COLUMN IF NOT EXISTS security_deposit numeric,
  ADD COLUMN IF NOT EXISTS lease_duration_months int,
  ADD COLUMN IF NOT EXISTS available_from date,
  ADD COLUMN IF NOT EXISTS max_occupancy int,
  ADD COLUMN IF NOT EXISTS verified boolean default false;

-- Backfill landlord_id from owner_id if present
UPDATE public.properties
SET landlord_id = owner_id
WHERE landlord_id IS NULL AND owner_id IS NOT NULL;

-- Property images table
CREATE TABLE IF NOT EXISTS public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  image_url text not null,
  is_cover boolean not null default false,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.property_images enable row level security;

-- RLS for properties (landlords only)
DROP POLICY IF EXISTS "Landlords read own properties" ON public.properties;
DROP POLICY IF EXISTS "Landlords insert own properties" ON public.properties;
DROP POLICY IF EXISTS "Landlords update own properties" ON public.properties;

CREATE POLICY "Landlords read own properties" ON public.properties
  FOR SELECT USING (auth.uid() = landlord_id OR auth.uid() = owner_id);

CREATE POLICY "Landlords insert own properties" ON public.properties
  FOR INSERT WITH CHECK (auth.uid() = landlord_id OR auth.uid() = owner_id);

CREATE POLICY "Landlords update own properties" ON public.properties
  FOR UPDATE USING (auth.uid() = landlord_id OR auth.uid() = owner_id);

-- RLS for property images (landlords only)
CREATE POLICY "Landlords read own property images" ON public.property_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND (p.landlord_id = auth.uid() OR p.owner_id = auth.uid())
    )
  );

CREATE POLICY "Landlords insert own property images" ON public.property_images
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND (p.landlord_id = auth.uid() OR p.owner_id = auth.uid())
    )
  );

CREATE POLICY "Landlords update own property images" ON public.property_images
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND (p.landlord_id = auth.uid() OR p.owner_id = auth.uid())
    )
  );

CREATE POLICY "Landlords delete own property images" ON public.property_images
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND (p.landlord_id = auth.uid() OR p.owner_id = auth.uid())
    )
  );

-- Storage bucket for property images
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Landlords manage property images" ON storage.objects
  FOR ALL USING (
    bucket_id = 'property-images'
    AND auth.uid()::text = split_part(name, '/', 1)
  )
  WITH CHECK (
    bucket_id = 'property-images'
    AND auth.uid()::text = split_part(name, '/', 1)
  );
