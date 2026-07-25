-- Registro de assistência por reunião (preenchido por Áudio e Vídeo; histórico no Secretário).

CREATE TABLE IF NOT EXISTS public.secretary_attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_date date NOT NULL,
  meeting_kind text NOT NULL CHECK (meeting_kind IN ('midweek', 'weekend')),
  attendance_count integer NOT NULL CHECK (attendance_count >= 0),
  extra_count integer CHECK (extra_count IS NULL OR extra_count >= 0),
  remarks text NOT NULL DEFAULT '',
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS secretary_attendance_logs_meeting_date_idx
  ON public.secretary_attendance_logs (meeting_date DESC);

CREATE INDEX IF NOT EXISTS secretary_attendance_logs_kind_date_idx
  ON public.secretary_attendance_logs (meeting_kind, meeting_date DESC);

ALTER TABLE public.secretary_attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY secretary_attendance_logs_select ON public.secretary_attendance_logs
  FOR SELECT TO authenticated
  USING (
    public.can_manage_secretary_service()
    OR public.can_manage_audio_video()
  );

CREATE POLICY secretary_attendance_logs_manage ON public.secretary_attendance_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_audio_video());

CREATE POLICY secretary_attendance_logs_update ON public.secretary_attendance_logs
  FOR UPDATE TO authenticated
  USING (public.can_manage_audio_video())
  WITH CHECK (public.can_manage_audio_video());

CREATE POLICY secretary_attendance_logs_delete ON public.secretary_attendance_logs
  FOR DELETE TO authenticated
  USING (public.can_manage_audio_video());

-- Áudio e Vídeo precisa ler a flag de contagem extra nas configurações do Secretário.
CREATE POLICY secretary_settings_av_read ON public.secretary_settings
  FOR SELECT TO authenticated
  USING (public.can_manage_audio_video());
