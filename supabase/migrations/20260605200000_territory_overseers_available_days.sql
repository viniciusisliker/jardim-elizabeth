-- Dias específicos da semana em que cada dirigente pode trabalhar território
ALTER TABLE public.territory_overseers
  ADD COLUMN IF NOT EXISTS available_days text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.territory_overseers.available_days IS
  'Dias da semana (Terça…Domingo) em que o dirigente está disponível para território';

-- Preenche a partir da preferência legada quando ainda vazio
UPDATE public.territory_overseers
SET available_days = CASE preference
  WHEN 'final_de_semana' THEN ARRAY['Sábado', 'Domingo']::text[]
  WHEN 'ambos' THEN ARRAY['Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']::text[]
  ELSE ARRAY['Terça', 'Quarta', 'Quinta', 'Sexta']::text[]
END
WHERE available_days = '{}';
