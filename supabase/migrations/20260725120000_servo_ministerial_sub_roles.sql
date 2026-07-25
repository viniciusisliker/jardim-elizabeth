-- Sub-cargos para servos ministeriais (Áudio e Vídeo, Territórios, Quadro de Anúncios, Publicações).

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_sub_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_sub_role_check CHECK (
    sub_role IS NULL
    OR sub_role IN (
      'secretario',
      'coordenador',
      'superintendente_servico',
      'audio_video',
      'territorios',
      'quadro_anuncios',
      'publicacoes'
    )
  );

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_sub_role_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_sub_role_role_check CHECK (
    sub_role IS NULL
    OR (
      role = 'anciao'
      AND sub_role IN ('secretario', 'coordenador', 'superintendente_servico')
    )
    OR (
      role = 'servo_ministerial'
      AND sub_role IN ('audio_video', 'territorios', 'quadro_anuncios', 'publicacoes')
    )
  );

CREATE OR REPLACE FUNCTION public.servo_sub_role_permissions(p_sub_role text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_sub_role
    WHEN 'audio_video' THEN ARRAY['hub', 'audio_video']::text[]
    WHEN 'territorios' THEN ARRAY['hub', 'territorios']::text[]
    WHEN 'quadro_anuncios' THEN ARRAY['hub', 'announcements']::text[]
    WHEN 'publicacoes' THEN ARRAY['hub', 'agenda']::text[]
    ELSE '{}'::text[]
  END;
$$;

CREATE OR REPLACE FUNCTION public.profile_has_access_designations(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profile_access_designations pad
    JOIN public.access_designations d ON d.id = pad.designation_id
    WHERE pad.profile_id = p_user_id
      AND d.is_active = true
  );
$$;

REVOKE ALL ON FUNCTION public.servo_sub_role_permissions(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.servo_sub_role_permissions(text) TO authenticated;

REVOKE ALL ON FUNCTION public.profile_has_access_designations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_has_access_designations(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_access_permission(p_perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_superuser()
    OR (
      public.profile_has_access_designations()
      AND p_perm = ANY(public.get_profile_permissions(auth.uid()))
    )
    OR (
      NOT public.profile_has_access_designations()
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'servo_ministerial'
          AND p.sub_role IS NOT NULL
          AND p_perm = ANY(public.servo_sub_role_permissions(p.sub_role))
      )
    )
    OR (
      NOT public.profile_has_access_designations()
      AND NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'servo_ministerial'
          AND p.sub_role IS NOT NULL
      )
      AND public.can_manage_content()
    )
    OR (
      p_perm = 'announcements'
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND can_announcements = true
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.je_can_access_hub(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND (
        p.role = 'superuser'
        OR p.role IN ('anciao', 'servo_ministerial', 'superintendente')
        OR p.can_announcements = true
        OR public.profile_has_access_designations(p.id)
        OR (
          p.role = 'servo_ministerial'
          AND p.sub_role IS NOT NULL
          AND 'hub' = ANY(public.servo_sub_role_permissions(p.sub_role))
        )
        OR EXISTS (
          SELECT 1
          FROM public.profile_access_designations pad
          JOIN public.access_designations d ON d.id = pad.designation_id
          WHERE pad.profile_id = p.id
            AND d.is_active = true
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_access_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_access_permission(text) TO authenticated;

REVOKE ALL ON FUNCTION public.je_can_access_hub(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.je_can_access_hub(uuid) TO authenticated;
