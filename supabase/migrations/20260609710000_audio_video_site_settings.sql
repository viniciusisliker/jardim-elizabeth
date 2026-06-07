-- Permite que gestores de Áudio e Vídeo salvem notas compartilhadas (site_settings.audio_video)

DROP POLICY IF EXISTS "Audio video managers manage audio_video settings" ON public.site_settings;

CREATE POLICY "Audio video managers manage audio_video settings"
  ON public.site_settings
  FOR ALL
  TO authenticated
  USING (key = 'audio_video' AND public.can_manage_audio_video())
  WITH CHECK (key = 'audio_video' AND public.can_manage_audio_video());
