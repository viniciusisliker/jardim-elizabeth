-- Nome exibido (full_name): usuário altera o próprio; SuperUser altera qualquer membro.

CREATE OR REPLACE FUNCTION public.update_my_profile_full_name(p_full_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  v_name := trim(p_full_name);
  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Informe um nome entre 2 e 120 caracteres.';
  END IF;

  UPDATE public.profiles
  SET full_name = v_name, updated_at = now()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil nao encontrado.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_profile_full_name(p_profile_id uuid, p_full_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF NOT public.is_superuser() THEN
    RAISE EXCEPTION 'Sem permissao para alterar nome.';
  END IF;

  v_name := trim(p_full_name);
  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Informe um nome entre 2 e 120 caracteres.';
  END IF;

  UPDATE public.profiles
  SET full_name = v_name, updated_at = now()
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil nao encontrado.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_profile_full_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile_full_name(text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_profile_full_name(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_profile_full_name(uuid, text) TO authenticated;
