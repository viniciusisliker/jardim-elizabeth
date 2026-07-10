-- Dev (designação Desenvolvedor): alterar senha de membros da equipe.

CREATE OR REPLACE FUNCTION public.is_developer()
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
        COALESCE(p.designation, '') ILIKE '%desenvolvedor%'
        OR EXISTS (
          SELECT 1
          FROM public.profile_access_designations pad
          JOIN public.access_designations d ON d.id = pad.designation_id
          WHERE pad.profile_id = p.id
            AND d.is_active = true
            AND (
              COALESCE(d.slug, '') ILIKE '%desenvolvedor%'
              OR COALESCE(d.label, '') ILIKE '%desenvolvedor%'
            )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_developer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_developer() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_user_password(
  p_profile_id uuid,
  p_new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, extensions, public
AS $$
DECLARE
  v_password text;
BEGIN
  IF NOT public.is_developer() THEN
    RAISE EXCEPTION 'Somente o Dev pode alterar senha de membros.';
  END IF;

  IF p_profile_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao encontrado.';
  END IF;

  v_password := COALESCE(p_new_password, '');
  IF char_length(v_password) < 8 THEN
    RAISE EXCEPTION 'A senha deve ter pelo menos 8 caracteres.';
  END IF;
  IF char_length(v_password) > 72 THEN
    RAISE EXCEPTION 'A senha deve ter no maximo 72 caracteres.';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = crypt(v_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario nao encontrado.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_password(uuid, text) TO authenticated;
