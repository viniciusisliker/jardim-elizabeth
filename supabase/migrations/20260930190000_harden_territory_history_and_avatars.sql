-- Endurecimento de segurança (auditoria de 2026-09-30).
--
-- 1) log_territory_history era SECURITY DEFINER sem checagem de permissão e
--    executável pelo role anon: qualquer pessoa com a anon key (pública, está
--    no js/config.js) podia inserir histórico falso e, via o trigger
--    trg_sync_territory_last_worked_at, empurrar territories.last_worked_at
--    para datas futuras. O único chamador no front é o painel de territórios
--    (gestores), e as RPCs assign/return_territory_field já checam a mesma
--    permissão antes de chamá-la, então exigir can_manage_territories() aqui
--    não muda o comportamento para quem usa o site.
CREATE OR REPLACE FUNCTION public.log_territory_history(p_event_type text, p_territory_id uuid, p_profile_id uuid, p_event_date date, p_details text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_manage_territories() THEN
    RAISE EXCEPTION 'Sem permissao para registrar historico de territorios';
  END IF;

  INSERT INTO public.territory_history (event_type, territory_id, profile_id, event_date, details, metadata, created_by)
  VALUES (p_event_type, p_territory_id, p_profile_id, p_event_date, p_details, p_metadata, auth.uid());
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.log_territory_history(text, uuid, uuid, date, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_territory_history(text, uuid, uuid, date, text, jsonb) TO authenticated, service_role;

-- 2) O bucket público profile-avatars aceitava qualquer tipo e tamanho de
--    arquivo. Alinha com o que o front já valida (jpeg/png/webp, até 2 MB) para
--    que o bucket não sirva de hospedagem de arquivos arbitrários.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'],
    file_size_limit = 2097152
WHERE id = 'profile-avatars';
