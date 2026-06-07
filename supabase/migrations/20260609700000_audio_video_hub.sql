-- Hub: módulo Áudio e Vídeo (mesa de som e mídia da congregação)

ALTER TABLE public.access_designations
  DROP CONSTRAINT IF EXISTS access_designations_permissions_check;

ALTER TABLE public.access_designations
  ADD CONSTRAINT access_designations_permissions_check CHECK (
    permissions <@ ARRAY[
      'hub', 'agenda', 'announcements', 'agendamentos', 'territorios',
      'donativos', 'settings', 'public_speeches', 'audio_video'
    ]::text[]
  );

CREATE OR REPLACE FUNCTION public.can_manage_audio_video()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_access_permission('audio_video');
$$;

REVOKE ALL ON FUNCTION public.can_manage_audio_video() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_audio_video() TO authenticated;

INSERT INTO public.access_designations (slug, label, description, permissions, sort_order)
VALUES (
  'audio_video',
  'Áudio e Vídeo',
  'Mesa de som, projeção e transmissão da congregação.',
  ARRAY['hub', 'audio_video']::text[],
  45
)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

UPDATE public.access_designations
SET permissions = array_append(permissions, 'audio_video'),
    updated_at = now()
WHERE slug = 'desenvolvedor'
  AND NOT ('audio_video' = ANY(permissions));
