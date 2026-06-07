-- Carrinhos e Displays: publicadores habilitados + cronograma semanal (fixo e temporário)

CREATE OR REPLACE FUNCTION public.can_manage_agendamentos()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_access_permission('agendamentos');
$$;

REVOKE ALL ON FUNCTION public.can_manage_agendamentos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_agendamentos() TO authenticated;

CREATE TABLE IF NOT EXISTS public.equipment_publishers (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  can_carrinho boolean NOT NULL DEFAULT true,
  can_display boolean NOT NULL DEFAULT true,
  available_days text[] NOT NULL DEFAULT ARRAY['Terça', 'Quarta', 'Quinta', 'Sexta']::text[],
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.equipment_schedule_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday_label text NOT NULL,
  period_label text NOT NULL CHECK (period_label IN ('Manhã', 'Tarde')),
  slot_kind text NOT NULL DEFAULT 'fixed' CHECK (slot_kind IN ('fixed', 'temporary')),
  week_start date,
  publisher_names text NOT NULL DEFAULT '',
  equipment_type text NOT NULL CHECK (equipment_type IN ('carrinho', 'display')),
  equipment_name text NOT NULL DEFAULT '',
  location_name text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipment_schedule_week_start CHECK (
    (slot_kind = 'fixed' AND week_start IS NULL)
    OR (slot_kind = 'temporary' AND week_start IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS equipment_schedule_slots_sort_idx
  ON public.equipment_schedule_slots (sort_order);

CREATE INDEX IF NOT EXISTS equipment_schedule_slots_week_idx
  ON public.equipment_schedule_slots (week_start);

CREATE INDEX IF NOT EXISTS equipment_publishers_active_idx
  ON public.equipment_publishers (is_active);

ALTER TABLE public.equipment_publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_schedule_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS equipment_publishers_read ON public.equipment_publishers;
CREATE POLICY equipment_publishers_read ON public.equipment_publishers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS equipment_publishers_manage ON public.equipment_publishers;
CREATE POLICY equipment_publishers_manage ON public.equipment_publishers
  FOR ALL TO authenticated
  USING (public.can_manage_agendamentos())
  WITH CHECK (public.can_manage_agendamentos());

DROP POLICY IF EXISTS equipment_schedule_slots_read ON public.equipment_schedule_slots;
CREATE POLICY equipment_schedule_slots_read ON public.equipment_schedule_slots
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS equipment_schedule_slots_manage ON public.equipment_schedule_slots;
CREATE POLICY equipment_schedule_slots_manage ON public.equipment_schedule_slots
  FOR ALL TO authenticated
  USING (public.can_manage_agendamentos())
  WITH CHECK (public.can_manage_agendamentos());
