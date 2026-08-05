-- Permite que responsáveis pelo Quadro de Anúncios atualizem announcement_sections

DROP POLICY IF EXISTS "announcement_sections_managers_announcements" ON public.announcement_sections;

CREATE POLICY "announcement_sections_managers_announcements"
  ON public.announcement_sections
  FOR ALL
  USING (public.can_manage_announcements())
  WITH CHECK (public.can_manage_announcements());
