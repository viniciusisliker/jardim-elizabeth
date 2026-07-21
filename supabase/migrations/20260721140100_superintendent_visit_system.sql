-- Visita do Superintendente: Secretário gerencia; Superintendente visualiza na one-page.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_display_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_role_check CHECK (
    display_role IS NULL
    OR display_role IN (
      'superuser',
      'anciao',
      'servo_ministerial',
      'superintendente',
      'secretario',
      'publicador'
    )
  );

ALTER TABLE public.access_designations
  DROP CONSTRAINT IF EXISTS access_designations_permissions_check;

ALTER TABLE public.access_designations
  ADD CONSTRAINT access_designations_permissions_check CHECK (
    permissions <@ ARRAY[
      'hub', 'agenda', 'announcements', 'agendamentos', 'territorios', 'donativos',
      'settings', 'public_speeches', 'audio_video', 'secretario'
    ]::text[]
  );

CREATE OR REPLACE FUNCTION public.is_secretario()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'secretario'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_superintendent_visits()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_superuser() OR public.is_secretario();
$$;

CREATE OR REPLACE FUNCTION public.can_read_superintendent_visits()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_superuser()
    OR public.is_secretario()
    OR public.is_superintendente();
$$;

REVOKE ALL ON FUNCTION public.is_secretario() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_secretario() TO authenticated;

REVOKE ALL ON FUNCTION public.can_manage_superintendent_visits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_superintendent_visits() TO authenticated;

REVOKE ALL ON FUNCTION public.can_read_superintendent_visits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_superintendent_visits() TO authenticated;

CREATE TABLE IF NOT EXISTS public.superintendent_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Visita do Superintendente',
  visit_date date,
  notes text NOT NULL DEFAULT '',
  is_visible boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.superintendent_visit_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.superintendent_visits(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text,
  size_bytes bigint,
  sort_order integer NOT NULL DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS superintendent_visits_visit_date_idx
  ON public.superintendent_visits (visit_date DESC NULLS LAST, updated_at DESC);

CREATE INDEX IF NOT EXISTS superintendent_visit_documents_visit_idx
  ON public.superintendent_visit_documents (visit_id, sort_order);

ALTER TABLE public.superintendent_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.superintendent_visit_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS superintendent_visits_read ON public.superintendent_visits;
CREATE POLICY superintendent_visits_read ON public.superintendent_visits
  FOR SELECT TO authenticated
  USING (public.can_read_superintendent_visits());

DROP POLICY IF EXISTS superintendent_visits_manage ON public.superintendent_visits;
CREATE POLICY superintendent_visits_manage ON public.superintendent_visits
  FOR ALL TO authenticated
  USING (public.can_manage_superintendent_visits())
  WITH CHECK (public.can_manage_superintendent_visits());

DROP POLICY IF EXISTS superintendent_visit_documents_read ON public.superintendent_visit_documents;
CREATE POLICY superintendent_visit_documents_read ON public.superintendent_visit_documents
  FOR SELECT TO authenticated
  USING (public.can_read_superintendent_visits());

DROP POLICY IF EXISTS superintendent_visit_documents_manage ON public.superintendent_visit_documents;
CREATE POLICY superintendent_visit_documents_manage ON public.superintendent_visit_documents
  FOR ALL TO authenticated
  USING (public.can_manage_superintendent_visits())
  WITH CHECK (public.can_manage_superintendent_visits());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.superintendent_visits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.superintendent_visit_documents TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('superintendent-visits', 'superintendent-visits', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS superintendent_visits_storage_read ON storage.objects;
CREATE POLICY superintendent_visits_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'superintendent-visits' AND public.can_read_superintendent_visits());

DROP POLICY IF EXISTS superintendent_visits_storage_write ON storage.objects;
CREATE POLICY superintendent_visits_storage_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'superintendent-visits' AND public.can_manage_superintendent_visits());

DROP POLICY IF EXISTS superintendent_visits_storage_update ON storage.objects;
CREATE POLICY superintendent_visits_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'superintendent-visits' AND public.can_manage_superintendent_visits())
  WITH CHECK (bucket_id = 'superintendent-visits' AND public.can_manage_superintendent_visits());

DROP POLICY IF EXISTS superintendent_visits_storage_delete ON storage.objects;
CREATE POLICY superintendent_visits_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'superintendent-visits' AND public.can_manage_superintendent_visits());

CREATE OR REPLACE FUNCTION public.je_can_access_hub(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND (
        p.role = 'superuser'
        OR p.role IN ('anciao', 'servo_ministerial', 'superintendente', 'secretario')
        OR p.can_announcements = true
        OR EXISTS (
          SELECT 1
          FROM public.profile_access_designations pad
          JOIN public.access_designations d ON d.id = pad.designation_id
          WHERE pad.profile_id = p.id
            AND d.is_active = true
        )
      )
  );
$$;
