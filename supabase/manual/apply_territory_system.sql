-- Cole no SQL Editor do Supabase (projeto prhijmkvsgqusivmnqzx)
-- Idempotente: pode rodar mais de uma vez com seguranca

-- Migration 1: territory_assignments
CREATE OR REPLACE FUNCTION public.can_manage_territories()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_access_permission('territorios');
$$;
REVOKE ALL ON FUNCTION public.can_manage_territories() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_territories() TO authenticated;

CREATE TABLE IF NOT EXISTS public.territory_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id uuid REFERENCES public.territories(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  work_date date NOT NULL,
  work_time time,
  meeting_point text,
  notes text,
  location_name text,
  schedule_times text,
  suggestion text,
  observation_override text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT territory_assignments_week_contains_work CHECK (
    work_date >= week_start AND work_date < (week_start + interval '7 days')
  )
);

ALTER TABLE public.territory_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS territory_assignments_read_own_or_manager ON public.territory_assignments;
CREATE POLICY territory_assignments_read_own_or_manager ON public.territory_assignments FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.can_manage_territories());

DROP POLICY IF EXISTS territory_assignments_managers_write ON public.territory_assignments;
CREATE POLICY territory_assignments_managers_write ON public.territory_assignments FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_territories());

DROP POLICY IF EXISTS territory_assignments_managers_update ON public.territory_assignments;
CREATE POLICY territory_assignments_managers_update ON public.territory_assignments FOR UPDATE TO authenticated
  USING (public.can_manage_territories()) WITH CHECK (public.can_manage_territories());

DROP POLICY IF EXISTS territory_assignments_managers_delete ON public.territory_assignments;
CREATE POLICY territory_assignments_managers_delete ON public.territory_assignments FOR DELETE TO authenticated
  USING (public.can_manage_territories());

-- Migration 2: sistema completo
ALTER TABLE public.territories
  ADD COLUMN IF NOT EXISTS last_worked_at date,
  ADD COLUMN IF NOT EXISTS territory_type text NOT NULL DEFAULT 'meio_de_semana',
  ADD COLUMN IF NOT EXISTS best_occasion text,
  ADD COLUMN IF NOT EXISTS observations text;

