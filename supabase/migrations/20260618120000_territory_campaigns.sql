-- Campanhas de território: controle isolado (sem vínculo com designações, cronograma ou histórico)

CREATE TABLE IF NOT EXISTS public.territory_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.territory_campaign_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.territory_campaigns(id) ON DELETE CASCADE,
  territory_id uuid NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'trabalhado')),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  worked_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, territory_id)
);

CREATE INDEX IF NOT EXISTS territory_campaign_entries_campaign_idx
  ON public.territory_campaign_entries (campaign_id);

CREATE INDEX IF NOT EXISTS territory_campaign_entries_status_idx
  ON public.territory_campaign_entries (campaign_id, status);

ALTER TABLE public.territory_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_campaign_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS territory_campaigns_read ON public.territory_campaigns;
CREATE POLICY territory_campaigns_read ON public.territory_campaigns
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS territory_campaigns_manage ON public.territory_campaigns;
CREATE POLICY territory_campaigns_manage ON public.territory_campaigns
  FOR ALL TO authenticated
  USING (public.can_manage_territories())
  WITH CHECK (public.can_manage_territories());

DROP POLICY IF EXISTS territory_campaign_entries_read ON public.territory_campaign_entries;
CREATE POLICY territory_campaign_entries_read ON public.territory_campaign_entries
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS territory_campaign_entries_manage ON public.territory_campaign_entries;
CREATE POLICY territory_campaign_entries_manage ON public.territory_campaign_entries
  FOR ALL TO authenticated
  USING (public.can_manage_territories())
  WITH CHECK (public.can_manage_territories());
