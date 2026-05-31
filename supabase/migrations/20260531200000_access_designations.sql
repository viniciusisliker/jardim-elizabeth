-- Designações de acesso: catálogo + atribuição por membro

CREATE TABLE IF NOT EXISTS public.access_designations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  permissions text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_designations_permissions_check CHECK (
    permissions <@ ARRAY['hub', 'agenda', 'announcements', 'agendamentos', 'territorios', 'donativos', 'settings']::text[]
  )
);

CREATE TABLE IF NOT EXISTS public.profile_access_designations (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  designation_id uuid NOT NULL REFERENCES public.access_designations(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, designation_id)
);

CREATE INDEX IF NOT EXISTS profile_access_designations_profile_idx
  ON public.profile_access_designations (profile_id);

ALTER TABLE public.access_designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_access_designations ENABLE ROW LEVEL SECURITY;

CREATE POLICY access_designations_read_authenticated
  ON public.access_designations FOR SELECT
  TO authenticated
  USING (is_active OR public.is_superuser());

CREATE POLICY access_designations_superuser_all
  ON public.access_designations FOR ALL
  TO authenticated
  USING (public.is_superuser())
  WITH CHECK (public.is_superuser());

CREATE POLICY profile_access_designations_read
  ON public.profile_access_designations FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.is_superuser()
    OR public.get_my_role() IN ('anciao', 'servo_ministerial')
  );

CREATE POLICY profile_access_designations_superuser_write
  ON public.profile_access_designations FOR ALL
  TO authenticated
  USING (public.is_superuser())
  WITH CHECK (public.is_superuser());

CREATE OR REPLACE FUNCTION public.get_profile_permissions(p_user_id uuid DEFAULT auth.uid())
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT perm), '{}'::text[])
  FROM (
    SELECT unnest(d.permissions) AS perm
    FROM public.profile_access_designations pad
    JOIN public.access_designations d ON d.id = pad.designation_id
    WHERE pad.profile_id = p_user_id
      AND d.is_active = true
  ) expanded;
$$;

REVOKE ALL ON FUNCTION public.get_profile_permissions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_permissions(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_access_permission(p_perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_superuser()
    OR public.can_manage_content()
    OR p_perm = ANY(public.get_profile_permissions(auth.uid()))
    OR (
      p_perm = 'announcements'
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND can_announcements = true
      )
    );
$$;

REVOKE ALL ON FUNCTION public.has_access_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_access_permission(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_announcements()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_access_permission('announcements');
$$;

INSERT INTO public.access_designations (slug, label, description, permissions, sort_order)
VALUES
  (
    'quadro_anuncios',
    'Quadro de Anúncios',
    'Editor, PDF e exportação Google Agenda.',
    ARRAY['hub', 'announcements']::text[],
    10
  ),
  (
    'agenda',
    'Agenda',
    'Criar e publicar eventos no site.',
    ARRAY['hub', 'agenda']::text[],
    20
  ),
  (
    'agendamentos',
    'Agendamentos',
    'Calendários de carrinhos e displays.',
    ARRAY['hub', 'agendamentos']::text[],
    30
  ),
  (
    'territorios',
    'Territórios',
    'Gestão de territórios e mapas.',
    ARRAY['hub', 'territorios']::text[],
    40
  ),
  (
    'donativos',
    'Donativos',
    'Página de contribuições e PIX.',
    ARRAY['hub', 'donativos']::text[],
    50
  ),
  (
    'desenvolvedor',
    'Desenvolvedor',
    'Acesso amplo aos módulos administrativos.',
    ARRAY['hub', 'agenda', 'announcements', 'agendamentos', 'territorios', 'donativos']::text[],
    5
  )
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Migrar flag legada can_announcements → designação
INSERT INTO public.profile_access_designations (profile_id, designation_id)
SELECT p.id, d.id
FROM public.profiles p
CROSS JOIN public.access_designations d
WHERE p.can_announcements = true
  AND d.slug = 'quadro_anuncios'
ON CONFLICT DO NOTHING;

-- André Neves — responsável pelo Quadro de Anúncios
INSERT INTO public.profile_access_designations (profile_id, designation_id)
SELECT p.id, d.id
FROM public.profiles p
CROSS JOIN public.access_designations d
WHERE p.username = 'andre.neves'
  AND d.slug = 'quadro_anuncios'
ON CONFLICT DO NOTHING;

-- Vinícius — designação Desenvolvedor
INSERT INTO public.profile_access_designations (profile_id, designation_id)
SELECT p.id, d.id
FROM public.profiles p
CROSS JOIN public.access_designations d
WHERE p.username = 'vinicius.isliker'
  AND d.slug = 'desenvolvedor'
ON CONFLICT DO NOTHING;
