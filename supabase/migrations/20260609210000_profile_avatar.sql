-- Foto de perfil (avatar) — coluna, storage e RPC segura

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.profiles.avatar_url IS
  'URL pública da foto de perfil (storage profile-avatars).';

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-avatars', 'profile-avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS profile_avatars_public_read ON storage.objects;
CREATE POLICY profile_avatars_public_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'profile-avatars');

DROP POLICY IF EXISTS profile_avatars_own_insert ON storage.objects;
CREATE POLICY profile_avatars_own_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS profile_avatars_own_update ON storage.objects;
CREATE POLICY profile_avatars_own_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS profile_avatars_own_delete ON storage.objects;
CREATE POLICY profile_avatars_own_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE OR REPLACE FUNCTION public.update_my_profile_avatar(p_avatar_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  UPDATE public.profiles
  SET avatar_url = NULLIF(trim(p_avatar_url), '')
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_profile_avatar(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile_avatar(text) TO authenticated;
