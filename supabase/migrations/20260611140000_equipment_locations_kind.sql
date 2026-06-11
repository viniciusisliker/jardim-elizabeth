-- Tipo de local: equipamento (aba Equipamentos), trabalho (Cronograma), encontro (reservado)

ALTER TABLE public.equipment_locations
  ADD COLUMN IF NOT EXISTS location_kind text NOT NULL DEFAULT 'trabalho';

ALTER TABLE public.equipment_locations
  DROP CONSTRAINT IF EXISTS equipment_locations_location_kind_check;

ALTER TABLE public.equipment_locations
  ADD CONSTRAINT equipment_locations_location_kind_check
  CHECK (location_kind IN ('equipamento', 'trabalho', 'encontro'));
