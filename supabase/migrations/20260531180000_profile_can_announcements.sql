-- Permissão granular: Quadro de Anúncios

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_announcements boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.can_announcements IS
  'Acesso ao editor do Quadro de Anúncios (independente do cargo, quando aplicável).';

CREATE OR REPLACE FUNCTION public.can_manage_announcements()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND (
        role IN ('superuser', 'anciao', 'servo_ministerial')
        OR can_announcements = true
      )
  );
$$;

-- André Neves — responsável pelo Quadro de Anúncios
UPDATE public.profiles
SET can_announcements = true,
    updated_at = now()
WHERE username = 'andre.neves';

DROP POLICY IF EXISTS announcement_boards_managers_all ON public.announcement_boards;
CREATE POLICY announcement_boards_managers_all
  ON public.announcement_boards FOR ALL
  USING (public.can_manage_announcements())
  WITH CHECK (public.can_manage_announcements());

DROP POLICY IF EXISTS announcement_entries_managers_all ON public.announcement_entries;
CREATE POLICY announcement_entries_managers_all
  ON public.announcement_entries FOR ALL
  USING (public.can_manage_announcements())
  WITH CHECK (public.can_manage_announcements());

DROP POLICY IF EXISTS announcements_managers_insert ON storage.objects;
CREATE POLICY announcements_managers_insert
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'announcements' AND public.can_manage_announcements());

DROP POLICY IF EXISTS announcements_managers_update ON storage.objects;
CREATE POLICY announcements_managers_update
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'announcements' AND public.can_manage_announcements());

DROP POLICY IF EXISTS announcements_managers_delete ON storage.objects;
CREATE POLICY announcements_managers_delete
  ON storage.objects FOR DELETE
  USING (bucket_id = 'announcements' AND public.can_manage_announcements());

DROP POLICY IF EXISTS announcements_managers_select ON storage.objects;
CREATE POLICY announcements_managers_select
  ON storage.objects FOR SELECT
  USING (bucket_id = 'announcements' AND public.can_manage_announcements());
