-- Sub-cargos congregacionais (Secretário, Coordenador, etc.) — designação interna de anciãos/servos,
-- distinto do cargo (anciao, servo_ministerial) e das designações de acesso a módulos.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sub_role text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_sub_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_sub_role_check CHECK (
    sub_role IS NULL
    OR sub_role IN ('secretario', 'coordenador', 'superintendente_servico')
  );

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_sub_role_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_sub_role_role_check CHECK (
    sub_role IS NULL
    OR role IN ('anciao', 'servo_ministerial')
  );

-- Migrar cargo secretario (legado) → ancião + sub-cargo Secretário
UPDATE public.profiles
SET
  role = 'anciao',
  sub_role = COALESCE(sub_role, 'secretario')
WHERE role = 'secretario';

-- Migrar designação textual "Secretário" → sub_role estruturado
UPDATE public.profiles
SET
  sub_role = 'secretario',
  designation = NULL
WHERE sub_role IS NULL
  AND role IN ('anciao', 'servo_ministerial')
  AND (
    designation ILIKE 'secretário'
    OR designation ILIKE 'secretario'
    OR designation ILIKE 'secretaria'
  );

CREATE OR REPLACE FUNCTION public.is_secretario()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'secretario'
        OR p.sub_role = 'secretario'
        OR public.has_access_permission('secretario')
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

REVOKE ALL ON FUNCTION public.is_secretario() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_secretario() TO authenticated;

REVOKE ALL ON FUNCTION public.je_can_access_hub(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.je_can_access_hub(uuid) TO authenticated;
