-- Discursos Públicos CRM: temas S-34, congregações, oradores, agenda

CREATE TABLE IF NOT EXISTS public.speech_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outline_number integer NOT NULL UNIQUE,
  title text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.speech_congregations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  contact_name text,
  phone text,
  email text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS speech_congregations_name_ci_idx
  ON public.speech_congregations (lower(trim(name)));

CREATE TABLE IF NOT EXISTS public.speech_speakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  congregation_id uuid REFERENCES public.speech_congregations(id) ON DELETE SET NULL,
  phone text,
  email text,
  privilege text NOT NULL DEFAULT 'anciao'
    CHECK (privilege = ANY (ARRAY['anciao', 'servo_ministerial'])),
  is_local boolean NOT NULL DEFAULT true,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS speech_speakers_name_idx
  ON public.speech_speakers (full_name);

CREATE TABLE IF NOT EXISTS public.speech_speaker_themes (
  speaker_id uuid NOT NULL REFERENCES public.speech_speakers(id) ON DELETE CASCADE,
  theme_id uuid NOT NULL REFERENCES public.speech_themes(id) ON DELETE CASCADE,
  prepared_at date DEFAULT CURRENT_DATE,
  PRIMARY KEY (speaker_id, theme_id)
);

CREATE TABLE IF NOT EXISTS public.speech_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction = ANY (ARRAY['receive', 'send'])),
  event_date date NOT NULL,
  event_time time,
  speaker_id uuid REFERENCES public.speech_speakers(id) ON DELETE SET NULL,
  speaker_name text,
  theme_id uuid REFERENCES public.speech_themes(id) ON DELETE SET NULL,
  outline_number integer,
  theme_title text,
  congregation_id uuid REFERENCES public.speech_congregations(id) ON DELETE SET NULL,
  congregation_name text,
  opening_song text,
  modality text NOT NULL DEFAULT 'presencial'
    CHECK (modality = ANY (ARRAY['presencial', 'online'])),
  confirmation_status text NOT NULL DEFAULT 'pendente'
    CHECK (confirmation_status = ANY (ARRAY['pendente', 'confirmado', 'cancelado'])),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS speech_assignments_event_date_idx
  ON public.speech_assignments (event_date DESC, direction);

CREATE INDEX IF NOT EXISTS speech_assignments_speaker_idx
  ON public.speech_assignments (speaker_id, event_date DESC);

CREATE INDEX IF NOT EXISTS speech_assignments_status_idx
  ON public.speech_assignments (confirmation_status, event_date);

ALTER TABLE public.speech_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speech_congregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speech_speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speech_speaker_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speech_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS speech_themes_managers_all ON public.speech_themes;
CREATE POLICY speech_themes_managers_all
  ON public.speech_themes FOR ALL TO authenticated
  USING (public.can_manage_public_speeches())
  WITH CHECK (public.can_manage_public_speeches());

DROP POLICY IF EXISTS speech_congregations_managers_all ON public.speech_congregations;
CREATE POLICY speech_congregations_managers_all
  ON public.speech_congregations FOR ALL TO authenticated
  USING (public.can_manage_public_speeches())
  WITH CHECK (public.can_manage_public_speeches());

DROP POLICY IF EXISTS speech_speakers_managers_all ON public.speech_speakers;
CREATE POLICY speech_speakers_managers_all
  ON public.speech_speakers FOR ALL TO authenticated
  USING (public.can_manage_public_speeches())
  WITH CHECK (public.can_manage_public_speeches());

DROP POLICY IF EXISTS speech_speaker_themes_managers_all ON public.speech_speaker_themes;
CREATE POLICY speech_speaker_themes_managers_all
  ON public.speech_speaker_themes FOR ALL TO authenticated
  USING (public.can_manage_public_speeches())
  WITH CHECK (public.can_manage_public_speeches());

DROP POLICY IF EXISTS speech_assignments_managers_all ON public.speech_assignments;
CREATE POLICY speech_assignments_managers_all
  ON public.speech_assignments FOR ALL TO authenticated
  USING (public.can_manage_public_speeches())
  WITH CHECK (public.can_manage_public_speeches());

-- Leitura para Quadro de Anúncios (sync final de semana)
DROP POLICY IF EXISTS speech_assignments_announcements_read ON public.speech_assignments;
CREATE POLICY speech_assignments_announcements_read
  ON public.speech_assignments FOR SELECT TO authenticated
  USING (public.can_manage_content());

DROP POLICY IF EXISTS speech_themes_announcements_read ON public.speech_themes;
CREATE POLICY speech_themes_announcements_read
  ON public.speech_themes FOR SELECT TO authenticated
  USING (public.can_manage_content());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.speech_themes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speech_congregations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speech_speakers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speech_speaker_themes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speech_assignments TO authenticated;
