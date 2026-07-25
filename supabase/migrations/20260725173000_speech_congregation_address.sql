-- Endereço da congregação (usado na mensagem de WhatsApp dos discursos).

ALTER TABLE public.speech_congregations
  ADD COLUMN IF NOT EXISTS address text;
