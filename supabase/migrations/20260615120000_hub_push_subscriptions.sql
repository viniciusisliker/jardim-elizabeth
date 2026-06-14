-- Push subscriptions for Hub notifications (Web Push)

CREATE TABLE IF NOT EXISTS public.hub_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS hub_push_subscriptions_user_idx
  ON public.hub_push_subscriptions (user_id);

ALTER TABLE public.hub_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hub_push_subscriptions_own ON public.hub_push_subscriptions;
CREATE POLICY hub_push_subscriptions_own
  ON public.hub_push_subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_push_subscriptions TO authenticated;

NOTIFY pgrst, 'reload schema';
