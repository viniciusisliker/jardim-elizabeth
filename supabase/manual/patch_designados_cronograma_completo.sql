-- Designações ativas para territórios do cronograma sem registro (T11, T12, T13, T07).
-- Executar no SQL Editor do Supabase se o sync automático no Hub não resolver.
-- Usa o primeiro nome de pares "A e B" nos domingos fixos.

-- T11 · Jd Leônidas Moreira B → João Neves (Quinta)
UPDATE public.territories SET status = 'designado'
WHERE num IN ('11', '011') OR lower(trim(display_name)) = lower(trim('Jd Leônidas Moreira B'));

INSERT INTO public.territory_active_assignments (territory_id, profile_id, assigned_at, status)
SELECT t.id, p.id, CURRENT_DATE, 'active'
FROM public.territories t
JOIN public.profiles p ON (
  lower(trim(p.full_name)) = lower(trim('João Neves'))
  OR lower(trim(p.full_name)) LIKE lower(trim('João')) || '%'
)
WHERE (t.num IN ('11', '011') OR lower(trim(t.display_name)) = lower(trim('Jd Leônidas Moreira B')))
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.territory_id = t.id)
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.profile_id = p.id)
LIMIT 1;

-- T13 · CDHU A → Lucas Dias (Sábado)
UPDATE public.territories SET status = 'designado'
WHERE num IN ('13', '013') OR lower(trim(display_name)) = lower(trim('CDHU A'));

INSERT INTO public.territory_active_assignments (territory_id, profile_id, assigned_at, status)
SELECT t.id, p.id, CURRENT_DATE, 'active'
FROM public.territories t
JOIN public.profiles p ON (
  lower(trim(p.full_name)) = lower(trim('Lucas Dias'))
  OR lower(trim(p.full_name)) LIKE lower(trim('Lucas')) || '%'
)
WHERE (t.num IN ('13', '013') OR lower(trim(t.display_name)) = lower(trim('CDHU A')))
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.territory_id = t.id)
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.profile_id = p.id)
LIMIT 1;

-- T12 · Jd Leônidas Moreira C → Marcelo Freire (Domingo — primeiro do par)
UPDATE public.territories SET status = 'designado'
WHERE num IN ('12', '012') OR lower(trim(display_name)) = lower(trim('Jd Leônidas Moreira C'));

INSERT INTO public.territory_active_assignments (territory_id, profile_id, assigned_at, status)
SELECT t.id, p.id, CURRENT_DATE, 'active'
FROM public.territories t
JOIN public.profiles p ON (
  lower(trim(p.full_name)) = lower(trim('Marcelo Freire'))
  OR lower(trim(p.full_name)) LIKE lower(trim('Marcelo Freire')) || '%'
)
WHERE (t.num IN ('12', '012') OR lower(trim(t.display_name)) = lower(trim('Jd Leônidas Moreira C')))
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.territory_id = t.id)
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.profile_id = p.id)
LIMIT 1;

-- T07 · Jardim Iracema A → Denison (Domingo — primeiro do par)
UPDATE public.territories SET status = 'designado'
WHERE num IN ('07', '7', '007') OR lower(trim(display_name)) = lower(trim('Jardim Iracema A'));

INSERT INTO public.territory_active_assignments (territory_id, profile_id, assigned_at, status)
SELECT t.id, p.id, CURRENT_DATE, 'active'
FROM public.territories t
JOIN public.profiles p ON (
  lower(trim(p.full_name)) LIKE lower(trim('Denison')) || '%'
)
WHERE (t.num IN ('07', '7', '007') OR lower(trim(t.display_name)) = lower(trim('Jardim Iracema A')))
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.territory_id = t.id)
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.profile_id = p.id)
LIMIT 1;
