-- Duplas de domingo: Casa da Natividade (João Neves e Marcelo Almeida)
-- e Casa da Lúcia (Edvan e Denison). Remove a terceira dupla (Helena).

CREATE OR REPLACE FUNCTION public.is_domingo_pair_territory_num(p_num text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ltrim(coalesce(p_num, ''), '0') IN ('12', '18');
$$;

DELETE FROM public.territory_week_schedule
WHERE weekday_label = 'Domingo';

INSERT INTO public.territory_week_schedule (
  weekday_label, sort_order, profile_id, dirigente_name,
  territory_id, territory_code, location_name, schedule_times
)
SELECT
  'Domingo',
  6,
  NULL,
  'João Neves e Marcelo Almeida',
  t.id,
  'T16',
  'Casa da Natividade Aguiar',
  '09:15'
FROM public.territories t
WHERE t.num = '16'
LIMIT 1;

INSERT INTO public.territory_week_schedule (
  weekday_label, sort_order, profile_id, dirigente_name,
  territory_id, territory_code, location_name, schedule_times
)
SELECT
  'Domingo',
  7,
  NULL,
  'Edvan e Denison',
  t.id,
  'T19',
  'Casa da Lúcia Duarte',
  '09:15'
FROM public.territories t
WHERE t.num = '19'
LIMIT 1;

DELETE FROM public.territory_meeting_spots
WHERE weekday_label = 'Domingo'
  AND location_name ILIKE '%Helena%';

UPDATE public.territory_meeting_spots
SET sort_order = 4,
    schedule_times = COALESCE(schedule_times, '09:15'),
    updated_at = now()
WHERE weekday_label = 'Domingo'
  AND location_name ILIKE '%Natividade%';

UPDATE public.territory_meeting_spots
SET sort_order = 5,
    schedule_times = COALESCE(schedule_times, '09:15'),
    updated_at = now()
WHERE weekday_label = 'Domingo'
  AND location_name ILIKE '%Lúcia%';
