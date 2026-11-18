-- Admin review metadata: rejection reasons and who/when reviewed.
-- Run this before deploying the admin review changes; the app selects these columns.

ALTER TABLE public.landlord_profiles
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Listings rejected before the 'rejected' status existed were stored as draft + verified=false.
-- They cannot be told apart from never-submitted drafts, so they are left as-is.
