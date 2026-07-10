-- Cole no SQL Editor do Supabase (projeto prhijmkvsgqusivmnqzx) e execute.
-- Idempotente: pode rodar mais de uma vez.

DROP INDEX IF EXISTS public.territory_active_one_individual_per_profile;

DROP FUNCTION IF EXISTS public.assign_territory_field(uuid, uuid, date, boolean);

CREATE OR REPLACE FUNCTION public.assign_territory_field(
  p_territory_id uuid,
  p_profile_id uuid,
  p_assigned_at date DEFAULT CURRENT_DATE,
  p_is_domingo_pair boolean DEFAULT false,
  p_allow_multiple_individual boolean DEFAULT false
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
  v_is_pair boolean := COALESCE(p_is_domingo_pair, false);
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

  IF v_is_pair THEN
    SELECT id INTO v_existing
    FROM public.territory_active_assignments
    WHERE profile_id = p_profile_id
      AND status = 'active'
      AND is_domingo_pair
      AND territory_id <> p_territory_id
    LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'Este dirigente já possui uma dupla de domingo ativa';
    END IF;
  ELSIF NOT COALESCE(p_allow_multiple_individual, false) THEN
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
  END IF;

  INSERT INTO public.territory_active_assignments (
    territory_id, profile_id, assigned_at, assigned_by, status, is_domingo_pair
  ) VALUES (
    p_territory_id, p_profile_id, COALESCE(p_assigned_at, CURRENT_DATE), auth.uid(), 'active',
    v_is_pair
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
    jsonb_build_object(
      'assignment_id', v_assignment_id,
      'is_domingo_pair', v_is_pair,
      'allow_multiple_individual', COALESCE(p_allow_multiple_individual, false)
    )
  );

  RETURN v_assignment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_territory_field(uuid, uuid, date, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_territory_field(uuid, uuid, date, boolean, boolean) TO authenticated;
