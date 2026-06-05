-- Sistema completo de gestão de territórios (substitui planilha + Forms)

-- ── Campos extras no catálogo ───────────────────────────────────────────────
ALTER TABLE public.territories
  ADD COLUMN IF NOT EXISTS last_worked_at date,
  ADD COLUMN IF NOT EXISTS territory_type text NOT NULL DEFAULT 'meio_de_semana',
  ADD COLUMN IF NOT EXISTS best_occasion text,
  ADD COLUMN IF NOT EXISTS observations text;

-- ── Dirigentes de território ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.territory_overseers (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  preference text NOT NULL DEFAULT 'meio_de_semana'
    CHECK (preference IN ('meio_de_semana', 'final_de_semana', 'ambos')),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Designação de campo (até devolução pelo servo) ───────────────────────────
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
  ON public.territory_active_assignments (territory_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS territory_active_one_per_profile
  ON public.territory_active_assignments (profile_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS territory_active_profile_idx
  ON public.territory_active_assignments (profile_id, status);

-- ── Histórico ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.territory_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL
    CHECK (event_type IN ('designacao', 'devolucao', 'edicao', 'cronograma', 'status')),
  territory_id uuid REFERENCES public.territories(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  details text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS territory_history_created_at_idx
  ON public.territory_history (created_at DESC);

CREATE INDEX IF NOT EXISTS territory_history_territory_idx
  ON public.territory_history (territory_id, created_at DESC);

-- ── Locais de encontro por dia ──────────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS territory_meeting_spots_weekday_idx
  ON public.territory_meeting_spots (weekday_label, sort_order);

-- Cronograma semanal (colunas extras) ─────────────────────────────────────
ALTER TABLE public.territory_assignments
  ADD COLUMN IF NOT EXISTS location_name text,
  ADD COLUMN IF NOT EXISTS schedule_times text,
  ADD COLUMN IF NOT EXISTS suggestion text,
  ADD COLUMN IF NOT EXISTS observation_override text;

ALTER TABLE public.territory_assignments
  ALTER COLUMN territory_id DROP NOT NULL;

-- ── Funções auxiliares ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_territory_history(
  p_event_type text,
  p_territory_id uuid,
  p_profile_id uuid,
  p_event_date date,
  p_details text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.territory_history (
    event_type, territory_id, profile_id, event_date, details, metadata, created_by
  ) VALUES (
    p_event_type, p_territory_id, p_profile_id, p_event_date, p_details, p_metadata, auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_territory_history(text, uuid, uuid, date, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_territory_history(text, uuid, uuid, date, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_territory_field(
  p_territory_id uuid,
  p_profile_id uuid,
  p_assigned_at date DEFAULT CURRENT_DATE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_territory public.territories%ROWTYPE;
  v_existing uuid;
  v_assignment_id uuid;
  v_dirigente text;
  v_terr_label text;
BEGIN
  IF NOT public.can_manage_territories() THEN
    RAISE EXCEPTION 'Sem permissão para designar territórios';
  END IF;

  SELECT * INTO v_territory FROM public.territories WHERE id = p_territory_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Território não encontrado';
  END IF;
  IF v_territory.status = 'designado' THEN
    RAISE EXCEPTION 'Este território já está designado';
  END IF;

  SELECT id INTO v_existing
  FROM public.territory_active_assignments
  WHERE profile_id = p_profile_id AND status = 'active'
  LIMIT 1;
  IF FOUND THEN
    SELECT full_name INTO v_dirigente FROM public.profiles WHERE id = p_profile_id;
    RAISE EXCEPTION 'O dirigente "%" já possui um território ativo', COALESCE(v_dirigente, 'selecionado');
  END IF;

  INSERT INTO public.territory_active_assignments (
    territory_id, profile_id, assigned_at, assigned_by, status
  ) VALUES (
    p_territory_id, p_profile_id, COALESCE(p_assigned_at, CURRENT_DATE), auth.uid(), 'active'
  )
  RETURNING id INTO v_assignment_id;

  UPDATE public.territories
  SET status = 'designado'
  WHERE id = p_territory_id;

  SELECT full_name INTO v_dirigente FROM public.profiles WHERE id = p_profile_id;
  v_terr_label := 'T' || v_territory.num || ' · ' || v_territory.display_name;

  PERFORM public.log_territory_history(
    'designacao',
    p_territory_id,
    p_profile_id,
    COALESCE(p_assigned_at, CURRENT_DATE),
    format('Designado para %s: %s', COALESCE(v_dirigente, '—'), v_terr_label),
    jsonb_build_object('assignment_id', v_assignment_id)
  );

  RETURN v_assignment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_territory_field(uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_territory_field(uuid, uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.return_territory_field(
  p_assignment_id uuid,
  p_work_date date,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.territory_active_assignments%ROWTYPE;
  v_territory public.territories%ROWTYPE;
  v_dirigente text;
  v_terr_label text;
BEGIN
  IF NOT public.can_manage_territories() THEN
    RAISE EXCEPTION 'Sem permissão para devolver territórios';
  END IF;

  SELECT * INTO v_row
  FROM public.territory_active_assignments
  WHERE id = p_assignment_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Designação ativa não encontrada';
  END IF;

  SELECT * INTO v_territory FROM public.territories WHERE id = v_row.territory_id;
  SELECT full_name INTO v_dirigente FROM public.profiles WHERE id = v_row.profile_id;

  UPDATE public.territory_active_assignments
  SET
    status = 'returned',
    returned_at = now(),
    last_work_date = COALESCE(p_work_date, CURRENT_DATE),
    return_notes = NULLIF(trim(p_notes), ''),
    updated_at = now()
  WHERE id = p_assignment_id;

  UPDATE public.territories
  SET
    status = 'disponivel',
    last_worked_at = COALESCE(p_work_date, CURRENT_DATE),
    observations = COALESCE(NULLIF(trim(p_notes), ''), observations)
  WHERE id = v_row.territory_id;

  v_terr_label := 'T' || v_territory.num || ' · ' || v_territory.display_name;

  PERFORM public.log_territory_history(
    'devolucao',
    v_row.territory_id,
    v_row.profile_id,
    COALESCE(p_work_date, CURRENT_DATE),
    format('Devolução de %s por %s', v_terr_label, COALESCE(v_dirigente, '—')),
    jsonb_build_object(
      'assignment_id', p_assignment_id,
      'notes', NULLIF(trim(p_notes), '')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.return_territory_field(uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.return_territory_field(uuid, date, text) TO authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.territory_overseers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_active_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_meeting_spots ENABLE ROW LEVEL SECURITY;

CREATE POLICY territory_overseers_read
  ON public.territory_overseers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY territory_overseers_manage
  ON public.territory_overseers FOR ALL
  TO authenticated
  USING (public.can_manage_territories())
  WITH CHECK (public.can_manage_territories());

CREATE POLICY territory_active_read_own_or_manager
  ON public.territory_active_assignments FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.can_manage_territories()
  );

CREATE POLICY territory_active_managers_insert
  ON public.territory_active_assignments FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_territories());

CREATE POLICY territory_active_managers_update
  ON public.territory_active_assignments FOR UPDATE
  TO authenticated
  USING (public.can_manage_territories())
  WITH CHECK (public.can_manage_territories());

CREATE POLICY territory_history_read
  ON public.territory_history FOR SELECT
  TO authenticated
  USING (public.can_manage_territories());

CREATE POLICY territory_history_insert_manager
  ON public.territory_history FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_territories());

CREATE POLICY territory_meeting_spots_read
  ON public.territory_meeting_spots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY territory_meeting_spots_manage
  ON public.territory_meeting_spots FOR ALL
  TO authenticated
  USING (public.can_manage_territories())
  WITH CHECK (public.can_manage_territories());
