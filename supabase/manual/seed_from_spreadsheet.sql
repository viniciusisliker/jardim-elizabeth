-- Seed importado da Planilha Gestao Territorios
-- Idempotente: pode rodar novamente

-- RLS: servos de territorios podem listar profiles para designacao
DROP POLICY IF EXISTS profiles_territory_managers_select ON public.profiles;
CREATE POLICY profiles_territory_managers_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.can_manage_territories()
    OR public.get_my_role() IN ('anciao', 'servo_ministerial', 'superuser')
  );

-- Limpa designacoes ativas anteriores (reimportacao)
UPDATE public.territory_active_assignments SET status = 'returned', returned_at = now() WHERE status = 'active';
DELETE FROM public.territory_overseers;
DELETE FROM public.territory_meeting_spots;
DELETE FROM public.territory_assignments;

UPDATE public.territories SET display_name = 'Jardim Campo Limpo', territory_type = 'meio_de_semana', best_occasion = 'Manhã', last_worked_at = '2026-05-20', status = 'designado', observations = 'Designado via Form às 5/18/2026, 6:37:07 PM' WHERE lower(trim(display_name)) = lower(trim('Jardim Campo Limpo'));

INSERT INTO public.territory_active_assignments (territory_id, profile_id, assigned_at, status)
SELECT t.id, p.id, '2026-05-20', 'active'
FROM public.territories t
JOIN public.profiles p ON (
  lower(trim(p.full_name)) = lower(trim('Fábio Souza'))
  OR lower(trim(p.full_name)) LIKE lower(trim('Fábio')) || '%'
)
WHERE lower(trim(t.display_name)) = lower(trim('Jardim Campo Limpo'))
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.profile_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.territory_id = t.id)
LIMIT 1;
UPDATE public.territories SET display_name = 'Jardim Elizabeth A', territory_type = 'meio_de_semana', best_occasion = 'Tarde', last_worked_at = '2026-05-06', status = 'disponivel', observations = 'Devolvido via Form em 5/11/2026, 5:03:15 PM' WHERE lower(trim(display_name)) = lower(trim('Jardim Elizabeth A'));
UPDATE public.territories SET display_name = 'Jardim Elizabeth B', territory_type = 'meio_de_semana', best_occasion = NULL, last_worked_at = '2026-05-05', status = 'disponivel', observations = 'Devolvido via Form em 5/11/2026, 5:03:01 PM' WHERE lower(trim(display_name)) = lower(trim('Jardim Elizabeth B'));
UPDATE public.territories SET display_name = 'Jardim Elizabeth C', territory_type = 'meio_de_semana', best_occasion = NULL, last_worked_at = '2026-05-12', status = 'designado', observations = 'Designado via Form às 5/11/2026, 7:35:13 PM' WHERE lower(trim(display_name)) = lower(trim('Jardim Elizabeth C'));

INSERT INTO public.territory_active_assignments (territory_id, profile_id, assigned_at, status)
SELECT t.id, p.id, '2026-05-12', 'active'
FROM public.territories t
JOIN public.profiles p ON (
  lower(trim(p.full_name)) = lower(trim('Alexsezar Tenório'))
  OR lower(trim(p.full_name)) LIKE lower(trim('Alexsezar')) || '%'
)
WHERE lower(trim(t.display_name)) = lower(trim('Jardim Elizabeth C'))
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.profile_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.territory_id = t.id)
LIMIT 1;
UPDATE public.territories SET display_name = 'Jardim Elizabeth D', territory_type = 'meio_de_semana', best_occasion = NULL, last_worked_at = '2026-04-10', status = 'designado', observations = 'Designado via Form às 4/6/2026, 6:15:30 PM' WHERE lower(trim(display_name)) = lower(trim('Jardim Elizabeth D'));

