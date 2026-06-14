-- Jardim Elizabeth Hub — Notificações in-app (equipe)
-- Leitura: destinatário; envio: SuperUser, Ancião, Servo Ministerial ou permissão settings

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
        OR p.role IN ('anciao', 'servo_ministerial')
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

REVOKE ALL ON FUNCTION public.je_can_access_hub(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.je_can_access_hub(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.je_can_send_hub_notifications()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_superuser()
    OR public.get_my_role() IN ('anciao', 'servo_ministerial')
    OR public.has_access_permission('settings');
$$;

REVOKE ALL ON FUNCTION public.je_can_send_hub_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.je_can_send_hub_notifications() TO authenticated;

CREATE TABLE IF NOT EXISTS public.hub_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(trim(title)) > 0),
  CHECK (length(trim(body)) > 0)
);

COMMENT ON COLUMN public.hub_notifications.recipient_user_id IS
  'Destinatário. Fan-out via RPC cria uma linha por membro com acesso ao Hub.';

CREATE INDEX IF NOT EXISTS hub_notifications_recipient_created_idx
  ON public.hub_notifications (recipient_user_id, created_at DESC)
  WHERE recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS hub_notifications_recipient_unread_idx
  ON public.hub_notifications (recipient_user_id)
  WHERE read_at IS NULL AND recipient_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.hub_notifications_send(
  p_title text,
  p_body text,
  p_recipient uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_title text := trim(coalesce(p_title, ''));
  v_body text := trim(coalesce(p_body, ''));
  v_count integer := 0;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.je_can_send_hub_notifications() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF length(v_title) = 0 OR length(v_body) = 0 THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;

  IF p_recipient IS NOT NULL THEN
    IF NOT public.je_can_access_hub(p_recipient) THEN
      RAISE EXCEPTION 'recipient_not_found';
    END IF;

    INSERT INTO public.hub_notifications (recipient_user_id, sender_user_id, title, body)
    VALUES (p_recipient, v_me, v_title, v_body);
    RETURN 1;
  END IF;

  INSERT INTO public.hub_notifications (recipient_user_id, sender_user_id, title, body)
  SELECT p.id, v_me, v_title, v_body
  FROM public.profiles p
  WHERE public.je_can_access_hub(p.id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.hub_notifications_send(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_notifications_send(text, text, uuid) TO authenticated;

ALTER TABLE public.hub_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hub_notifications_select_own ON public.hub_notifications;
CREATE POLICY hub_notifications_select_own
  ON public.hub_notifications FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS hub_notifications_insert_gestao ON public.hub_notifications;
CREATE POLICY hub_notifications_insert_gestao
  ON public.hub_notifications FOR INSERT TO authenticated
  WITH CHECK (
    public.je_can_send_hub_notifications()
    AND sender_user_id = auth.uid()
    AND (
      recipient_user_id IS NULL
      OR public.je_can_access_hub(recipient_user_id)
    )
  );

DROP POLICY IF EXISTS hub_notifications_update_own_read ON public.hub_notifications;
CREATE POLICY hub_notifications_update_own_read
  ON public.hub_notifications FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS profiles_select_notification_senders ON public.profiles;
CREATE POLICY profiles_select_notification_senders
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.hub_notifications n
      WHERE n.recipient_user_id = auth.uid()
        AND n.sender_user_id = profiles.id
    )
  );

GRANT SELECT, UPDATE ON public.hub_notifications TO authenticated;
GRANT INSERT ON public.hub_notifications TO authenticated;

DO $pub$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'hub_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hub_notifications;
  END IF;
END;
$pub$;

NOTIFY pgrst, 'reload schema';
