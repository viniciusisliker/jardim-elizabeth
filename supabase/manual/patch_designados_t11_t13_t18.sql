-- Corrige designações e cronograma (T11, T13, T18 + Lucas Dias no sábado).
-- Executar no SQL Editor do Supabase (produção).

-- Sábado: dirigente manual no cronograma (enquanto o Quadro não tiver dirigente_sabado)
UPDATE public.territory_week_schedule s
SET
  dirigente_name = 'Lucas Dias',
  profile_id = COALESCE(
    s.profile_id,
    (SELECT p.id FROM public.profiles p
     WHERE lower(trim(p.full_name)) = lower(trim('Lucas Dias'))
        OR lower(trim(p.full_name)) LIKE lower(trim('Lucas')) || '%'
     LIMIT 1)
  )
WHERE s.weekday_label = 'Sábado';

-- Domingo: pares fixos (ordem T12, T18, T7)
UPDATE public.territory_week_schedule SET dirigente_name = 'Marcelo Freire e Edvan', sort_order = 6
WHERE weekday_label = 'Domingo' AND territory_code = 'T12';
UPDATE public.territory_week_schedule SET dirigente_name = 'Marcelo Almeida e João', sort_order = 7
WHERE weekday_label = 'Domingo' AND territory_code = 'T18';
UPDATE public.territory_week_schedule SET dirigente_name = 'Denison e Arnaldo', sort_order = 8
WHERE weekday_label = 'Domingo' AND territory_code = 'T7';

-- T11 · Jd Leônidas Moreira B → João Neves
UPDATE public.territories SET status = 'designado'
WHERE num IN ('11', '011') OR lower(trim(display_name)) = lower(trim('Jd Leônidas Moreira B'));

INSERT INTO public.territory_active_assignments (territory_id, profile_id, assigned_at, status)
SELECT t.id, p.id, CURRENT_DATE, 'active'
FROM public.territories t
JOIN public.profiles p ON (
  lower(trim(p.full_name)) = lower(trim('João Neves'))
  OR lower(trim(p.full_name)) LIKE lower(trim('João')) || '%'
)
WHERE t.num IN ('11', '011') OR lower(trim(t.display_name)) = lower(trim('Jd Leônidas Moreira B'))
  AND NOT EXISTS (
    SELECT 1 FROM public.territory_active_assignments a
    WHERE a.status = 'active' AND a.territory_id = t.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.territory_active_assignments a
    WHERE a.status = 'active' AND a.profile_id = p.id
  )
LIMIT 1;

-- T13 · CDHU A → Lucas Dias
UPDATE public.territories SET status = 'designado'
WHERE num IN ('13', '013') OR lower(trim(display_name)) = lower(trim('CDHU A'));

INSERT INTO public.territory_active_assignments (territory_id, profile_id, assigned_at, status)
SELECT t.id, p.id, CURRENT_DATE, 'active'
FROM public.territories t
JOIN public.profiles p ON (
  lower(trim(p.full_name)) = lower(trim('Lucas Dias'))
  OR lower(trim(p.full_name)) LIKE lower(trim('Lucas')) || '%'
)
WHERE t.num IN ('13', '013') OR lower(trim(t.display_name)) = lower(trim('CDHU A'))
  AND NOT EXISTS (
    SELECT 1 FROM public.territory_active_assignments a
    WHERE a.status = 'active' AND a.territory_id = t.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.territory_active_assignments a
    WHERE a.status = 'active' AND a.profile_id = p.id
  )
LIMIT 1;

-- T18 · Jardim Helga C → Marcelo Almeida
UPDATE public.territories SET status = 'designado'
WHERE num IN ('18', '018') OR lower(trim(display_name)) = lower(trim('Jardim Helga C'));

INSERT INTO public.territory_active_assignments (territory_id, profile_id, assigned_at, status)
SELECT t.id, p.id, CURRENT_DATE, 'active'
FROM public.territories t
JOIN public.profiles p ON (
  lower(trim(p.full_name)) = lower(trim('Marcelo Almeida'))
  OR lower(trim(p.full_name)) LIKE lower(trim('Marcelo Almeida')) || '%'
)
WHERE t.num IN ('18', '018') OR lower(trim(t.display_name)) = lower(trim('Jardim Helga C'))
  AND NOT EXISTS (
    SELECT 1 FROM public.territory_active_assignments a
    WHERE a.status = 'active' AND a.territory_id = t.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.territory_active_assignments a
    WHERE a.status = 'active' AND a.profile_id = p.id
  )
LIMIT 1;
