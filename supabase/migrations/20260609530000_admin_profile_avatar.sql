-- SuperUser: alterar foto de perfil de outros membros + storage

CREATE OR REPLACE FUNCTION public.admin_update_profile_avatar(p_profile_id uuid, p_avatar_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superuser() THEN
    RAISE EXCEPTION 'Sem permissao para alterar foto.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id) THEN
    RAISE EXCEPTION 'Membro nao encontrado.';
  END IF;

  UPDATE public.profiles
  SET avatar_url = NULLIF(trim(p_avatar_url), ''),
      updated_at = now()
  WHERE id = p_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_profile_avatar(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_profile_avatar(uuid, text) TO authenticated;

DROP POLICY IF EXISTS profile_avatars_super_insert ON storage.objects;
CREATE POLICY profile_avatars_super_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-avatars' AND public.is_superuser());

DROP POLICY IF EXISTS profile_avatars_super_update ON storage.objects;
CREATE POLICY profile_avatars_super_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-avatars' AND public.is_superuser())
  WITH CHECK (bucket_id = 'profile-avatars' AND public.is_superuser());

DROP POLICY IF EXISTS profile_avatars_super_delete ON storage.objects;
CREATE POLICY profile_avatars_super_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'profile-avatars' AND public.is_superuser());
