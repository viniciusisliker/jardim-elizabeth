-- Designações mecânicas — Julho/2026 (quadro 36b58233-050e-4ac5-af0c-337f3bab52c8)

UPDATE public.announcement_entries SET
  data = '{"portao":"Fábio Buri","indicador":"Igor","som":"Rikael","microf_volantes_1":"Rubens","microf_volantes_2":"Alex","limpeza_grupo":"Grupo Elizabeth"}'::jsonb,
  updated_at = now()
WHERE board_id = '36b58233-050e-4ac5-af0c-337f3bab52c8' AND block = 'mecanicas' AND event_date = '2026-07-08';

UPDATE public.announcement_entries SET
  data = '{"portao":"Fábio Sousa","indicador":"Ademilson","som":"Lucas","microf_volantes_1":"Fábio Buri","microf_volantes_2":"Matheus","limpeza_grupo":"Grupo Elizabeth"}'::jsonb,
  updated_at = now()
WHERE board_id = '36b58233-050e-4ac5-af0c-337f3bab52c8' AND block = 'mecanicas' AND event_date = '2026-07-11';

UPDATE public.announcement_entries SET
  data = '{"portao":"Rikael","indicador":"Rubens","som":"Vinícius","microf_volantes_1":"Leonan","microf_volantes_2":"Cosme","limpeza_grupo":"Grupo Helga"}'::jsonb,
  updated_at = now()
WHERE board_id = '36b58233-050e-4ac5-af0c-337f3bab52c8' AND block = 'mecanicas' AND event_date = '2026-07-22';

UPDATE public.announcement_entries SET
  data = '{"portao":"Aerton","indicador":"Lucas","som":"André","microf_volantes_1":"Fábio Buri","microf_volantes_2":"Alex","limpeza_grupo":"Grupo Helga"}'::jsonb,
  updated_at = now()
WHERE board_id = '36b58233-050e-4ac5-af0c-337f3bab52c8' AND block = 'mecanicas' AND event_date = '2026-07-25';

UPDATE public.announcement_entries SET
  data = '{"portao":"Cosme","indicador":"André","som":"Igor","microf_volantes_1":"Leonan","microf_volantes_2":"Fábio Sousa","limpeza_grupo":"Grupo Campo Limpo"}'::jsonb,
  updated_at = now()
WHERE board_id = '36b58233-050e-4ac5-af0c-337f3bab52c8' AND block = 'mecanicas' AND event_date = '2026-07-29';

UPDATE public.announcement_boards SET updated_at = now()
WHERE id = '36b58233-050e-4ac5-af0c-337f3bab52c8';
