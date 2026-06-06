-- Cargo congregacional do desenvolvedor: Servo Ministerial (Desenvolvedor)
UPDATE public.profiles
SET role = 'servo_ministerial',
    updated_at = now()
WHERE username = 'vinicius.isliker';

-- Mantém acesso técnico via designação Desenvolvedor (sem cargo SuperUser)
UPDATE public.access_designations
SET permissions = ARRAY[
  'hub',
  'agenda',
  'announcements',
  'public_speeches',
  'agendamentos',
  'territorios',
  'donativos',
  'settings'
]::text[],
    updated_at = now()
WHERE slug = 'desenvolvedor';
