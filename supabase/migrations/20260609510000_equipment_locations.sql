-- Catálogo de locais de carrinho e display

CREATE TABLE IF NOT EXISTS public.equipment_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipment_locations_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS equipment_locations_active_idx
  ON public.equipment_locations (is_active);

CREATE INDEX IF NOT EXISTS equipment_locations_sort_idx
  ON public.equipment_locations (sort_order);

ALTER TABLE public.equipment_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS equipment_locations_read ON public.equipment_locations;
CREATE POLICY equipment_locations_read ON public.equipment_locations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS equipment_locations_manage ON public.equipment_locations;
CREATE POLICY equipment_locations_manage ON public.equipment_locations
  FOR ALL TO authenticated
  USING (public.can_manage_agendamentos())
  WITH CHECK (public.can_manage_agendamentos());
