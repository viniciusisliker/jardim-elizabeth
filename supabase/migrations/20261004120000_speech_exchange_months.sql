-- Intercâmbio mensal de oradores: a cada mês uma congregação parceira envia
-- oradores para o Jardim Elizabeth (e normalmente enviamos de volta).
-- Substitui a aba "Agenda" da planilha de discursos.
-- Tabela nova e independente: não altera speech_assignments nem o quadro de anúncios.

CREATE TABLE IF NOT EXISTS public.speech_exchange_months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_month date NOT NULL CHECK (extract(day FROM reference_month) = 1),
  congregation_id uuid REFERENCES public.speech_congregations(id) ON DELETE SET NULL,
  congregation_name text,
  coordinator_name text,
  coordinator_phone text,
  region text,
  status text NOT NULL DEFAULT 'a_combinar'
    CHECK (status = ANY (ARRAY['a_combinar', 'aguardando', 'fechado', 'cancelado'])),
  sent_note text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS speech_exchange_months_month_cong_idx
  ON public.speech_exchange_months (reference_month, lower(trim(coalesce(congregation_name, ''))));

CREATE INDEX IF NOT EXISTS speech_exchange_months_month_idx
  ON public.speech_exchange_months (reference_month);

ALTER TABLE public.speech_exchange_months ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS speech_exchange_months_managers_all ON public.speech_exchange_months;
CREATE POLICY speech_exchange_months_managers_all
  ON public.speech_exchange_months FOR ALL TO authenticated
  USING (public.can_manage_public_speeches())
  WITH CHECK (public.can_manage_public_speeches());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.speech_exchange_months TO authenticated;
