-- T11 (João Neves) e T3 (Alexsezar Tenório) — designação ativa para devolver no cronograma.
-- Executar no SQL Editor do Supabase se o Hub ainda não regularizar sozinho.

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
WHERE (t.num IN ('11', '011') OR lower(trim(t.display_name)) = lower(trim('Jd Leônidas Moreira B')))
  AND NOT EXISTS (
    SELECT 1 FROM public.territory_active_assignments a
    WHERE a.status = 'active' AND a.territory_id = t.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.territory_active_assignments a
    WHERE a.status = 'active' AND a.profile_id = p.id
  )
LIMIT 1;

-- T3 · Jardim Elizabeth B → Alexsezar Tenório
UPDATE public.territories SET status = 'designado'
WHERE num IN ('3', '03') OR lower(trim(display_name)) = lower(trim('Jardim Elizabeth B'));

INSERT INTO public.territory_active_assignments (territory_id, profile_id, assigned_at, status)
SELECT t.id, p.id, CURRENT_DATE, 'active'
FROM public.territories t
JOIN public.profiles p ON (
  lower(trim(p.full_name)) = lower(trim('Alexsezar Tenório'))
  OR lower(trim(p.full_name)) LIKE lower(trim('Alexsezar')) || '%'
)
WHERE (t.num IN ('3', '03') OR lower(trim(t.display_name)) = lower(trim('Jardim Elizabeth B')))
  AND NOT EXISTS (
    SELECT 1 FROM public.territory_active_assignments a
    WHERE a.status = 'active' AND a.territory_id = t.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.territory_active_assignments a
    WHERE a.status = 'active' AND a.profile_id = p.id
  )
LIMIT 1;
