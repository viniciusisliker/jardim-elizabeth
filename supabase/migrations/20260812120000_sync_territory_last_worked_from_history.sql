-- Sincroniza cobertura do painel com o histórico de trabalho (cronograma S-13 + devoluções).

CREATE OR REPLACE FUNCTION public.sync_territory_last_worked_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.territory_id IS NOT NULL
     AND NEW.event_date IS NOT NULL
     AND NEW.event_type IN ('trabalho', 'devolucao') THEN
    UPDATE public.territories
    SET last_worked_at = GREATEST(COALESCE(last_worked_at, NEW.event_date), NEW.event_date)
    WHERE id = NEW.territory_id
      AND (last_worked_at IS NULL OR last_worked_at < NEW.event_date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_territory_last_worked_at ON public.territory_history;
CREATE TRIGGER trg_sync_territory_last_worked_at
AFTER INSERT OR UPDATE OF event_date, event_type, territory_id
ON public.territory_history
FOR EACH ROW
EXECUTE FUNCTION public.sync_territory_last_worked_at();

INSERT INTO public.territory_history (
  event_type, event_date, territory_id, profile_id, details, metadata
)
SELECT
  'trabalho',
  src.event_date,
  t.id,
  (
    SELECT p.id
    FROM public.profiles p
    WHERE lower(trim(p.full_name)) = lower(trim(src.dirigente_name))
       OR lower(trim(p.full_name)) = lower(trim(split_part(src.dirigente_name, ' e ', 1)))
    ORDER BY CASE
      WHEN lower(trim(p.full_name)) = lower(trim(src.dirigente_name)) THEN 0
      ELSE 1
    END
    LIMIT 1
  ),
  src.details,
  jsonb_build_object(
    'source', 'cronograma_s13',
    'dirigente_name', src.dirigente_name,
    'territory_num', src.num
  )
FROM (
  VALUES
    ('05', DATE '2026-03-24', 'Cronograma semanal · Alexsezar Tenório · T05', 'Alexsezar Tenório'),
    ('18', DATE '2026-03-25', 'Cronograma semanal · Fábio Silva · T18', 'Fábio Silva'),
    ('02', DATE '2026-03-26', 'Cronograma semanal · João Neves · T02', 'João Neves'),
    ('09', DATE '2026-03-27', 'Cronograma semanal · Cosme Silva · T09', 'Cosme Silva'),
    ('13', DATE '2026-03-28', 'Cronograma semanal · Denison Oliveira · T13', 'Denison Oliveira'),
    ('14', DATE '2026-03-28', 'Cronograma semanal · Denison Oliveira · T14', 'Denison Oliveira'),
    ('15', DATE '2026-03-28', 'Cronograma semanal · Denison Oliveira · T15', 'Denison Oliveira'),
    ('03', DATE '2026-03-29', 'Cronograma semanal · Marcelo Almeida e João · T03', 'Marcelo Almeida e João'),
    ('10', DATE '2026-03-29', 'Cronograma semanal · Marcelo Freire e Edvan · T10', 'Marcelo Freire e Edvan'),
    ('11', DATE '2026-03-29', 'Cronograma semanal · Denison e Arnaldo · T11', 'Denison e Arnaldo'),
    ('06', DATE '2026-03-31', 'Cronograma semanal · Alexsezar Tenório · T06', 'Alexsezar Tenório'),
    ('18', DATE '2026-04-01', 'Cronograma semanal · Fábio Silva · T18', 'Fábio Silva'),
    ('02', DATE '2026-04-02', 'Cronograma semanal · João Neves · T02', 'João Neves'),
    ('01', DATE '2026-04-03', 'Cronograma semanal · Cosme Silva · T01', 'Cosme Silva'),
    ('04', DATE '2026-04-04', 'Cronograma semanal · Vinícius de Morais · T04', 'Vinícius de Morais'),
    ('03', DATE '2026-04-05', 'Cronograma semanal · Marcelo Almeida e João · T03', 'Marcelo Almeida e João'),
    ('08', DATE '2026-04-05', 'Cronograma semanal · Marcelo Freire e Edvan · T08', 'Marcelo Freire e Edvan'),
    ('11', DATE '2026-04-05', 'Cronograma semanal · Denison e Arnaldo · T11', 'Denison e Arnaldo'),
    ('06', DATE '2026-04-07', 'Cronograma semanal · Alexsezar Tenório · T06', 'Alexsezar Tenório'),
    ('03', DATE '2026-04-08', 'Cronograma semanal · Fábio Silva · T03', 'Fábio Silva'),
    ('02', DATE '2026-04-09', 'Cronograma semanal · João Neves · T02', 'João Neves'),
    ('05', DATE '2026-04-10', 'Cronograma semanal · Cosme Silva · T05', 'Cosme Silva'),
    ('07', DATE '2026-04-11', 'Cronograma semanal · André Neves · T07', 'André Neves'),
    ('08', DATE '2026-04-11', 'Cronograma semanal · André Neves · T08', 'André Neves'),
    ('03', DATE '2026-04-12', 'Cronograma semanal · Marcelo Almeida e João · T03', 'Marcelo Almeida e João'),
    ('11', DATE '2026-04-12', 'Cronograma semanal · Denison e Arnaldo · T11', 'Denison e Arnaldo'),
    ('17', DATE '2026-04-12', 'Cronograma semanal · Marcelo Freire e Edvan · T17', 'Marcelo Freire e Edvan'),
    ('06', DATE '2026-04-14', 'Cronograma semanal · Alexsezar Tenório · T06', 'Alexsezar Tenório'),
    ('09', DATE '2026-04-15', 'Cronograma semanal · Fábio Silva · T09', 'Fábio Silva'),
    ('04', DATE '2026-04-16', 'Cronograma semanal · João Neves · T04', 'João Neves'),
    ('05', DATE '2026-04-17', 'Cronograma semanal · Cosme Silva · T05', 'Cosme Silva'),
    ('10', DATE '2026-04-18', 'Cronograma semanal · Ademilson Dias · T10', 'Ademilson Dias'),
    ('11', DATE '2026-04-18', 'Cronograma semanal · Ademilson Dias · T11', 'Ademilson Dias'),
    ('03', DATE '2026-04-21', 'Cronograma semanal · Alexsezar Tenório · T03', 'Alexsezar Tenório'),
    ('01', DATE '2026-04-22', 'Cronograma semanal · Fábio Silva · T01', 'Fábio Silva'),
    ('04', DATE '2026-04-23', 'Cronograma semanal · João Neves · T04', 'João Neves'),
    ('05', DATE '2026-04-24', 'Cronograma semanal · Cosme Silva · T05', 'Cosme Silva'),
    ('18', DATE '2026-04-25', 'Cronograma semanal · Cosme Silva · T18', 'Cosme Silva'),
    ('07', DATE '2026-04-26', 'Cronograma semanal · Denison e Arnaldo · T07', 'Denison e Arnaldo'),
    ('09', DATE '2026-04-26', 'Cronograma semanal · Marcelo Almeida e João · T09', 'Marcelo Almeida e João'),
    ('17', DATE '2026-04-26', 'Cronograma semanal · Marcelo Freire e Edvan · T17', 'Marcelo Freire e Edvan'),
    ('03', DATE '2026-04-28', 'Cronograma semanal · Alexsezar Tenório · T03', 'Alexsezar Tenório'),
    ('02', DATE '2026-04-29', 'Cronograma semanal · Fábio Silva · T02', 'Fábio Silva'),
    ('11', DATE '2026-04-30', 'Cronograma semanal · João Neves · T11', 'João Neves'),
    ('05', DATE '2026-05-01', 'Cronograma semanal · Cosme Silva · T05', 'Cosme Silva'),
    ('07', DATE '2026-05-03', 'Cronograma semanal · Denison e Arnaldo · T07', 'Denison e Arnaldo'),
    ('08', DATE '2026-05-03', 'Cronograma semanal · Marcelo Almeida e João · T08', 'Marcelo Almeida e João'),
    ('12', DATE '2026-05-03', 'Cronograma semanal · Marcelo Freire e Edvan · T12', 'Marcelo Freire e Edvan'),
    ('16', DATE '2026-05-03', 'Cronograma semanal · Marcelo Almeida e João · T16', 'Marcelo Almeida e João'),
    ('03', DATE '2026-05-05', 'Cronograma semanal · Alexsezar Tenório · T03', 'Alexsezar Tenório'),
    ('02', DATE '2026-05-06', 'Cronograma semanal · Fábio Silva · T02', 'Fábio Silva'),
    ('11', DATE '2026-05-07', 'Cronograma semanal · João Neves · T11', 'João Neves'),
    ('05', DATE '2026-05-08', 'Cronograma semanal · Cosme Silva · T05', 'Cosme Silva'),
    ('19', DATE '2026-05-09', 'Cronograma semanal · João Neves · T19', 'João Neves'),
    ('07', DATE '2026-05-10', 'Cronograma semanal · Denison e Arnaldo · T07', 'Denison e Arnaldo'),
    ('08', DATE '2026-05-10', 'Cronograma semanal · Marcelo Almeida e João · T08', 'Marcelo Almeida e João'),
    ('12', DATE '2026-05-10', 'Cronograma semanal · Marcelo Freire e Edvan · T12', 'Marcelo Freire e Edvan'),
    ('04', DATE '2026-05-12', 'Cronograma semanal · Alexsezar Tenório · T04', 'Alexsezar Tenório'),
    ('09', DATE '2026-05-13', 'Cronograma semanal · Fábio Silva · T09', 'Fábio Silva'),
    ('11', DATE '2026-05-14', 'Cronograma semanal · João Neves · T11', 'João Neves'),
    ('05', DATE '2026-05-15', 'Cronograma semanal · Cosme Silva · T05', 'Cosme Silva'),
    ('19', DATE '2026-05-16', 'Cronograma semanal · Marcelo Freire · T19', 'Marcelo Freire'),
    ('07', DATE '2026-05-17', 'Cronograma semanal · Denison e Arnaldo · T07', 'Denison e Arnaldo'),
    ('08', DATE '2026-05-17', 'Cronograma semanal · Marcelo Almeida e João · T08', 'Marcelo Almeida e João'),
    ('12', DATE '2026-05-17', 'Cronograma semanal · Marcelo Freire e Edvan · T12', 'Marcelo Freire e Edvan'),
    ('04', DATE '2026-05-26', 'Cronograma semanal · Alexsezar Tenório · T04', 'Alexsezar Tenório'),
    ('01', DATE '2026-05-27', 'Cronograma semanal · Fábio Silva · T01', 'Fábio Silva'),
    ('11', DATE '2026-05-28', 'Cronograma semanal · João Neves · T11', 'João Neves'),
    ('05', DATE '2026-05-29', 'Cronograma semanal · Cosme Silva · T05', 'Cosme Silva'),
    ('13', DATE '2026-05-30', 'Cronograma semanal · Lucas Dias · T13', 'Lucas Dias'),
    ('07', DATE '2026-05-31', 'Cronograma semanal · Denison e Arnaldo · T07', 'Denison e Arnaldo'),
    ('12', DATE '2026-05-31', 'Cronograma semanal · Marcelo Freire e Edvan · T12', 'Marcelo Freire e Edvan'),
    ('18', DATE '2026-05-31', 'Cronograma semanal · Marcelo Almeida e João · T18', 'Marcelo Almeida e João'),
    ('02', DATE '2026-06-02', 'Cronograma semanal · Alexsezar Tenório · T02', 'Alexsezar Tenório'),
    ('03', DATE '2026-06-03', 'Cronograma semanal · Fábio Silva · T03', 'Fábio Silva'),
    ('06', DATE '2026-06-04', 'Cronograma semanal · João Neves · T06', 'João Neves'),
    ('10', DATE '2026-06-06', 'Cronograma semanal · Denison Oliveira · T10', 'Denison Oliveira'),
    ('12', DATE '2026-06-07', 'Cronograma semanal · Marcelo Freire e Edvan · T12', 'Marcelo Freire e Edvan'),
    ('18', DATE '2026-06-07', 'Cronograma semanal · Marcelo Almeida e João · T18', 'Marcelo Almeida e João'),
    ('19', DATE '2026-06-07', 'Cronograma semanal · Denison e Arnaldo · T19', 'Denison e Arnaldo'),
    ('02', DATE '2026-06-09', 'Cronograma semanal · Alexsezar Tenório · T02', 'Alexsezar Tenório'),
    ('03', DATE '2026-06-10', 'Cronograma semanal · Fábio Souza · T03', 'Fábio Souza'),
    ('06', DATE '2026-06-11', 'Cronograma semanal · João Neves · T06', 'João Neves'),
    ('09', DATE '2026-06-12', 'Cronograma semanal · Cosme Silva · T09', 'Cosme Silva'),
    ('16', DATE '2026-06-13', 'Cronograma semanal · Vinícius de Morais · T16', 'Vinícius de Morais'),
    ('12', DATE '2026-06-14', 'Cronograma semanal · Marcelo Freire e Edvan · T12', 'Marcelo Freire e Edvan'),
    ('17', DATE '2026-06-14', 'Cronograma semanal · Marcelo Almeida e João · T17', 'Marcelo Almeida e João'),
    ('19', DATE '2026-06-14', 'Cronograma semanal · Denison e Arnaldo · T19', 'Denison e Arnaldo'),
    ('02', DATE '2026-06-16', 'Cronograma semanal · Alexsezar Tenório · T02', 'Alexsezar Tenório'),
    ('03', DATE '2026-06-17', 'Cronograma semanal · Fábio Souza · T03', 'Fábio Souza'),
    ('06', DATE '2026-06-18', 'Cronograma semanal · João Neves · T06', 'João Neves'),
    ('01', DATE '2026-06-19', 'Cronograma semanal · Cosme Silva · T01', 'Cosme Silva'),
    ('14', DATE '2026-06-20', 'Cronograma semanal · Marcelo Freire · T14', 'Marcelo Freire'),
    ('04', DATE '2026-06-21', 'Cronograma semanal · Marcelo Freire e Edvan · T04', 'Marcelo Freire e Edvan'),
    ('17', DATE '2026-06-21', 'Cronograma semanal · Marcelo Almeida e João · T17', 'Marcelo Almeida e João'),
    ('18', DATE '2026-06-21', 'Cronograma semanal · Denison e Arnaldo · T18', 'Denison e Arnaldo'),
    ('05', DATE '2026-06-23', 'Cronograma semanal · Alexsezar Tenório · T05', 'Alexsezar Tenório'),
    ('09', DATE '2026-06-24', 'Cronograma semanal · Fábio Souza · T09', 'Fábio Souza'),
    ('10', DATE '2026-06-25', 'Cronograma semanal · João Neves · T10', 'João Neves'),
    ('01', DATE '2026-06-26', 'Cronograma semanal · Cosme Silva · T01', 'Cosme Silva'),
    ('15', DATE '2026-06-27', 'Cronograma semanal · André Neves · T15', 'André Neves'),
    ('04', DATE '2026-06-28', 'Cronograma semanal · Marcelo Freire e Edvan · T04', 'Marcelo Freire e Edvan'),
    ('17', DATE '2026-06-28', 'Cronograma semanal · Marcelo Almeida e João · T17', 'Marcelo Almeida e João'),
    ('18', DATE '2026-06-28', 'Cronograma semanal · Denison e Arnaldo · T18', 'Denison e Arnaldo'),
    ('05', DATE '2026-06-30', 'Cronograma semanal · Alexsezar Tenório · T05', 'Alexsezar Tenório'),
    ('02', DATE '2026-07-01', 'Cronograma semanal · Fábio Souza · T02', 'Fábio Souza'),
    ('01', DATE '2026-07-02', 'Cronograma semanal · João Neves · T01', 'João Neves'),
    ('04', DATE '2026-07-03', 'Cronograma semanal · Cosme Silva · T04', 'Cosme Silva'),
    ('03', DATE '2026-07-05', 'Cronograma semanal · Marcelo Almeida e João · T03', 'Marcelo Almeida e João'),
    ('06', DATE '2026-07-05', 'Cronograma semanal · Denison e Arnaldo · T06', 'Denison e Arnaldo'),
    ('10', DATE '2026-07-05', 'Cronograma semanal · Marcelo Freire e Edvan · T10', 'Marcelo Freire e Edvan'),
    ('11', DATE '2026-07-14', 'Cronograma semanal · Alexsezar Tenório · T11', 'Alexsezar Tenório'),
    ('12', DATE '2026-07-15', 'Cronograma semanal · Fábio Souza · T12', 'Fábio Souza'),
    ('10', DATE '2026-07-16', 'Cronograma semanal · João Neves · T10', 'João Neves'),
    ('09', DATE '2026-07-28', 'Cronograma semanal · Alexsezar Tenório · T09', 'Alexsezar Tenório'),
    ('04', DATE '2026-07-29', 'Cronograma semanal · Fábio Souza · T04', 'Fábio Souza'),
    ('11', DATE '2026-07-30', 'Cronograma semanal · João Neves · T11', 'João Neves'),
    ('11', DATE '2026-07-31', 'Cronograma semanal · João Neves · T11', 'João Neves'),
    ('12', DATE '2026-08-01', 'Cronograma semanal · Rikael · T12', 'Rikael')
) AS src(num, event_date, details, dirigente_name)
JOIN public.territories t
  ON t.num = src.num
WHERE NOT EXISTS (
  SELECT 1
  FROM public.territory_history h
  WHERE h.territory_id = t.id
    AND h.event_date = src.event_date
    AND h.event_type IN ('trabalho', 'devolucao')
);

UPDATE public.territories t
SET last_worked_at = s.max_work
FROM (
  SELECT territory_id, MAX(event_date) AS max_work
  FROM public.territory_history
  WHERE event_type IN ('trabalho', 'devolucao')
    AND territory_id IS NOT NULL
  GROUP BY territory_id
) s
WHERE t.id = s.territory_id
  AND (t.last_worked_at IS NULL OR t.last_worked_at < s.max_work);
