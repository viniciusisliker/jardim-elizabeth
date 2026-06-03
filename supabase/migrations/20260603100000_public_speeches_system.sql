-- Discursos Públicos: arranjo mensal (recebemos / enviamos)

ALTER TABLE public.access_designations
  DROP CONSTRAINT IF EXISTS access_designations_permissions_check;

ALTER TABLE public.access_designations
  ADD CONSTRAINT access_designations_permissions_check CHECK (
    permissions <@ ARRAY[
      'hub', 'agenda', 'announcements', 'agendamentos', 'territorios',
      'donativos', 'settings', 'public_speeches'
    ]::text[]
  );

CREATE TABLE IF NOT EXISTS public.public_speech_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_month date NOT NULL,
  reference_label text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft', 'published', 'archived'])),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.public_speech_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.public_speech_boards(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction = ANY (ARRAY['receive', 'send'])),
  entry_type text NOT NULL DEFAULT 'speech' CHECK (
    entry_type = ANY (ARRAY['speech', 'convention', 'special_visit', 'note'])
  ),
  event_date date,
  event_date_end date,
  speaker_name text,
  outline_number text,
  theme text,
  characteristics text,
  observation text,
  note_text text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_speech_boards_reference_month_idx
  ON public.public_speech_boards (reference_month);

CREATE INDEX IF NOT EXISTS public_speech_entries_board_id_idx
  ON public.public_speech_entries (board_id);

CREATE INDEX IF NOT EXISTS public_speech_entries_board_direction_idx
  ON public.public_speech_entries (board_id, direction, sort_order);

ALTER TABLE public.public_speech_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_speech_entries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_public_speeches()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_access_permission('public_speeches');
$$;

REVOKE ALL ON FUNCTION public.can_manage_public_speeches() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_public_speeches() TO authenticated;

CREATE POLICY public_speech_boards_managers_all
  ON public.public_speech_boards FOR ALL
  TO authenticated
  USING (public.can_manage_public_speeches())
  WITH CHECK (public.can_manage_public_speeches());

CREATE POLICY public_speech_entries_managers_all
  ON public.public_speech_entries FOR ALL
  TO authenticated
  USING (public.can_manage_public_speeches())
  WITH CHECK (public.can_manage_public_speeches());

INSERT INTO public.access_designations (slug, label, description, permissions, sort_order)
VALUES (
  'discursos_publicos',
  'Discursos Públicos',
  'Arranjo mensal de oradores recebidos e enviados.',
  ARRAY['hub', 'public_speeches']::text[],
  25
)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

UPDATE public.access_designations
SET permissions = ARRAY[
  'hub', 'agenda', 'announcements', 'agendamentos', 'territorios',
  'donativos', 'public_speeches'
]::text[],
    updated_at = now()
WHERE slug = 'desenvolvedor';
