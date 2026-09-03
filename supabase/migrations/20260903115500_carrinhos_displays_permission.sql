-- Permissao dedicada para Carrinhos e Displays, separada de Agendamentos.

ALTER TABLE public.access_designations
  DROP CONSTRAINT IF EXISTS access_designations_permissions_check;

ALTER TABLE public.access_designations
  ADD CONSTRAINT access_designations_permissions_check CHECK (
    permissions <@ ARRAY[
      'hub', 'agenda', 'announcements', 'agendamentos', 'carrinhos_displays',
      'territorios', 'donativos', 'settings', 'public_speeches', 'audio_video',
      'secretario', 'site_builder'
    ]::text[]
  );

CREATE OR REPLACE FUNCTION public.can_manage_carrinhos_displays()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_access_permission('carrinhos_displays');
$$;

REVOKE ALL ON FUNCTION public.can_manage_carrinhos_displays() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_carrinhos_displays() TO authenticated;

DROP POLICY IF EXISTS equipment_publishers_manage ON public.equipment_publishers;
CREATE POLICY equipment_publishers_manage ON public.equipment_publishers
  FOR ALL TO authenticated
  USING (public.can_manage_carrinhos_displays())
  WITH CHECK (public.can_manage_carrinhos_displays());

DROP POLICY IF EXISTS equipment_schedule_slots_manage ON public.equipment_schedule_slots;
CREATE POLICY equipment_schedule_slots_manage ON public.equipment_schedule_slots
  FOR ALL TO authenticated
  USING (public.can_manage_carrinhos_displays())
  WITH CHECK (public.can_manage_carrinhos_displays());

DROP POLICY IF EXISTS equipment_items_manage ON public.equipment_items;
CREATE POLICY equipment_items_manage ON public.equipment_items
  FOR ALL TO authenticated
  USING (public.can_manage_carrinhos_displays())
  WITH CHECK (public.can_manage_carrinhos_displays());

DROP POLICY IF EXISTS equipment_locations_manage ON public.equipment_locations;
CREATE POLICY equipment_locations_manage ON public.equipment_locations
  FOR ALL TO authenticated
  USING (public.can_manage_carrinhos_displays())
  WITH CHECK (public.can_manage_carrinhos_displays());

INSERT INTO public.access_designations (slug, label, description, permissions, sort_order)
VALUES (
  'carrinhos_displays',
  'Carrinhos e Displays',
  'Publicadores, equipamentos, locais e cronograma semanal de carrinhos e displays.',
  ARRAY['hub', 'carrinhos_displays']::text[],
  35
)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

UPDATE public.access_designations
SET permissions = array_append(permissions, 'carrinhos_displays'),
    updated_at = now()
WHERE slug = 'desenvolvedor'
  AND NOT ('carrinhos_displays' = ANY(permissions));

INSERT INTO public.profile_access_designations (profile_id, designation_id)
SELECT p.id, d.id
FROM public.profiles p
CROSS JOIN public.access_designations d
WHERE p.username = 'andre.neves'
  AND d.slug = 'carrinhos_displays'
ON CONFLICT DO NOTHING;
