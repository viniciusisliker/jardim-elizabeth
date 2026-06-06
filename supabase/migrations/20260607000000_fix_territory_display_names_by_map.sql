-- Alinha display_name e slug ao rótulo escrito em cada cartão de mapa (t01.jpg … t19.jpg).

UPDATE public.territories SET display_name = 'Campo Limpo', slug = 'campo limpo' WHERE num = '01';
UPDATE public.territories SET display_name = 'Jardim Elizabeth A', slug = 'jardim elizabeth a' WHERE num = '02';
UPDATE public.territories SET display_name = 'Jardim Elizabeth B', slug = 'jardim elizabeth b' WHERE num = '03';
UPDATE public.territories SET display_name = 'Jardim Elizabeth C', slug = 'jardim elizabeth c' WHERE num = '04';
UPDATE public.territories SET display_name = 'Jardim Elizabeth D', slug = 'jardim elizabeth d' WHERE num = '05';
UPDATE public.territories SET display_name = 'Vila Pirajussara', slug = 'vila pirajussara' WHERE num = '06';
UPDATE public.territories SET display_name = 'Jardim Iracema A', slug = 'jardim iracema a' WHERE num = '07';
UPDATE public.territories SET display_name = 'Jardim Iracema B', slug = 'jardim iracema b' WHERE num = '08';
UPDATE public.territories SET display_name = 'Jardim Helga E', slug = 'jardim helga e' WHERE num = '09';
UPDATE public.territories SET display_name = convert_from(decode('4a64204c65c3b46e69646173204d6f72656972612041', 'hex'), 'UTF8'), slug = 'jardim leonidas moreira a leonidas' WHERE num = '10';
UPDATE public.territories SET display_name = convert_from(decode('4a64204c65c3b46e69646173204d6f72656972612042', 'hex'), 'UTF8'), slug = 'jardim leonidas moreira b leonidas' WHERE num = '11';
UPDATE public.territories SET display_name = convert_from(decode('4a64204c65c3b46e69646173204d6f72656972612043', 'hex'), 'UTF8'), slug = 'jardim leonidas moreira c leonidas' WHERE num = '12';
UPDATE public.territories SET display_name = 'CDHU A', slug = 'cdhu a' WHERE num = '13';
UPDATE public.territories SET display_name = 'CDHU B', slug = 'cdhu b' WHERE num = '14';
UPDATE public.territories SET display_name = 'CDHU C', slug = 'cdhu c' WHERE num = '15';
UPDATE public.territories SET display_name = 'Jardim Helga A', slug = 'jardim helga a' WHERE num = '16';
UPDATE public.territories SET display_name = 'Jardim Helga B', slug = 'jardim helga b' WHERE num = '17';
UPDATE public.territories SET display_name = 'Jardim Helga C', slug = 'jardim helga c' WHERE num = '18';
UPDATE public.territories SET display_name = 'Jardim Helga D', slug = 'jardim helga d' WHERE num = '19';
