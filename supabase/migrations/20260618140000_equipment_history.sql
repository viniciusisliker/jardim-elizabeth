-- Histórico de alterações em Carrinhos e Displays

CREATE TABLE IF NOT EXISTS public.equipment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('cronograma', 'publicador', 'equipamento', 'local')),
  action text NOT NULL CHECK (action IN ('criacao', 'edicao', 'exclusao', 'status')),
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  details text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equipment_history_event_date_idx
  ON public.equipment_history (event_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS equipment_history_event_type_idx
  ON public.equipment_history (event_type);

ALTER TABLE public.equipment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS equipment_history_read ON public.equipment_history;
CREATE POLICY equipment_history_read ON public.equipment_history
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS equipment_history_insert ON public.equipment_history;
CREATE POLICY equipment_history_insert ON public.equipment_history
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_agendamentos());

DROP POLICY IF EXISTS equipment_history_delete ON public.equipment_history;
CREATE POLICY equipment_history_delete ON public.equipment_history
  FOR DELETE TO authenticated
  USING (public.can_manage_agendamentos());

CREATE OR REPLACE FUNCTION public.log_equipment_history(
  p_event_type text,
  p_action text,
  p_event_date date DEFAULT CURRENT_DATE,
  p_details text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_agendamentos() THEN
    RAISE EXCEPTION 'Sem permissão para registrar histórico';
  END IF;

  INSERT INTO public.equipment_history (
    event_type, action, event_date, details, metadata, created_by
  ) VALUES (
    p_event_type, p_action, COALESCE(p_event_date, CURRENT_DATE), p_details, COALESCE(p_metadata, '{}'::jsonb), auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_equipment_history(text, text, date, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_equipment_history(text, text, date, text, jsonb) TO authenticated;
