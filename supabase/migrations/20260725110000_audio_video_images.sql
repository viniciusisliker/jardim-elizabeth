-- Imagens de referência da equipe de Áudio e Vídeo (diagramas, equipamentos, layout…).

CREATE TABLE IF NOT EXISTS public.audio_video_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  caption text NOT NULL DEFAULT '',
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audio_video_images_created_idx
  ON public.audio_video_images (created_at DESC);

ALTER TABLE public.audio_video_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY audio_video_images_select ON public.audio_video_images
  FOR SELECT TO authenticated
  USING (public.can_manage_audio_video());

CREATE POLICY audio_video_images_manage ON public.audio_video_images
  FOR ALL TO authenticated
  USING (public.can_manage_audio_video())
  WITH CHECK (public.can_manage_audio_video());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audio_video_images TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-video', 'audio-video', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS audio_video_storage_read ON storage.objects;
CREATE POLICY audio_video_storage_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'audio-video' AND public.can_manage_audio_video());

DROP POLICY IF EXISTS audio_video_storage_write ON storage.objects;
CREATE POLICY audio_video_storage_write ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'audio-video' AND public.can_manage_audio_video());

DROP POLICY IF EXISTS audio_video_storage_update ON storage.objects;
CREATE POLICY audio_video_storage_update ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'audio-video' AND public.can_manage_audio_video())
  WITH CHECK (bucket_id = 'audio-video' AND public.can_manage_audio_video());

DROP POLICY IF EXISTS audio_video_storage_delete ON storage.objects;
CREATE POLICY audio_video_storage_delete ON storage.objects
  FOR DELETE
  USING (bucket_id = 'audio-video' AND public.can_manage_audio_video());
