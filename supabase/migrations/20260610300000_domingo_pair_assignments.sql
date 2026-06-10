-- Designações de dupla (domingo) não bloqueiam designação individual em outro território.

ALTER TABLE public.territory_active_assignments
  ADD COLUMN IF NOT EXISTS is_domingo_pair boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_domingo_pair_territory_num(p_num text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ltrim(coalesce(p_num, ''), '0') IN ('7', '12', '18');
$$;

DROP FUNCTION IF EXISTS public.assign_territory_field(uuid, uuid, date);

CREATE OR REPLACE FUNCTION public.assign_territory_field(
  p_territory_id uuid,
  p_profile_id uuid,
  p_assigned_at date DEFAULT CURRENT_DATE,
  p_is_domingo_pair boolean DEFAULT false
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
  WHERE territory_id = p_territory_id AND status = 'active'
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Este território já possui designação ativa';
  END IF;

  SELECT id INTO v_existing
  FROM public.territory_active_assignments
  WHERE profile_id = p_profile_id
    AND status = 'active'
    AND NOT is_domingo_pair
  LIMIT 1;
  IF FOUND THEN
    SELECT full_name INTO v_dirigente FROM public.profiles WHERE id = p_profile_id;
    RAISE EXCEPTION 'O dirigente "%" já possui um território ativo', COALESCE(v_dirigente, 'selecionado');
  END IF;

  INSERT INTO public.territory_active_assignments (
    territory_id, profile_id, assigned_at, assigned_by, status, is_domingo_pair
  ) VALUES (
    p_territory_id, p_profile_id, COALESCE(p_assigned_at, CURRENT_DATE), auth.uid(), 'active',
    COALESCE(p_is_domingo_pair, false)
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
    jsonb_build_object('assignment_id', v_assignment_id, 'is_domingo_pair', COALESCE(p_is_domingo_pair, false))
  );

  RETURN v_assignment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_territory_field(uuid, uuid, date, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_territory_field(uuid, uuid, date, boolean) TO authenticated;

-- Designações ativas nos territórios de dupla de domingo passam a não bloquear individual.
UPDATE public.territory_active_assignments ta
SET is_domingo_pair = true
FROM public.territories t
WHERE ta.territory_id = t.id
  AND ta.status = 'active'
  AND public.is_domingo_pair_territory_num(t.num);
