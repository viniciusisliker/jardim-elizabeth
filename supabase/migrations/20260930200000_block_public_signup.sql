-- Bloqueia o cadastro público do Supabase Auth no banco (auditoria de 2026-09-30).
--
-- O site não usa signup público: membros são criados pelas RPCs
-- admin_create_team_member e secretary_create_publisher, que são SECURITY
-- DEFINER e inserem em auth.users como o dono da função (postgres). O serviço
-- de Auth (GoTrue) insere como supabase_auth_admin, e esse caminho só é usado
-- pelo /auth/v1/signup (e por convites/criação de usuário no painel). Em
-- 22-23/09 um scanner criou 5 contas por esse caminho.
--
-- Este trigger recusa inserts feitos pelo serviço de Auth, com o mesmo efeito
-- de "Allow new users to sign up = OFF", mas versionado no repo. Login, troca e
-- reset de senha fazem UPDATE, não INSERT, e não são afetados.
-- Para criar um usuário pelo painel do Supabase, desative o trigger antes:
--   ALTER TABLE auth.users DISABLE TRIGGER block_public_signup;
CREATE OR REPLACE FUNCTION public.block_public_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF current_user = 'supabase_auth_admin' THEN
    RAISE EXCEPTION 'Cadastro publico desativado. Membros sao criados pela administracao.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.block_public_signup() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS block_public_signup ON auth.users;
CREATE TRIGGER block_public_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.block_public_signup();
