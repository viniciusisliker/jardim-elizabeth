-- Catálogo de carrinhos e displays (referência para o cronograma)

CREATE TABLE IF NOT EXISTS public.equipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  equipment_type text NOT NULL CHECK (equipment_type IN ('carrinho', 'display')),
  default_location text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipment_items_name_type_unique UNIQUE (equipment_type, name)
);

CREATE INDEX IF NOT EXISTS equipment_items_type_active_idx
  ON public.equipment_items (equipment_type, is_active);

CREATE INDEX IF NOT EXISTS equipment_items_sort_idx
  ON public.equipment_items (sort_order);

ALTER TABLE public.equipment_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS equipment_items_read ON public.equipment_items;
CREATE POLICY equipment_items_read ON public.equipment_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS equipment_items_manage ON public.equipment_items;
CREATE POLICY equipment_items_manage ON public.equipment_items
  FOR ALL TO authenticated
  USING (public.can_manage_agendamentos())
  WITH CHECK (public.can_manage_agendamentos());
