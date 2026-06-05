-- Servos de territorios podem listar profiles para designacao

DROP POLICY IF EXISTS profiles_territory_managers_select ON public.profiles;
CREATE POLICY profiles_territory_managers_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.can_manage_territories()
    OR public.get_my_role() IN ('anciao', 'servo_ministerial', 'superuser')
  );
