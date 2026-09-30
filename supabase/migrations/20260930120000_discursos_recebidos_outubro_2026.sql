-- Discursos públicos recebidos em outubro/2026 (quadro de fim de semana).
-- Idempotente: só insere se ainda não houver discurso "receive" ativo na data.

INSERT INTO public.speech_assignments (
  direction, event_date, speaker_name, theme_id, outline_number, theme_title,
  congregation_id, congregation_name, confirmation_status, notes
)
SELECT
  'receive',
  v.event_date,
  v.speaker_name,
  t.id,
  v.outline_number,
  coalesce(t.title, v.theme_title),
  c.id,
  v.congregation_name,
  'confirmado',
  v.phone
FROM (VALUES
  (DATE '2026-10-03', 'Antonio Silva',      32, 'Como lidar com as ansiedades da vida',          'Paraisópolis', '(11) 97730-4017'),
  (DATE '2026-10-10', 'Getúlio Pereira',    58, 'Quem são os verdadeiros seguidores de Cristo?', 'Paraisópolis', '(11) 98042-5973'),
  (DATE '2026-10-17', 'Sandro Marinelle',   10, 'Seja honesto em tudo',                          'Paraisópolis', '(11) 98102-9618'),
  (DATE '2026-10-24', 'Cristiano Ferreira',  2, 'Você vai sobreviver aos últimos dias?',         'Paraisópolis', '(11) 98453-5295'),
  (DATE '2026-10-31', 'Edilson Silva',      18, 'Faça de Jeová a sua fortaleza',                 'Sant Moritz',  '(11) 98653-9362')
) AS v(event_date, speaker_name, outline_number, theme_title, congregation_name, phone)
LEFT JOIN public.speech_themes t
  ON t.outline_number = v.outline_number
LEFT JOIN public.speech_congregations c
  ON lower(trim(c.name)) = lower(trim(v.congregation_name))
WHERE NOT EXISTS (
  SELECT 1
  FROM public.speech_assignments a
  WHERE a.direction = 'receive'
    AND a.event_date = v.event_date
    AND a.confirmation_status <> 'cancelado'
);
