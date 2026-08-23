-- Tenancies invitation unique index fix
-- Repairs environments where onConflict("invitation_id") fails due to missing unique index.

CREATE UNIQUE INDEX IF NOT EXISTS tenancies_invitation_id_key
  ON public.tenancies(invitation_id)
  WHERE invitation_id IS NOT NULL;
