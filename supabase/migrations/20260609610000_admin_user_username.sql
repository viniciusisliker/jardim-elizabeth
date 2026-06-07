-- SuperUser: alterar username de login (profiles.username)

CREATE OR REPLACE FUNCTION public.admin_update_user_username(p_profile_id uuid, p_new_username text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
BEGIN
  IF NOT public.is_superuser() THEN
    RAISE EXCEPTION 'Sem permissao para alterar usuario.';
  END IF;

  v_username := lower(trim(p_new_username));
  IF v_username = '' OR v_username !~ '^[a-z0-9._-]{3,32}$' THEN
    RAISE EXCEPTION 'Informe um usuario valido (3-32 caracteres: letras, numeros, ponto, hifen ou underline).';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE username = v_username AND id <> p_profile_id
  ) THEN
    RAISE EXCEPTION 'Este usuario ja esta em uso.';
  END IF;

  UPDATE public.profiles
  SET username = v_username, updated_at = now()
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil nao encontrado.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_username(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_username(uuid, text) TO authenticated;
