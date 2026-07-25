-- Site config editor: leitura pública + gestão Dev

DROP POLICY IF EXISTS site_settings_public_site_config ON public.site_settings;
DROP POLICY IF EXISTS site_settings_manage_site_config ON public.site_settings;

CREATE POLICY site_settings_public_site_config ON public.site_settings
  FOR SELECT
  USING (key = 'site_config');

CREATE POLICY site_settings_manage_site_config ON public.site_settings
  FOR ALL
  TO authenticated
  USING (key IN ('site_config', 'site_config_draft') AND public.can_manage_site_builder())
  WITH CHECK (key IN ('site_config', 'site_config_draft') AND public.can_manage_site_builder());
