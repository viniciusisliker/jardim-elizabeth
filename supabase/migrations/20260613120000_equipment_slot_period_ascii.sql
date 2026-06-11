-- Valores ASCII no period_label (Manha/Tarde) evitam falha de CHECK por encoding UTF-8

UPDATE public.equipment_schedule_slots
SET period_label = CASE
  WHEN lower(translate(btrim(coalesce(period_label, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')) LIKE 'tard%'
    THEN 'Tarde'
  ELSE 'Manha'
END
WHERE period_label IS NULL
   OR btrim(period_label) = ''
   OR period_label NOT IN ('Manha', 'Tarde');

ALTER TABLE public.equipment_schedule_slots
  DROP CONSTRAINT IF EXISTS equipment_schedule_slots_period_label_check;

ALTER TABLE public.equipment_schedule_slots
  ADD CONSTRAINT equipment_schedule_slots_period_label_check
  CHECK (period_label IN ('Manha', 'Tarde'));

CREATE OR REPLACE FUNCTION public.normalize_equipment_schedule_slot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  p text;
BEGIN
  p := lower(btrim(coalesce(NEW.period_label, '')));
  p := translate(p, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
  IF p = '' OR p LIKE 'manh%' THEN
    NEW.period_label := 'Manha';
  ELSIF p LIKE 'tard%' THEN
    NEW.period_label := 'Tarde';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_equipment_schedule_slot ON public.equipment_schedule_slots;
CREATE TRIGGER trg_normalize_equipment_schedule_slot
  BEFORE INSERT OR UPDATE ON public.equipment_schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_equipment_schedule_slot();
