-- E-mail opcional ao criar membro; corrige insert em auth.identities (coluna email gerada).

CREATE OR REPLACE FUNCTION public.admin_create_team_member(
  p_full_name text,
  p_username text,
  p_email text,
  p_password text,
  p_role public.congregation_role DEFAULT 'publicador'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, extensions, public
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_name text;
  v_username text;
  v_email text;
  v_password text;
BEGIN
  IF NOT public.is_superuser() THEN
    RAISE EXCEPTION 'Sem permissao para criar membro.';
  END IF;

  v_name := regexp_replace(trim(COALESCE(p_full_name, '')), '\s+', ' ', 'g');
  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Informe um nome entre 2 e 120 caracteres.';
  END IF;

  v_username := lower(trim(COALESCE(p_username, '')));
  IF v_username = '' OR v_username !~ '^[a-z0-9._-]{3,32}$' THEN
    RAISE EXCEPTION 'Informe um usuario valido (3-32 caracteres: letras, numeros, ponto, hifen ou underline).';
  END IF;

  v_email := lower(trim(COALESCE(p_email, '')));
  IF v_email <> '' AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Informe um e-mail valido.';
  END IF;
  IF v_email = '' THEN
    v_email := v_username || '@jardimelizabeth.org';
  END IF;

  v_password := COALESCE(p_password, '');
  IF char_length(v_password) < 8 THEN
    RAISE EXCEPTION 'A senha deve ter pelo menos 8 caracteres.';
  END IF;
  IF char_length(v_password) > 72 THEN
    RAISE EXCEPTION 'A senha deve ter no maximo 72 caracteres.';
  END IF;

  IF p_role IS NULL THEN
    RAISE EXCEPTION 'Informe um cargo valido.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_username) THEN
    RAISE EXCEPTION 'Este usuario ja esta em uso.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = v_email AND is_sso_user = false
  ) THEN
    RAISE EXCEPTION 'Este e-mail ja esta em uso.';
  END IF;

  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    v_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'role', p_role::text
    ),
    jsonb_build_object('full_name', v_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_id,
    v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email),
    'email',
    now(),
    now(),
    now()
  );

  INSERT INTO public.profiles (
    id,
    full_name,
    username,
    role,
    created_at,
    updated_at
  ) VALUES (
    v_id,
    v_name,
    v_username,
    p_role,
    now(),
    now()
  );

  RETURN v_id;
END;
$$;
