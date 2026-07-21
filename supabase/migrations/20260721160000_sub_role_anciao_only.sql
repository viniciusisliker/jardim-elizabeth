-- Sub-cargos predefinidos só para anciãos; servos ministeriais ficam sem catálogo por enquanto.

UPDATE public.profiles
SET sub_role = NULL
WHERE role <> 'anciao'
  AND sub_role IS NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_sub_role_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_sub_role_role_check CHECK (
    sub_role IS NULL
    OR role = 'anciao'
  );
