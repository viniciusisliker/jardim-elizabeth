-- SuperUser: listar e alterar e-mail de login (auth.users)

CREATE OR REPLACE FUNCTION public.list_team_member_emails()
RETURNS TABLE (profile_id uuid, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  IF NOT public.is_superuser() THEN
    RAISE EXCEPTION 'Sem permissao para listar e-mails.';
  END IF;

  RETURN QUERY
  SELECT p.id, u.email::text
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.full_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_email(p_profile_id uuid, p_new_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_email text;
BEGIN
  IF NOT public.is_superuser() THEN
    RAISE EXCEPTION 'Sem permissao para alterar e-mail.';
  END IF;

  v_email := lower(trim(p_new_email));
  IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Informe um e-mail valido.';
  END IF;

  UPDATE auth.users
  SET
    email = v_email,
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario nao encontrado.';
  END IF;

  UPDATE auth.identities
  SET
    identity_data = jsonb_set(
      jsonb_set(COALESCE(identity_data, '{}'::jsonb), '{email}', to_jsonb(v_email), true),
      '{email_verified}', 'true'::jsonb, true
    ),
    updated_at = now()
  WHERE user_id = p_profile_id
    AND provider = 'email';
END;
$$;

REVOKE ALL ON FUNCTION public.list_team_member_emails() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_team_member_emails() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_user_email(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_email(uuid, text) TO authenticated;