INSERT INTO public.territory_active_assignments (territory_id, profile_id, assigned_at, status)
SELECT t.id, p.id, '2026-04-10', 'active'
FROM public.territories t
JOIN public.profiles p ON (
  lower(trim(p.full_name)) = lower(trim('Cosme Silva'))
  OR lower(trim(p.full_name)) LIKE lower(trim('Cosme')) || '%'
)
WHERE lower(trim(t.display_name)) = lower(trim('Jardim Elizabeth D'))
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.profile_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.territory_id = t.id)
LIMIT 1;
UPDATE public.territories SET display_name = 'Vila Pirajussara', territory_type = 'meio_de_semana', best_occasion = NULL, last_worked_at = '2026-04-14', status = 'disponivel', observations = 'Devolvido via Form em 4/21/2026, 11:24:47 PM' WHERE lower(trim(display_name)) = lower(trim('Vila Pirajussara'));
UPDATE public.territories SET display_name = 'Jardim Iracema A', territory_type = 'final_de_semana', best_occasion = NULL, last_worked_at = '2026-04-26', status = 'designado', observations = 'Designado via Form às 4/22/2026, 12:05:45 AM' WHERE lower(trim(display_name)) = lower(trim('Jardim Iracema A'));
UPDATE public.territories SET display_name = 'Jardim Iracema B', territory_type = 'final_de_semana', best_occasion = NULL, last_worked_at = '2026-05-17', status = 'disponivel', observations = 'Devolvido via Form em 5/18/2026, 6:34:13 PM' WHERE lower(trim(display_name)) = lower(trim('Jardim Iracema B'));
UPDATE public.territories SET display_name = 'Jardim Helga E', territory_type = 'meio_de_semana', best_occasion = NULL, last_worked_at = '2026-05-13', status = 'disponivel', observations = 'Devolvido via Form em 5/18/2026, 6:31:29 PM' WHERE lower(trim(display_name)) = lower(trim('Jardim Helga E'));
UPDATE public.territories SET display_name = 'Jd Leônidas Moreira A', territory_type = 'meio_de_semana', best_occasion = NULL, last_worked_at = '2026-04-18', status = 'disponivel', observations = 'Devolvido via Form em 4/21/2026, 11:58:58 PM' WHERE lower(trim(display_name)) = lower(trim('Jd Leônidas Moreira A'));
UPDATE public.territories SET display_name = 'Jd Leônidas Moreira B', territory_type = 'meio_de_semana', best_occasion = NULL, last_worked_at = '2026-04-30', status = 'designado', observations = 'Designado via Form às 4/27/2026, 9:16:47 PM' WHERE lower(trim(display_name)) = lower(trim('Jd Leônidas Moreira B'));

INSERT INTO public.territory_active_assignments (territory_id, profile_id, assigned_at, status)
SELECT t.id, p.id, '2026-04-30', 'active'
FROM public.territories t
JOIN public.profiles p ON (
  lower(trim(p.full_name)) = lower(trim('João Neves'))
  OR lower(trim(p.full_name)) LIKE lower(trim('João')) || '%'
)
WHERE lower(trim(t.display_name)) = lower(trim('Jd Leônidas Moreira B'))
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.profile_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.territory_id = t.id)
LIMIT 1;
UPDATE public.territories SET display_name = 'Jd Leônidas Moreira C', territory_type = 'final_de_semana', best_occasion = NULL, last_worked_at = '2026-05-03', status = 'designado', observations = 'Designado via Form às 4/27/2026, 9:20:30 PM' WHERE lower(trim(display_name)) = lower(trim('Jd Leônidas Moreira C'));
UPDATE public.territories SET display_name = 'CDHU A', territory_type = 'final_de_semana', best_occasion = NULL, last_worked_at = '2026-05-23', status = 'designado', observations = 'Designado via Form às 5/18/2026, 6:48:49 PM' WHERE lower(trim(display_name)) = lower(trim('CDHU A'));

