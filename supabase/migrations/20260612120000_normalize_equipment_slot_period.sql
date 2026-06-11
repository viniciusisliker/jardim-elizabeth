-- Normaliza period_label antes do CHECK (evita falha com valor vazio ou sem acento)

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
    NEW.period_label := 'Manhã';
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

UPDATE public.equipment_schedule_slots
SET period_label = 'Manhã'
WHERE period_label IS NULL
   OR btrim(period_label) = ''
   OR (
     lower(translate(btrim(period_label), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')) LIKE 'manh%'
     AND period_label <> 'Manhã'
   );

UPDATE public.equipment_schedule_slots
SET period_label = 'Tarde'
WHERE lower(translate(btrim(period_label), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')) LIKE 'tard%'
  AND period_label <> 'Tarde';
