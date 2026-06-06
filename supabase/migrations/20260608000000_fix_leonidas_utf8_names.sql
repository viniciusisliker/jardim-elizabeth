-- Corrige T10–T12 quando display_name ficou "Le??nidas" (ô perdido ao aplicar SQL no Windows).
-- Usa decode hex UTF-8 para não depender do encoding do arquivo no CLI.

UPDATE public.territories
SET display_name = convert_from(decode('4a64204cc3b46e69646173204d6f72656972612041', 'hex'), 'UTF8'),
    slug = 'jardim leonidas moreira a leonidas'
WHERE num = '10';

UPDATE public.territories
SET display_name = convert_from(decode('4a64204cc3b46e69646173204d6f72656972612042', 'hex'), 'UTF8'),
    slug = 'jardim leonidas moreira b leonidas'
WHERE num = '11';

UPDATE public.territories
SET display_name = convert_from(decode('4a64204cc3b46e69646173204d6f72656972612043', 'hex'), 'UTF8'),
    slug = 'jardim leonidas moreira c leonidas'
WHERE num = '12';
