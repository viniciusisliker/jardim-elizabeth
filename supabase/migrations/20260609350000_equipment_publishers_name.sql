-- Publicadores da planilha podem existir sem conta no site

ALTER TABLE public.equipment_publishers
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS publisher_name text;

UPDATE public.equipment_publishers ep
SET publisher_name = p.full_name
FROM public.profiles p
WHERE ep.publisher_name IS NULL
  AND ep.profile_id = p.id;

UPDATE public.equipment_publishers
SET publisher_name = 'Publicador'
WHERE publisher_name IS NULL;

ALTER TABLE public.equipment_publishers
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN publisher_name SET NOT NULL;

ALTER TABLE public.equipment_publishers
  DROP CONSTRAINT IF EXISTS equipment_publishers_pkey;

ALTER TABLE public.equipment_publishers
  ADD PRIMARY KEY (id);

ALTER TABLE public.equipment_publishers
  ALTER COLUMN profile_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS equipment_publishers_profile_uidx
  ON public.equipment_publishers (profile_id)
  WHERE profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS equipment_publishers_name_norm_uidx
  ON public.equipment_publishers (lower(trim(publisher_name)));

CREATE INDEX IF NOT EXISTS equipment_publishers_name_sort_idx
  ON public.equipment_publishers (publisher_name);
