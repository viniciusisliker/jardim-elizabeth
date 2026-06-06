-- Cargo exibido na UI (permissoes continuam pelo campo role)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_role text;

COMMENT ON COLUMN public.profiles.display_role IS
  'Cargo congregacional exibido no Hub; permissoes continuam pelo campo role.';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_display_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_role_check CHECK (
    display_role IS NULL
    OR display_role IN ('superuser', 'anciao', 'servo_ministerial', 'publicador')
  );

-- Vinicius: superuser para Configuracoes; exibe Servo Ministerial (Desenvolvedor)
UPDATE public.profiles
SET role = 'superuser',
    display_role = 'servo_ministerial',
    designation = 'Desenvolvedor',
    updated_at = now()
WHERE username = 'vinicius.isliker';
