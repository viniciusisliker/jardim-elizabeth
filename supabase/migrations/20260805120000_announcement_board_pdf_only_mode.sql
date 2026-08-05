-- Modo PDF único: publicar o quadro como um PDF sem montar no editor

ALTER TABLE public.announcement_boards
  ADD COLUMN IF NOT EXISTS publish_mode text NOT NULL DEFAULT 'structured'
    CHECK (publish_mode = ANY (ARRAY['structured', 'pdf_only'])),
  ADD COLUMN IF NOT EXISTS pdf_full_url text;

COMMENT ON COLUMN public.announcement_boards.publish_mode IS
  'structured = 3 PDFs por seção; pdf_only = um PDF exibido direto na página pública';

COMMENT ON COLUMN public.announcement_boards.pdf_full_url IS
  'URL do PDF completo do quadro quando publish_mode = pdf_only';
