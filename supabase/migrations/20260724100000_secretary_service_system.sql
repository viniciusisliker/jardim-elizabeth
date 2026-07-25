-- Sistema de Secretário: grupos, relatórios de campo, assistência, S-1 e ajustes.

CREATE OR REPLACE FUNCTION public.can_manage_secretary_service()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_superuser() OR public.is_secretario();
$$;

REVOKE ALL ON FUNCTION public.can_manage_secretary_service() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_secretary_service() TO authenticated;

CREATE TABLE IF NOT EXISTS public.secretary_service_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TYPE public.secretary_publisher_type AS ENUM (
    'publicador', 'pioneiro_auxiliar', 'pioneiro_regular'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.secretary_publisher_status AS ENUM (
    'ativo', 'irregular', 'inativo', 'reintegrado', 'primeiro_relatorio'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.secretary_publisher_profiles (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.secretary_service_groups(id) ON DELETE SET NULL,
  publisher_type public.secretary_publisher_type NOT NULL DEFAULT 'publicador',
  status public.secretary_publisher_status NOT NULL DEFAULT 'ativo',
  baptism_date date,
  birth_date date,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  is_starred boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.secretary_field_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_year integer NOT NULL,
  service_month integer NOT NULL CHECK (service_month BETWEEN 1 AND 12),
  participated boolean NOT NULL DEFAULT false,
  hours numeric(6, 1),
  bible_studies integer,
  placements integer,
  return_visits integer,
  videos integer,
  remarks text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, service_year, service_month)
);

CREATE INDEX IF NOT EXISTS secretary_field_reports_month_idx
  ON public.secretary_field_reports (service_year, service_month);

CREATE TABLE IF NOT EXISTS public.secretary_meeting_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_year integer NOT NULL,
  service_month integer NOT NULL CHECK (service_month BETWEEN 1 AND 12),
  meeting_kind text NOT NULL CHECK (meeting_kind IN ('midweek', 'weekend')),
  attendance_count integer NOT NULL DEFAULT 0,
  extra_count integer,
  UNIQUE (service_year, service_month, meeting_kind)
);

CREATE TABLE IF NOT EXISTS public.secretary_month_status (
  service_year integer NOT NULL,
  service_month integer NOT NULL CHECK (service_month BETWEEN 1 AND 12),
  is_closed boolean NOT NULL DEFAULT false,
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  observations text NOT NULL DEFAULT '',
  PRIMARY KEY (service_year, service_month)
);

CREATE TABLE IF NOT EXISTS public.secretary_month_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_year integer NOT NULL,
  service_month integer NOT NULL CHECK (service_month BETWEEN 1 AND 12),
  category text NOT NULL CHECK (category IN ('publicadores', 'pioneiro_auxiliar', 'pioneiro_regular')),
  field_key text NOT NULL CHECK (field_key IN ('relatorios', 'horas', 'estudos_biblicos', 'irregulares')),
  adjustment_value numeric NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  UNIQUE (service_year, service_month, category, field_key)
);

CREATE TABLE IF NOT EXISTS public.secretary_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  reminder_message text NOT NULL DEFAULT 'Oi, tudo bem? Por favor, não se esqueça de enviar seu relatório. Obrigado.',
  show_last_name_first boolean NOT NULL DEFAULT false,
  distance_field_enabled boolean NOT NULL DEFAULT false,
  extra_bible_study_enabled boolean NOT NULL DEFAULT false,
  extra_attendance_count boolean NOT NULL DEFAULT false,
  circuit_overseer_name text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.secretary_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.secretary_service_groups (name, sort_order) VALUES
  ('Campo Limpo', 10),
  ('Elizabeth', 20),
  ('Helga', 30),
  ('Iracema', 40),
  ('Leônidas', 50),
  ('Pirajussara', 60)
ON CONFLICT (name) DO NOTHING;

-- Publicadores com conta no site
INSERT INTO public.secretary_publisher_profiles (profile_id)
SELECT p.id
FROM public.profiles p
WHERE p.role = 'publicador'
ON CONFLICT (profile_id) DO NOTHING;

ALTER TABLE public.secretary_service_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretary_publisher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretary_field_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretary_meeting_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretary_month_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretary_month_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretary_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY secretary_groups_manage ON public.secretary_service_groups
  FOR ALL TO authenticated
  USING (public.can_manage_secretary_service())
  WITH CHECK (public.can_manage_secretary_service());

CREATE POLICY secretary_publishers_manage ON public.secretary_publisher_profiles
  FOR ALL TO authenticated
  USING (public.can_manage_secretary_service())
  WITH CHECK (public.can_manage_secretary_service());

CREATE POLICY secretary_reports_manage ON public.secretary_field_reports
  FOR ALL TO authenticated
  USING (public.can_manage_secretary_service())
  WITH CHECK (public.can_manage_secretary_service());

CREATE POLICY secretary_attendance_manage ON public.secretary_meeting_attendance
  FOR ALL TO authenticated
  USING (public.can_manage_secretary_service())
  WITH CHECK (public.can_manage_secretary_service());

CREATE POLICY secretary_month_status_manage ON public.secretary_month_status
  FOR ALL TO authenticated
  USING (public.can_manage_secretary_service())
  WITH CHECK (public.can_manage_secretary_service());

CREATE POLICY secretary_adjustments_manage ON public.secretary_month_adjustments
  FOR ALL TO authenticated
  USING (public.can_manage_secretary_service())
  WITH CHECK (public.can_manage_secretary_service());

CREATE POLICY secretary_settings_manage ON public.secretary_settings
  FOR ALL TO authenticated
  USING (public.can_manage_secretary_service())
  WITH CHECK (public.can_manage_secretary_service());
