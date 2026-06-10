-- Permite 1 designação individual + 1 dupla de domingo por dirigente (mesmo profile_id).

DROP INDEX IF EXISTS public.territory_active_one_per_profile;

CREATE UNIQUE INDEX IF NOT EXISTS territory_active_one_individual_per_profile
  ON public.territory_active_assignments (profile_id)
  WHERE status = 'active' AND NOT is_domingo_pair;

CREATE UNIQUE INDEX IF NOT EXISTS territory_active_one_domingo_per_profile
  ON public.territory_active_assignments (profile_id)
  WHERE status = 'active' AND is_domingo_pair;
