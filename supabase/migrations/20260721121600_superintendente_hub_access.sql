-- Cargo Superintendente (parte 2): display_role e acesso ao Hub.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_display_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_role_check CHECK (
    display_role IS NULL
    OR display_role IN (
      'superuser',
      'anciao',
      'servo_ministerial',
      'superintendente',
      'publicador'
    )
  );

CREATE OR REPLACE FUNCTION public.je_can_access_hub(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND (
        p.role = 'superuser'
        OR p.role IN ('anciao', 'servo_ministerial', 'superintendente')
        OR p.can_announcements = true
        OR EXISTS (
          SELECT 1
          FROM public.profile_access_designations pad
          JOIN public.access_designations d ON d.id = pad.designation_id
          WHERE pad.profile_id = p.id
            AND d.is_active = true
        )
      )
  );
$$;
