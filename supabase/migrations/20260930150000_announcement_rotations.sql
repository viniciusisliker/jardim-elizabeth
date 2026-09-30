-- Lista de Rodízio do Quadro de Anúncios: editada no Hub (aba Rodízio).
-- Cada linha é uma lista (Leitor, Presidente...) com os nomes em ordem.

CREATE TABLE IF NOT EXISTS public.announcement_rotations (
  slug text PRIMARY KEY,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcement_rotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcement_rotations_managers_all" ON public.announcement_rotations;

CREATE POLICY "announcement_rotations_managers_all"
  ON public.announcement_rotations
  FOR ALL
  USING (public.can_manage_announcements())
  WITH CHECK (public.can_manage_announcements());

-- Dados iniciais: as listas que estavam fixas em quadrodeanuncios.html.
INSERT INTO public.announcement_rotations (slug, title, sort_order, items) VALUES
  ('leitor', 'Leitor', 1, '["Rikael Morais","Vinicius de Morais","Lucas Dias","André Neves","Ygor Inácio","Arnaldo Isliker"]'::jsonb),
  ('presidente', 'Presidente', 2, '["Ademilson Dias","Rikael Morais","Lucas Dias","Marcelo Almeida","Arnaldo Isliker","Edvan Dantas","João Neves","Alex Tenório","Vinicius de Morais","André Neves"]'::jsonb),
  ('oracao', 'Oração', 3, '["Alex Tenório","André Neves","João Neves","Ademilson Dias","Edvan Dantas","Arnaldo Isliker","Lucas Dias","Marcelo Almeida","Rikael Morais","Vinicius de Morais"]'::jsonb),
  ('campo', 'Campo', 4, '["Ademilson Dias","Edvan Dantas","João Neves","Lucas Dias","Rikael Morais","Denison Oliveira","Vinicius de Morais","André Neves","Marcelo Almeida"]'::jsonb),
  ('grupos', 'Grupos', 5, '["Grupo Pirajussara","Grupo Leônidas","Grupo Elizabeth","Grupo Helga"]'::jsonb)
ON CONFLICT (slug) DO NOTHING;
