-- Cronograma semanal (modelo da planilha: aba Cronograma)
CREATE TABLE IF NOT EXISTS public.territory_week_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday_label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  dirigente_name text,
  territory_id uuid REFERENCES public.territories(id) ON DELETE SET NULL,
  territory_code text,
  location_name text,
  schedule_times text,
  suggestion text,
  suggestion_note text,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS territory_week_schedule_sort_idx
  ON public.territory_week_schedule (sort_order);

ALTER TABLE public.territory_week_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS territory_week_schedule_read ON public.territory_week_schedule;
CREATE POLICY territory_week_schedule_read ON public.territory_week_schedule
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS territory_week_schedule_manage ON public.territory_week_schedule;
CREATE POLICY territory_week_schedule_manage ON public.territory_week_schedule
  FOR ALL TO authenticated
  USING (public.can_manage_territories())
  WITH CHECK (public.can_manage_territories());
