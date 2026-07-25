-- Assistência remota via Zoom (registrada pela equipe de Áudio e Vídeo).

ALTER TABLE public.secretary_attendance_logs
  ADD COLUMN IF NOT EXISTS zoom_attendance_count integer
  CHECK (zoom_attendance_count IS NULL OR zoom_attendance_count >= 0);
