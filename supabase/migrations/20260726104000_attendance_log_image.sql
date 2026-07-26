-- Foto opcional no registro de assistência (Áudio e Vídeo).

ALTER TABLE public.secretary_attendance_logs
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS image_name text;

-- Secretário também precisa ver as fotos anexadas aos registros.
DROP POLICY IF EXISTS audio_video_storage_read ON storage.objects;
CREATE POLICY audio_video_storage_read ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'audio-video'
    AND (
      public.can_manage_audio_video()
      OR public.can_manage_secretary_service()
    )
  );
