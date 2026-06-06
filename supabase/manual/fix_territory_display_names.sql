-- Execute no SQL Editor do Supabase (Dashboard → SQL → New query).
-- Corrige nomes T10–T19 que estavam deslocados em relação às imagens tXX.jpg.

UPDATE public.territories SET display_name = 'Campo Limpo', slug = 'campo limpo' WHERE num = '01';
UPDATE public.territories SET display_name = 'Jardim Elizabeth A', slug = 'jardim elizabeth a' WHERE num = '02';
UPDATE public.territories SET display_name = 'Jardim Elizabeth B', slug = 'jardim elizabeth b' WHERE num = '03';
UPDATE public.territories SET display_name = 'Jardim Elizabeth C', slug = 'jardim elizabeth c' WHERE num = '04';
UPDATE public.territories SET display_name = 'Jardim Elizabeth D', slug = 'jardim elizabeth d' WHERE num = '05';
UPDATE public.territories SET display_name = 'Vila Pirajussara', slug = 'vila pirajussara' WHERE num = '06';
UPDATE public.territories SET display_name = 'Jardim Iracema A', slug = 'jardim iracema a' WHERE num = '07';
UPDATE public.territories SET display_name = 'Jardim Iracema B', slug = 'jardim iracema b' WHERE num = '08';
UPDATE public.territories SET display_name = 'Jardim Helga E', slug = 'jardim helga e' WHERE num = '09';
UPDATE public.territories SET display_name = 'Jd Leônidas Moreira A', slug = 'jardim leonidas moreira a leonidas' WHERE num = '10';
UPDATE public.territories SET display_name = 'Jd Leônidas Moreira B', slug = 'jardim leonidas moreira b leonidas' WHERE num = '11';
UPDATE public.territories SET display_name = 'Jd Leônidas Moreira C', slug = 'jardim leonidas moreira c leonidas' WHERE num = '12';
UPDATE public.territories SET display_name = 'CDHU A', slug = 'cdhu a' WHERE num = '13';
UPDATE public.territories SET display_name = 'CDHU B', slug = 'cdhu b' WHERE num = '14';
UPDATE public.territories SET display_name = 'CDHU C', slug = 'cdhu c' WHERE num = '15';
UPDATE public.territories SET display_name = 'Jardim Helga A', slug = 'jardim helga a' WHERE num = '16';
UPDATE public.territories SET display_name = 'Jardim Helga B', slug = 'jardim helga b' WHERE num = '17';
UPDATE public.territories SET display_name = 'Jardim Helga C', slug = 'jardim helga c' WHERE num = '18';
UPDATE public.territories SET display_name = 'Jardim Helga D', slug = 'jardim helga d' WHERE num = '19';
