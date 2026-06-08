-- Permissões respeitam designações atribuídas; cargo anciao/servo só vale sem designação.

CREATE OR REPLACE FUNCTION public.has_access_permission(p_perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_superuser()
    OR (
      EXISTS (
        SELECT 1
        FROM public.profile_access_designations pad
        JOIN public.access_designations d ON d.id = pad.designation_id
        WHERE pad.profile_id = auth.uid()
          AND d.is_active = true
      )
      AND p_perm = ANY(public.get_profile_permissions(auth.uid()))
    )
    OR (
      NOT EXISTS (
        SELECT 1
        FROM public.profile_access_designations pad
        JOIN public.access_designations d ON d.id = pad.designation_id
        WHERE pad.profile_id = auth.uid()
          AND d.is_active = true
      )
      AND public.can_manage_content()
    )
    OR (
      p_perm = 'announcements'
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND can_announcements = true
      )
    );
$$;

-- André Neves: apenas Quadro de Anúncios
DELETE FROM public.profile_access_designations pad
USING public.profiles p, public.access_designations d
WHERE pad.profile_id = p.id
  AND pad.designation_id = d.id
  AND p.username = 'andre.neves'
  AND d.slug <> 'quadro_anuncios';

INSERT INTO public.profile_access_designations (profile_id, designation_id)
SELECT p.id, d.id
FROM public.profiles p
CROSS JOIN public.access_designations d
WHERE p.username = 'andre.neves'
  AND d.slug = 'quadro_anuncios'
ON CONFLICT DO NOTHING;
