-- Quadro de Anúncios pode ler arranjos de Discursos Públicos (Recebemos) do mesmo mês

DROP POLICY IF EXISTS public_speech_boards_announcements_read ON public.public_speech_boards;
DROP POLICY IF EXISTS public_speech_entries_announcements_read ON public.public_speech_entries;

CREATE POLICY public_speech_boards_announcements_read
  ON public.public_speech_boards FOR SELECT
  TO authenticated
  USING (
    status <> 'archived'
    AND public.can_manage_content()
  );

CREATE POLICY public_speech_entries_announcements_read
  ON public.public_speech_entries FOR SELECT
  TO authenticated
  USING (
    public.can_manage_content()
    AND EXISTS (
      SELECT 1 FROM public.public_speech_boards b
      WHERE b.id = board_id AND b.status <> 'archived'
    )
  );
