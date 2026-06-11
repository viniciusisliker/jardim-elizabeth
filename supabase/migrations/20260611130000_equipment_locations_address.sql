-- Endereço dos pontos de pregação (carrinho / display)

ALTER TABLE public.equipment_locations
  ADD COLUMN IF NOT EXISTS address text;
