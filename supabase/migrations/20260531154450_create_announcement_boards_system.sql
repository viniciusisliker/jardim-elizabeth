-- Quadro de Anúncios estruturado: boards, entries, storage bucket

CREATE TABLE IF NOT EXISTS public.announcement_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_month date NOT NULL,
  reference_label text NOT NULL,
  meeting_weekdays jsonb NOT NULL DEFAULT '[3, 6]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft', 'published', 'archived'])),
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  pdf_mecanicas_url text,
  pdf_midweek_url text,
  pdf_weekend_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcement_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.announcement_boards(id) ON DELETE CASCADE,
  block text NOT NULL CHECK (block = ANY (ARRAY['mecanicas', 'midweek', 'weekend', 'limpeza_mensal'])),
  event_date date,
  weekday_label text,
  sort_order integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  export_to_calendar boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcement_boards_reference_month_idx ON public.announcement_boards (reference_month);
CREATE INDEX IF NOT EXISTS announcement_entries_board_id_idx ON public.announcement_entries (board_id);

ALTER TABLE public.announcement_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcement_boards_public_read_published"
  ON public.announcement_boards FOR SELECT
  USING (status = 'published');

CREATE POLICY "announcement_boards_managers_all"
  ON public.announcement_boards FOR ALL
  USING (public.can_manage_content())
  WITH CHECK (public.can_manage_content());

CREATE POLICY "announcement_entries_public_read_via_board"
  ON public.announcement_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.announcement_boards b
      WHERE b.id = board_id AND b.status = 'published'
    )
  );

CREATE POLICY "announcement_entries_managers_all"
  ON public.announcement_entries FOR ALL
  USING (public.can_manage_content())
  WITH CHECK (public.can_manage_content());

INSERT INTO storage.buckets (id, name, public)
VALUES ('announcements', 'announcements', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "announcements_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'announcements');

CREATE POLICY "announcements_managers_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'announcements' AND public.can_manage_content());

CREATE POLICY "announcements_managers_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'announcements' AND public.can_manage_content());

CREATE POLICY "announcements_managers_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'announcements' AND public.can_manage_content());
