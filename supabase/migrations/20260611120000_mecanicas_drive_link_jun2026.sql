-- Link temporário do mês (quadro ainda não publicado via Hub)
UPDATE public.announcement_sections
SET
  document_url = 'https://drive.google.com/file/d/1nkm7A_A-EkdH4OFHf5HiNISZLqni2PmY/view?usp=sharing',
  updated_at = now()
WHERE slug = 'designacoes-mecanicas';
