-- Permite registrar trabalho de campo importado da planilha
ALTER TABLE public.territory_history DROP CONSTRAINT IF EXISTS territory_history_event_type_check;
ALTER TABLE public.territory_history ADD CONSTRAINT territory_history_event_type_check
  CHECK (event_type IN ('designacao', 'devolucao', 'edicao', 'cronograma', 'status', 'trabalho'));

CREATE INDEX IF NOT EXISTS territory_history_event_date_idx
  ON public.territory_history (event_date DESC, created_at DESC);
