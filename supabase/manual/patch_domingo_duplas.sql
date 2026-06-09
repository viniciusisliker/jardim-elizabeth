-- Domingos: cronograma por dupla (sem profile_id individual)
-- Rode no SQL Editor do Supabase se linhas antigas ainda tiverem profile_id aos domingos.

UPDATE public.territory_week_schedule
SET profile_id = NULL
WHERE weekday_label ILIKE 'domingo%'
  AND profile_id IS NOT NULL;
