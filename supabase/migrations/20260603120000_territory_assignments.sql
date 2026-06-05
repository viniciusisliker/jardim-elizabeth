-- Designações de território para dirigentes de grupo (visível no Hub só para o designado)

CREATE OR REPLACE FUNCTION public.can_manage_territories()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_access_permission('territorios');
$$;

REVOKE ALL ON FUNCTION public.can_manage_territories() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_territories() TO authenticated;

CREATE TABLE IF NOT EXISTS public.territory_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id uuid NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  work_date date NOT NULL,
  work_time time,
  meeting_point text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT territory_assignments_week_contains_work CHECK (
    work_date >= week_start AND work_date < (week_start + interval '7 days')
  )
);

CREATE INDEX IF NOT EXISTS territory_assignments_profile_work_date_idx
  ON public.territory_assignments (profile_id, work_date);

CREATE INDEX IF NOT EXISTS territory_assignments_territory_idx
  ON public.territory_assignments (territory_id);

CREATE INDEX IF NOT EXISTS territory_assignments_work_date_idx
  ON public.territory_assignments (work_date);

ALTER TABLE public.territory_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY territory_assignments_read_own_or_manager
  ON public.territory_assignments FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.can_manage_territories()
  );

CREATE POLICY territory_assignments_managers_write
  ON public.territory_assignments FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_territories());

CREATE POLICY territory_assignments_managers_update
  ON public.territory_assignments FOR UPDATE
  TO authenticated
  USING (public.can_manage_territories())
  WITH CHECK (public.can_manage_territories());

CREATE POLICY territory_assignments_managers_delete
  ON public.territory_assignments FOR DELETE
  TO authenticated
  USING (public.can_manage_territories());

CREATE OR REPLACE FUNCTION public.touch_territory_assignments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS territory_assignments_updated_at ON public.territory_assignments;
CREATE TRIGGER territory_assignments_updated_at
  BEFORE UPDATE ON public.territory_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_territory_assignments_updated_at();