CREATE TABLE IF NOT EXISTS public.territory_overseers (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  preference text NOT NULL DEFAULT 'meio_de_semana'
    CHECK (preference IN ('meio_de_semana', 'final_de_semana', 'ambos')),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  available_days text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.territory_active_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id uuid NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at date NOT NULL DEFAULT CURRENT_DATE,
  assigned_by uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned')),
  returned_at timestamptz,
  last_work_date date,
  return_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS territory_active_one_per_territory
  ON public.territory_active_assignments (territory_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS territory_active_one_per_profile
  ON public.territory_active_assignments (profile_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.territory_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('designacao', 'devolucao', 'edicao', 'cronograma', 'status')),
  territory_id uuid REFERENCES public.territories(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  details text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.territory_meeting_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday_label text NOT NULL,
  location_name text NOT NULL,
  address text,
  schedule_times text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.territory_assignments
  ADD COLUMN IF NOT EXISTS location_name text,
  ADD COLUMN IF NOT EXISTS schedule_times text,
  ADD COLUMN IF NOT EXISTS suggestion text,
  ADD COLUMN IF NOT EXISTS observation_override text;

DO $$ BEGIN
  ALTER TABLE public.territory_assignments ALTER COLUMN territory_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Funcoes RPC
CREATE OR REPLACE FUNCTION public.log_territory_history(
  p_event_type text, p_territory_id uuid, p_profile_id uuid,
  p_event_date date, p_details text, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.territory_history (event_type, territory_id, profile_id, event_date, details, metadata, created_by)
  VALUES (p_event_type, p_territory_id, p_profile_id, p_event_date, p_details, p_metadata, auth.uid());
END; $$;
GRANT EXECUTE ON FUNCTION public.log_territory_history(text, uuid, uuid, date, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_territory_field(
  p_territory_id uuid, p_profile_id uuid, p_assigned_at date DEFAULT CURRENT_DATE
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_territory public.territories%ROWTYPE;
  v_existing uuid;
  v_assignment_id uuid;
  v_dirigente text;
  v_terr_label text;
BEGIN
  IF NOT public.can_manage_territories() THEN RAISE EXCEPTION 'Sem permissao para designar territorios'; END IF;
  SELECT * INTO v_territory FROM public.territories WHERE id = p_territory_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Territorio nao encontrado'; END IF;

  SELECT id INTO v_existing FROM public.territory_active_assignments
  WHERE territory_id = p_territory_id AND status = 'active' LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'Este territorio ja possui designacao ativa'; END IF;

  SELECT id INTO v_existing FROM public.territory_active_assignments
  WHERE profile_id = p_profile_id AND status = 'active' LIMIT 1;
  IF FOUND THEN
    SELECT full_name INTO v_dirigente FROM public.profiles WHERE id = p_profile_id;
    RAISE EXCEPTION 'O dirigente "%" ja possui um territorio ativo', COALESCE(v_dirigente, 'selecionado');
  END IF;

  INSERT INTO public.territory_active_assignments (territory_id, profile_id, assigned_at, assigned_by, status)
  VALUES (p_territory_id, p_profile_id, COALESCE(p_assigned_at, CURRENT_DATE), auth.uid(), 'active')
  RETURNING id INTO v_assignment_id;

  UPDATE public.territories SET status = 'designado' WHERE id = p_territory_id;
  SELECT full_name INTO v_dirigente FROM public.profiles WHERE id = p_profile_id;
  v_terr_label := 'T' || v_territory.num || ' · ' || v_territory.display_name;
  PERFORM public.log_territory_history('designacao', p_territory_id, p_profile_id, COALESCE(p_assigned_at, CURRENT_DATE),
    format('Designado para %s: %s', COALESCE(v_dirigente, '—'), v_terr_label),
    jsonb_build_object('assignment_id', v_assignment_id));
  RETURN v_assignment_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.assign_territory_field(uuid, uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.return_territory_field(
  p_assignment_id uuid, p_work_date date, p_notes text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.territory_active_assignments%ROWTYPE;
  v_territory public.territories%ROWTYPE;
  v_dirigente text;
  v_terr_label text;
BEGIN
  IF NOT public.can_manage_territories() THEN RAISE EXCEPTION 'Sem permissao para devolver territorios'; END IF;
  SELECT * INTO v_row FROM public.territory_active_assignments WHERE id = p_assignment_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Designacao ativa nao encontrada'; END IF;
  SELECT * INTO v_territory FROM public.territories WHERE id = v_row.territory_id;
  SELECT full_name INTO v_dirigente FROM public.profiles WHERE id = v_row.profile_id;

  UPDATE public.territory_active_assignments SET status = 'returned', returned_at = now(),
    last_work_date = COALESCE(p_work_date, CURRENT_DATE), return_notes = NULLIF(trim(p_notes), ''), updated_at = now()
  WHERE id = p_assignment_id;

  UPDATE public.territories SET status = 'disponivel', last_worked_at = COALESCE(p_work_date, CURRENT_DATE),
    observations = COALESCE(NULLIF(trim(p_notes), ''), observations) WHERE id = v_row.territory_id;

  v_terr_label := 'T' || v_territory.num || ' · ' || v_territory.display_name;
  PERFORM public.log_territory_history('devolucao', v_row.territory_id, v_row.profile_id, COALESCE(p_work_date, CURRENT_DATE),
    format('Devolucao de %s por %s', v_terr_label, COALESCE(v_dirigente, '—')),
    jsonb_build_object('assignment_id', p_assignment_id, 'notes', NULLIF(trim(p_notes), '')));
END; $$;
GRANT EXECUTE ON FUNCTION public.return_territory_field(uuid, date, text) TO authenticated;

-- RLS
ALTER TABLE public.territory_overseers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_active_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_meeting_spots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS territory_overseers_read ON public.territory_overseers;
CREATE POLICY territory_overseers_read ON public.territory_overseers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS territory_overseers_manage ON public.territory_overseers;
CREATE POLICY territory_overseers_manage ON public.territory_overseers FOR ALL TO authenticated
  USING (public.can_manage_territories()) WITH CHECK (public.can_manage_territories());

DROP POLICY IF EXISTS territory_active_read_own_or_manager ON public.territory_active_assignments;
CREATE POLICY territory_active_read_own_or_manager ON public.territory_active_assignments FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.can_manage_territories());
DROP POLICY IF EXISTS territory_active_managers_insert ON public.territory_active_assignments;
CREATE POLICY territory_active_managers_insert ON public.territory_active_assignments FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_territories());
DROP POLICY IF EXISTS territory_active_managers_update ON public.territory_active_assignments;
CREATE POLICY territory_active_managers_update ON public.territory_active_assignments FOR UPDATE TO authenticated
  USING (public.can_manage_territories()) WITH CHECK (public.can_manage_territories());

DROP POLICY IF EXISTS territory_history_read ON public.territory_history;
CREATE POLICY territory_history_read ON public.territory_history FOR SELECT TO authenticated
  USING (public.can_manage_territories());
DROP POLICY IF EXISTS territory_history_insert_manager ON public.territory_history;
CREATE POLICY territory_history_insert_manager ON public.territory_history FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_territories());

DROP POLICY IF EXISTS territory_meeting_spots_read ON public.territory_meeting_spots;
CREATE POLICY territory_meeting_spots_read ON public.territory_meeting_spots FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS territory_meeting_spots_manage ON public.territory_meeting_spots;
CREATE POLICY territory_meeting_spots_manage ON public.territory_meeting_spots FOR ALL TO authenticated
  USING (public.can_manage_territories()) WITH CHECK (public.can_manage_territories());
