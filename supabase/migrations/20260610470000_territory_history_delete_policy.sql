-- Permite que gestores excluam registros individuais do histórico pelo painel admin.
CREATE POLICY territory_history_delete_manager
  ON public.territory_history FOR DELETE
  TO authenticated
  USING (public.can_manage_territories());