INSERT INTO public.territory_active_assignments (territory_id, profile_id, assigned_at, status)
SELECT t.id, p.id, '2026-05-23', 'active'
FROM public.territories t
JOIN public.profiles p ON (
  lower(trim(p.full_name)) = lower(trim('Lucas Dias'))
  OR lower(trim(p.full_name)) LIKE lower(trim('Lucas')) || '%'
)
WHERE lower(trim(t.display_name)) = lower(trim('CDHU A'))
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.profile_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.territory_id = t.id)
LIMIT 1;
UPDATE public.territories SET display_name = 'CDHU B', territory_type = 'final_de_semana', best_occasion = NULL, last_worked_at = '2026-03-28', status = 'disponivel', observations = 'Devolvido via Form em 3/30/2026, 10:52:01 PM' WHERE lower(trim(display_name)) = lower(trim('CDHU B'));
UPDATE public.territories SET display_name = 'CDHU C', territory_type = 'final_de_semana', best_occasion = NULL, last_worked_at = '2026-03-28', status = 'disponivel', observations = 'Devolvido via Form em 3/30/2026, 10:52:15 PM' WHERE lower(trim(display_name)) = lower(trim('CDHU C'));
UPDATE public.territories SET display_name = 'Jardim Helga A', territory_type = 'final_de_semana', best_occasion = NULL, last_worked_at = '2026-03-21', status = 'disponivel', observations = 'Devolvido via Form em 3/23/2026, 7:43:48 PM' WHERE lower(trim(display_name)) = lower(trim('Jardim Helga A'));
UPDATE public.territories SET display_name = 'Jardim Helga B', territory_type = 'final_de_semana', best_occasion = NULL, last_worked_at = '2026-04-26', status = 'disponivel', observations = 'Devolvido via Form em 4/27/2026, 8:55:40 PM' WHERE lower(trim(display_name)) = lower(trim('Jardim Helga B'));
UPDATE public.territories SET display_name = 'Jardim Helga C', territory_type = 'final_de_semana', best_occasion = NULL, last_worked_at = '2026-05-24', status = 'designado', observations = 'Designado via Form às 5/18/2026, 6:38:50 PM' WHERE lower(trim(display_name)) = lower(trim('Jardim Helga C'));
UPDATE public.territories SET display_name = 'Jardim Helga D', territory_type = 'final_de_semana', best_occasion = NULL, last_worked_at = '2026-05-16', status = 'disponivel', observations = 'Devolvido via Form em 5/18/2026, 6:47:50 PM' WHERE lower(trim(display_name)) = lower(trim('Jardim Helga D'));

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'final_de_semana', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Ademilson'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Ademilson')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'meio_de_semana', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Alexsezar Tenório'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Alexsezar')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'final_de_semana', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('André Neves'))
   OR lower(trim(p.full_name)) LIKE lower(trim('André')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'final_de_semana', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Arnaldo Isliker'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Arnaldo')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'meio_de_semana', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Cosme Silva'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Cosme')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'final_de_semana', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Denison Oliveira'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Denison')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'final_de_semana', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Edvan Dantas'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Edvan')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'meio_de_semana', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Fábio Souza'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Fábio')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'final_de_semana', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('João Neves'))
   OR lower(trim(p.full_name)) LIKE lower(trim('João')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'final_de_semana', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Lucas Dias'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Lucas')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'final_de_semana', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Marcelo Almeida'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Marcelo')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'final_de_semana', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Marcelo Freire'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Marcelo')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'final_de_semana', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Rikael Morais'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Rikael')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'final_de_semana', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Vinicius'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Vinicius')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'ambos', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Meio de Semana'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Meio')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'meio_de_semana', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Fábio Souza'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Fábio')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'meio_de_semana', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Alexsezar Tenório'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Alexsezar')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'meio_de_semana', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('João Neves'))
   OR lower(trim(p.full_name)) LIKE lower(trim('João')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'meio_de_semana', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Cosme Silva'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Cosme')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'ambos', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Dirigentes - Domingo'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Dirigentes')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'ambos', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Edvan Dantas'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Edvan')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'ambos', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Marcelo Freire'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Marcelo')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'ambos', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Ademilson'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Ademilson')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'ambos', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('João Neves'))
   OR lower(trim(p.full_name)) LIKE lower(trim('João')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'ambos', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('André Neves'))
   OR lower(trim(p.full_name)) LIKE lower(trim('André')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'ambos', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Cosme Silva'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Cosme')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'ambos', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Marcelo Almeida'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Marcelo')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'ambos', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Rikael Morais'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Rikael')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'ambos', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Lucas Dias'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Lucas')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'ambos', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Arnaldo Isliker'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Arnaldo')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'ambos', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Denison Oliveira'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Denison')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'ambos', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Vinicius'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Vinicius')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;

INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, 'ambos', true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim('Alexsezar Tenório'))
   OR lower(trim(p.full_name)) LIKE lower(trim('Alexsezar')) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;
INSERT INTO public.territory_meeting_spots (weekday_label, location_name, address, schedule_times, sort_order) VALUES ('Quinta', 'Casa da Lúcia Duarte', 'Rua Martim da Costa Vilela, 74 - Campo Limpo', '09:00', 1);
INSERT INTO public.territory_meeting_spots (weekday_label, location_name, address, schedule_times, sort_order) VALUES ('Sexta', 'Casa da Natividade Aguiar', 'Rua Hermes Ribeiro de Freitas, 457 - Jardim Elizabeth', '09:00', 2);
INSERT INTO public.territory_meeting_spots (weekday_label, location_name, address, schedule_times, sort_order) VALUES ('Sábado', 'Casa da Lúcia Duarte', 'Rua Martim da Costa Vilela, 74 - Campo Limpo', '09:15', 3);
INSERT INTO public.territory_meeting_spots (weekday_label, location_name, address, schedule_times, sort_order) VALUES ('Domingo', 'Casa da Lúcia Duarte', 'Rua Martim da Costa Vilela, 74 - Campo Limpo', '09:15', 4);
INSERT INTO public.territory_meeting_spots (weekday_label, location_name, address, schedule_times, sort_order) VALUES ('Domingo', 'Casa da Natividade Aguiar', 'Rua Hermes Ribeiro de Freitas, 457 - Jardim Elizabeth', '09:15', 5);
INSERT INTO public.territory_meeting_spots (weekday_label, location_name, address, schedule_times, sort_order) VALUES ('Domingo', 'Casa da Helena Silva', 'Rua Frederico de Azevedo Antunes, 306 - Jardim Rosana', '09:15', 6);
INSERT INTO public.territory_meeting_spots (weekday_label, location_name, address, schedule_times, sort_order) VALUES ('Carrinho Almeida', 'Rua Dr. Zamitti Mammana, 74 - Jardim Elizabeth', NULL, NULL, 7);
INSERT INTO public.territory_meeting_spots (weekday_label, location_name, address, schedule_times, sort_order) VALUES ('Carrinho Souza', 'Rua Frederico de Azevedo Antunes, 306 - Jardim Rosana', NULL, NULL, 8);
INSERT INTO public.territory_meeting_spots (weekday_label, location_name, address, schedule_times, sort_order) VALUES ('Display', 'Rua Hermes Ribeiro Freitas, 253 - Jardim Elizabeth', NULL, NULL, 9);
INSERT INTO public.territory_meeting_spots (weekday_label, location_name, address, schedule_times, sort_order) VALUES ('Nome', 'Endereço', NULL, NULL, 10);
INSERT INTO public.territory_meeting_spots (weekday_label, location_name, address, schedule_times, sort_order) VALUES ('JOSEFA', 'Rua Hermes Ribeiro Freitas, 253 - Jardim Elizabeth', NULL, NULL, 11);
INSERT INTO public.territory_meeting_spots (weekday_label, location_name, address, schedule_times, sort_order) VALUES ('DROGASIL', 'R. Cabaxi, 30 - 40 - Campo Limpo', NULL, NULL, 12);
INSERT INTO public.territory_meeting_spots (weekday_label, location_name, address, schedule_times, sort_order) VALUES ('DIB AUDI', 'R. Januário da Cunha Barbosa, 413 - Jardim Elizabeth', NULL, NULL, 13);
INSERT INTO public.territory_meeting_spots (weekday_label, location_name, address, schedule_times, sort_order) VALUES ('CEU CAMPO LIMPO', 'Av. Carlos Lacerda, 678 - Vila Pirajussara', NULL, NULL, 14);
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-03-28', 'Denison Oliveira · T13 CDHU A');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-03-26', 'João Neves · T2 Jardim Elizabeth A');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-03-28', 'Denison Oliveira · T14 CDHU B');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-03-28', 'Denison Oliveira · T15 CDHU C');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-03-24', 'Alexsezar Tenório · T5 Jardim Elizabeth D');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-03-25', 'Fábio Silva · T18 Jardim Helga C');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-03-27', 'Cosme Silva · T9 Jardim Helga E');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-03-29', 'Marcelo Freire e Edvan · T10 Jardim Leônidas Moreira A');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-03-29', 'Denison e Arnaldo · T11 Jardim Leônidas Moreira B');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-03-22', 'Marcelo Almeida e João · T3 Jardim Elizabeth B');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-03-29', 'Denison e Arnaldo · T11 Jardim Leônidas Moreira B');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-03-31', 'Alexsezar Tenório · T6 Vila Pirajussara');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-04-03', 'Cosme Silva · T1 Campo Limpo');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-04-04', 'Vinícius de Morais · T4 Jardim Elizabeth C');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-04-05', 'Marcelo Freire e Edvan · T8 Jardim Iracema B');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-04-11', 'André Neves · T7 Jardim Iracema A');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-04-11', 'André Neves · T8 Jardim Iracema B');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-04-12', 'Marcelo Freire e Edvan · T17 Jardim Helga B');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-04-08', 'Fábio Silva · T3 Jardim Elizabeth B');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-04-10', 'Cosme Silva · T5 Jardim Elizabeth D');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-04-15', 'Fábio Silva · T9 Jardim Helga E');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-04-18', 'Ademilson Dias · T10 Jardim Leônidas Moreira A');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-04-18', 'Ademilson Dias · T11 Jardim Leônidas Moreira B');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-03-31', 'Alexsezar Tenório · T6 Vila Pirajussara');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-04-16', 'João Neves · T4 Jardim Elizabeth C');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-04-21', 'Alexsezar Tenório · T3 Jardim Elizabeth B');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-04-22', 'Fábio Silva · T1 Campo Limpo');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-04-25', 'Cosme Silva · T18 Jardim Helga C');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-04-26', 'Marcelo Almeida e João · T9 Jardim Helga E');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-04-26', 'Denison e Arnaldo · T7 Jardim Iracema A');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-04-29', 'Fábio Silva · T2 Jardim Elizabeth A');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-04-30', 'João Neves · T11 Jardim Leônidas Moreira B');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-05-03', 'Marcelo Almeida e João · T8 Jardim Iracema B');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-05-03', 'Marcelo Freire e Edvan · T12 Jardim Leônidas Moreira C');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-05-02', 'A DEFINIR · T19 Jardim Helga D');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-05-12', 'Alexsezar Tenório · T4 Jardim Elizabeth C');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-05-13', 'Fábio Silva · T9 Jardim Helga E');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-05-20', 'Fábio Silva · T1 Campo Limpo');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-05-24', 'Marcelo Almeida e João · T18 Jardim Helga C');
INSERT INTO public.territory_history (event_type, event_date, details) VALUES ('designacao', '2026-05-23', 'Lucas Dias · T13 CDHU A');