-- Listas de rodízio das Designações Mecânicas (aba Rodízio do Quadro de Anúncios).
-- Indicadores: Indicador (Portão) e Indicador (Auditório); Som; Microfone volante: Mic. 1 e Mic. 2.

INSERT INTO public.announcement_rotations (slug, title, sort_order, items) VALUES
  ('indicadores', 'Indicadores', 6, '["Ademilson","Aerton","Alex","André","Fabio Souza","Fabio Buri","Ygor","Lucas Dias","Rubens","Rikael","Vinícius","Marcelo Isliker"]'::jsonb),
  ('som', 'Som', 7, '["Lucas Dias","Vinícius de Morais","Rikael Vieira","Ygor Inácio"]'::jsonb),
  ('microfone_volante', 'Microfone Volante', 8, '["Ademilson","Aerton","Alex","André","Fabio Souza","Fabio Buri","Ygor","Lucas Dias","Rubens","Rikael","Vinícius","Marcelo Isliker"]'::jsonb)
ON CONFLICT (slug) DO NOTHING;
