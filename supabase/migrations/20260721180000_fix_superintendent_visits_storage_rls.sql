-- Corrige upload no bucket superintendent-visits: policies de storage devem
-- usar role public (como announcements), não só authenticated.

CREATE OR REPLACE FUNCTION public.can_manage_superintendent_visits()
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
        p.role = 'superuser'::congregation_role
        OR p.role = 'secretario'::congregation_role
        OR p.sub_role = 'secretario'
        OR public.has_access_permission('secretario')
      )
  );
$$;

DROP POLICY IF EXISTS superintendent_visits_storage_read ON storage.objects;
CREATE POLICY superintendent_visits_storage_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'superintendent-visits' AND public.can_read_superintendent_visits());

DROP POLICY IF EXISTS superintendent_visits_storage_write ON storage.objects;
CREATE POLICY superintendent_visits_storage_write ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'superintendent-visits' AND public.can_manage_superintendent_visits());

DROP POLICY IF EXISTS superintendent_visits_storage_update ON storage.objects;
CREATE POLICY superintendent_visits_storage_update ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'superintendent-visits' AND public.can_manage_superintendent_visits())
  WITH CHECK (bucket_id = 'superintendent-visits' AND public.can_manage_superintendent_visits());

DROP POLICY IF EXISTS superintendent_visits_storage_delete ON storage.objects;
CREATE POLICY superintendent_visits_storage_delete ON storage.objects
  FOR DELETE
  USING (bucket_id = 'superintendent-visits' AND public.can_manage_superintendent_visits());
