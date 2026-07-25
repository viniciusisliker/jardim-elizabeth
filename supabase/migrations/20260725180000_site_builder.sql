-- Site Builder: páginas customizadas (somente Desenvolvedor / SuperUser)

ALTER TABLE public.access_designations
  DROP CONSTRAINT IF EXISTS access_designations_permissions_check;

ALTER TABLE public.access_designations
  ADD CONSTRAINT access_designations_permissions_check CHECK (
    permissions <@ ARRAY[
      'hub', 'agenda', 'announcements', 'agendamentos', 'territorios', 'donativos',
      'settings', 'public_speeches', 'audio_video', 'secretario', 'site_builder'
    ]::text[]
  );

CREATE OR REPLACE FUNCTION public.can_manage_site_builder()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_superuser()
    OR public.is_developer()
    OR public.has_access_permission('site_builder');
$$;

REVOKE ALL ON FUNCTION public.can_manage_site_builder() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_site_builder() TO authenticated;

UPDATE public.access_designations
SET permissions = array_append(permissions, 'site_builder'),
    updated_at = now()
WHERE slug = 'desenvolvedor'
  AND NOT ('site_builder' = ANY(permissions));

CREATE TABLE IF NOT EXISTS public.site_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL DEFAULT 'Página sem título',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  layout jsonb NOT NULL DEFAULT '{"blocks":[]}'::jsonb,
  theme jsonb NOT NULL DEFAULT '{
    "bgColor": "#141414",
    "textColor": "#f5f5f5",
    "accentColor": "#c9a227",
    "headingFont": "Georgia, \"Times New Roman\", serif",
    "bodyFont": "Inter, system-ui, sans-serif"
  }'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_pages_slug_unique UNIQUE (slug),
  CONSTRAINT site_pages_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE INDEX IF NOT EXISTS site_pages_status_idx ON public.site_pages (status);
CREATE INDEX IF NOT EXISTS site_pages_sort_idx ON public.site_pages (sort_order, title);

ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_pages_public_read ON public.site_pages
  FOR SELECT
  USING (status = 'published');

CREATE POLICY site_pages_manage_select ON public.site_pages
  FOR SELECT
  TO authenticated
  USING (public.can_manage_site_builder());

CREATE POLICY site_pages_manage_write ON public.site_pages
  FOR ALL
  TO authenticated
  USING (public.can_manage_site_builder())
  WITH CHECK (public.can_manage_site_builder());

COMMENT ON TABLE public.site_pages IS 'Páginas customizadas criadas no Site Builder (Hub — Desenvolvedor).';
