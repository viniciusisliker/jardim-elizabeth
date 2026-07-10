-- Discursos PÃºblicos CRM: temas S-34, congregaÃ§Ãµes, oradores, agenda

CREATE TABLE IF NOT EXISTS public.speech_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outline_number integer NOT NULL UNIQUE,
  title text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.speech_congregations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  contact_name text,
  phone text,
  email text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS speech_congregations_name_ci_idx
  ON public.speech_congregations (lower(trim(name)));

CREATE TABLE IF NOT EXISTS public.speech_speakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  congregation_id uuid REFERENCES public.speech_congregations(id) ON DELETE SET NULL,
  phone text,
  email text,
  privilege text NOT NULL DEFAULT 'anciao'
    CHECK (privilege = ANY (ARRAY['anciao', 'servo_ministerial'])),
  is_local boolean NOT NULL DEFAULT true,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS speech_speakers_name_idx
  ON public.speech_speakers (full_name);

CREATE TABLE IF NOT EXISTS public.speech_speaker_themes (
  speaker_id uuid NOT NULL REFERENCES public.speech_speakers(id) ON DELETE CASCADE,
  theme_id uuid NOT NULL REFERENCES public.speech_themes(id) ON DELETE CASCADE,
  prepared_at date DEFAULT CURRENT_DATE,
  PRIMARY KEY (speaker_id, theme_id)
);

CREATE TABLE IF NOT EXISTS public.speech_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction = ANY (ARRAY['receive', 'send'])),
  event_date date NOT NULL,
  event_time time,
  speaker_id uuid REFERENCES public.speech_speakers(id) ON DELETE SET NULL,
  speaker_name text,
  theme_id uuid REFERENCES public.speech_themes(id) ON DELETE SET NULL,
  outline_number integer,
  theme_title text,
  congregation_id uuid REFERENCES public.speech_congregations(id) ON DELETE SET NULL,
  congregation_name text,
  opening_song text,
  modality text NOT NULL DEFAULT 'presencial'
    CHECK (modality = ANY (ARRAY['presencial', 'online'])),
  confirmation_status text NOT NULL DEFAULT 'pendente'
    CHECK (confirmation_status = ANY (ARRAY['pendente', 'confirmado', 'cancelado'])),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS speech_assignments_event_date_idx
  ON public.speech_assignments (event_date DESC, direction);

CREATE INDEX IF NOT EXISTS speech_assignments_speaker_idx
  ON public.speech_assignments (speaker_id, event_date DESC);

CREATE INDEX IF NOT EXISTS speech_assignments_status_idx
  ON public.speech_assignments (confirmation_status, event_date);

ALTER TABLE public.speech_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speech_congregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speech_speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speech_speaker_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speech_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS speech_themes_managers_all ON public.speech_themes;
CREATE POLICY speech_themes_managers_all
  ON public.speech_themes FOR ALL TO authenticated
  USING (public.can_manage_public_speeches())
  WITH CHECK (public.can_manage_public_speeches());

DROP POLICY IF EXISTS speech_congregations_managers_all ON public.speech_congregations;
CREATE POLICY speech_congregations_managers_all
  ON public.speech_congregations FOR ALL TO authenticated
  USING (public.can_manage_public_speeches())
  WITH CHECK (public.can_manage_public_speeches());

DROP POLICY IF EXISTS speech_speakers_managers_all ON public.speech_speakers;
CREATE POLICY speech_speakers_managers_all
  ON public.speech_speakers FOR ALL TO authenticated
  USING (public.can_manage_public_speeches())
  WITH CHECK (public.can_manage_public_speeches());

DROP POLICY IF EXISTS speech_speaker_themes_managers_all ON public.speech_speaker_themes;
CREATE POLICY speech_speaker_themes_managers_all
  ON public.speech_speaker_themes FOR ALL TO authenticated
  USING (public.can_manage_public_speeches())
  WITH CHECK (public.can_manage_public_speeches());

DROP POLICY IF EXISTS speech_assignments_managers_all ON public.speech_assignments;
CREATE POLICY speech_assignments_managers_all
  ON public.speech_assignments FOR ALL TO authenticated
  USING (public.can_manage_public_speeches())
  WITH CHECK (public.can_manage_public_speeches());

-- Leitura para Quadro de AnÃºncios (sync final de semana)
DROP POLICY IF EXISTS speech_assignments_announcements_read ON public.speech_assignments;
CREATE POLICY speech_assignments_announcements_read
  ON public.speech_assignments FOR SELECT TO authenticated
  USING (public.can_manage_content());

DROP POLICY IF EXISTS speech_themes_announcements_read ON public.speech_themes;
CREATE POLICY speech_themes_announcements_read
  ON public.speech_themes FOR SELECT TO authenticated
  USING (public.can_manage_content());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.speech_themes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speech_congregations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speech_speakers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speech_speaker_themes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speech_assignments TO authenticated;


-- Seed: esboÃ§os S-34 (jw.org) â€” gerado por scripts/generate-speech-themes-seed.py
INSERT INTO public.speech_themes (outline_number, title)
VALUES
  (1, 'VocÃª conhece bem a Deus?'),
  (2, 'VocÃª vai sobreviver aos Ãºltimos dias?'),
  (3, 'VocÃª estÃ¡ avanÃ§ando com a organizaÃ§Ã£o unida de JeovÃ¡?'),
  (4, 'Que provas temos de que Deus existe?'),
  (5, 'VocÃª pode ter uma famÃ­lia feliz!'),
  (6, 'O dilÃºvio dos dias de NoÃ© e vocÃª'),
  (7, 'Imite a misericÃ³rdia de JeovÃ¡'),
  (8, 'Viva para fazer a vontade de Deus'),
  (9, 'Escute e faÃ§a o que a BÃ­blia diz'),
  (10, 'Seja honesto em tudo'),
  (11, 'Imite a Jesus e nÃ£o faÃ§a parte do mundo'),
  (12, 'Deus quer que vocÃª respeite quem tem autoridade'),
  (13, 'Qual o ponto de vista de Deus sobre o sexo e o casamento?'),
  (14, 'Um povo puro e limpo honra a JeovÃ¡'),
  (15, '''FaÃ§a o bem a todos'''),
  (16, 'Seja cada vez mais amigo de JeovÃ¡'),
  (17, 'Glorifique a Deus com tudo o que vocÃª tem'),
  (18, 'FaÃ§a de JeovÃ¡ a sua fortaleza'),
  (19, 'Como vocÃª pode saber seu futuro?'),
  (20, 'Chegou o tempo de Deus governar o mundo?'),
  (21, 'DÃª valor ao seu lugar no Reino de Deus'),
  (22, 'VocÃª estÃ¡ usando bem o que JeovÃ¡ lhe dÃ¡?'),
  (23, 'A vida tem objetivo'),
  (24, 'VocÃª encontrou "uma pÃ©rola de grande valor"?'),
  (25, 'Lute contra o espÃ­rito do mundo'),
  (26, 'VocÃª Ã© importante para Deus?'),
  (27, 'Como construir um casamento feliz'),
  (28, 'Mostre respeito e amor no seu casamento'),
  (29, 'As responsabilidades e recompensas de ter filhos'),
  (30, 'Como melhorar a comunicaÃ§Ã£o na famÃ­lia'),
  (31, 'VocÃª tem consciÃªncia da sua necessidade espiritual?'),
  (32, 'Como lidar com as ansiedades da vida'),
  (33, 'Quando vai existir verdadeira justiÃ§a?'),
  (34, 'VocÃª vai ser marcado para sobreviver?'),
  (35, 'Ã‰ possÃ­vel viver para sempre? O que vocÃª precisa fazer?'),
  (36, 'SerÃ¡ que a vida Ã© sÃ³ isso?'),
  (37, 'Obedecer a Deus Ã© mesmo a melhor coisa a fazer?'),
  (38, 'Como vocÃª pode sobreviver ao fim do mundo?'),
  (39, 'Jesus Cristo vence o mundo â€” Como e quando?'),
  (40, 'O que vai acontecer em breve?'),
  (41, 'Fiquem parados e vejam como JeovÃ¡ os salvarÃ¡'),
  (42, 'O amor pode vencer o Ã³dio?'),
  (43, 'Tudo o que Deus nos pede Ã© para o nosso bem'),
  (44, 'Como os ensinos de Jesus podem ajudar vocÃª?'),
  (45, 'Continue andando no caminho que leva Ã  vida'),
  (46, 'FortaleÃ§a sua confianÃ§a em JeovÃ¡'),
  (47, '''Tenha fÃ© nas boas novas'''),
  (48, 'Seja leal a Deus mesmo quando for testado'),
  (49, 'SerÃ¡ que um dia a Terra vai ser limpa?'),
  (50, 'Como sempre tomar as melhores decisÃµes'),
  (51, 'SerÃ¡ que a verdade da BÃ­blia estÃ¡ mudando a sua vida?'),
  (52, 'Quem Ã© o seu Deus?'),
  (53, 'VocÃª pensa como Deus?'),
  (54, 'FortaleÃ§a sua fÃ© em Deus e em suas promessas'),
  (55, 'VocÃª estÃ¡ fazendo um bom nome perante Deus?'),
  (56, 'Existe um lÃ­der em quem vocÃª pode confiar?'),
  (57, 'Como suportar perseguiÃ§Ã£o'),
  (58, 'Quem sÃ£o os verdadeiros seguidores de Cristo?'),
  (59, 'CeifarÃ¡ o que semear'),
  (60, 'VocÃª tem um objetivo na vida?'),
  (61, 'Nas promessas de quem vocÃª confia?'),
  (62, 'Onde encontrar uma esperanÃ§a real para o futuro?'),
  (63, 'Ã‰ possÃ­vel encontrar a verdade?'),
  (64, 'VocÃª ama os prazeres ou a Deus?'),
  (65, 'Como podemos ser pacÃ­ficos num mundo cheio de Ã³dio'),
  (66, 'VocÃª tambÃ©m vai participar na colheita?'),
  (67, 'Medite na BÃ­blia e nas criaÃ§Ãµes de JeovÃ¡'),
  (68, '''Continuem a perdoar uns aos outros liberalmente'''),
  (69, 'Por que mostrar amor abnegado?'),
  (70, 'Por que Deus merece sua confianÃ§a?'),
  (71, '''Mantenha-se desperto'' â€” Por que e como?'),
  (72, 'O amor identifica os cristÃ£os verdadeiros'),
  (73, 'VocÃª tem "um coraÃ§Ã£o sÃ¡bio"?'),
  (74, 'Os olhos de JeovÃ¡ estÃ£o em todo lugar'),
  (75, 'Mostre que vocÃª apoia o direito de JeovÃ¡ governar'),
  (76, 'PrincÃ­pios bÃ­blicos â€” Podem nos ajudar a lidar com os problemas atuais?'),
  (77, '"Sempre mostrem hospitalidade"'),
  (78, 'Sirva a JeovÃ¡ com um coraÃ§Ã£o alegre'),
  (79, 'VocÃª vai escolher ser amigo de Deus?'),
  (80, 'VocÃª baseia sua esperanÃ§a na ciÃªncia ou na BÃ­blia?'),
  (81, 'Quem estÃ¡ qualificado para fazer discÃ­pulos?'),
  (82, 'JeovÃ¡ e Cristo fazem parte de uma trindade?'),
  (83, 'SerÃ¡ que os cristÃ£os precisam obedecer aos Dez Mandamentos?'),
  (84, 'EscaparÃ¡ do destino deste mundo?'),
  (85, 'Boas notÃ­cias num mundo violento'),
  (86, 'Como orar a Deus e ser ouvido por ele?'),
  (87, 'Qual Ã© a sua relaÃ§Ã£o com Deus?'),
  (88, 'Por que viver de acordo com os padrÃµes da BÃ­blia?'),
  (89, 'Quem tem sede da verdade, venha!'),
  (90, 'FaÃ§a o mÃ¡ximo para alcanÃ§ar a verdadeira vida!'),
  (91, 'A presenÃ§a do Messias e seu domÃ­nio'),
  (92, 'O papel da religiÃ£o nos assuntos do mundo'),
  (93, 'Desastres naturais â€” Quando vÃ£o acabar?'),
  (94, 'A religiÃ£o verdadeira atende Ã s necessidades da sociedade humana'),
  (95, 'NÃ£o seja enganado pelo ocultismo!'),
  (96, 'O que vai acontecer com as religiÃµes?'),
  (97, 'PermaneÃ§amos inculpes em meio a uma geraÃ§Ã£o pervertida'),
  (98, '"A cena deste mundo estÃ¡ mudando"'),
  (99, 'Por que podemos confiar no que a BÃ­blia diz?'),
  (100, 'Como fazer amizades fortes e verdadeiras'),
  (101, 'JeovÃ¡ Ã© o "Grandioso Criador"'),
  (102, 'Preste atenÃ§Ã£o Ã  "palavra profÃ©tica"'),
  (103, 'Como vocÃª pode ter a verdadeira alegria?'),
  (104, 'Pais, vocÃªs estÃ£o construindo com materiais Ã  prova de fogo?'),
  (105, 'Somos consolados em todas as nossas tribulaÃ§Ãµes'),
  (106, 'Arruinar a terra provocarÃ¡ retribuiÃ§Ã£o divina'),
  (107, 'VocÃª estÃ¡ treinando bem a sua consciÃªncia?'),
  (108, 'VocÃª pode encarar o futuro com confianÃ§a!'),
  (109, 'O Reino de Deus estÃ¡ prÃ³ximo'),
  (110, 'Deus vem primeiro na vida familiar bem-sucedida'),
  (111, 'Ã‰ possÃ­vel que a humanidade seja completamente curada?'),
  (112, 'Como mostrar amor num mundo egoÃ­sta'),
  (113, 'Jovens - Como vocÃªs podem ter uma vida feliz?'),
  (114, 'ApreÃ§o pelas maravilhas da criaÃ§Ã£o de Deus'),
  (115, 'NÃ£o caia nas armadilhas de SatanÃ¡s'),
  (116, 'Escolha sabiamente com quem irÃ¡ associar-se!'),
  (117, 'Como vencer o mal com o bem'),
  (118, 'Olhemos os jovens do ponto de vista de JeovÃ¡'),
  (119, 'Por que Ã© benÃ©fico que os cristÃ£os vivam separados do mundo'),
  (120, 'Por que se submeter Ã  regÃªncia de Deus agora'),
  (121, 'Uma famÃ­lia mundial que serÃ¡ salva da destruiÃ§Ã£o'),
  (122, 'Paz global â€” de onde virÃ¡?'),
  (123, 'Por que os cristÃ£os tÃªm de ser diferentes'),
  (124, 'RazÃµes para crer que a BÃ­blia Ã© de autoria divina'),
  (125, 'Por que a humanidade precisa de resgate'),
  (126, 'Quem se salvarÃ¡?'),
  (127, 'O que acontece quando morremos?'),
  (128, 'Ã‰ o inferno um lugar de tormento ardente?'),
  (129, 'O que a BÃ­blia diz sobre a Trindade?'),
  (130, 'A terra permanecerÃ¡ para sempre'),
  (131, 'Tome posiÃ§Ã£o contra o Diabo!'),
  (132, 'RessurreiÃ§Ã£o â€” A vitÃ³ria sobre a morte!'),
  (133, 'Tem importÃ¢ncia o que cremos sobre a nossa origem?'),
  (134, 'SerÃ¡ que os cristÃ£os precisam guardar o sÃ¡bado?'),
  (135, 'A santidade da vida e do sangue'),
  (136, 'SerÃ¡ que Deus aprova o uso de imagens na adoraÃ§Ã£o?'),
  (137, 'Ocorreram realmente os milagres da BÃ­blia?'),
  (138, 'Viva com bom juÃ­zo num mundo depravado'),
  (139, 'Sabedoria divina num mundo cientÃ­fico'),
  (140, 'Quem Ã© realmente Jesus Cristo?'),
  (141, 'Quando terÃ£o fim os gemidos da criaÃ§Ã£o humana?'),
  (142, 'Por que refugiar-se em JeovÃ¡'),
  (143, 'Confie no Deus de todo consolo'),
  (144, 'Uma congregaÃ§Ã£o leal sob a lideranÃ§a de Cristo'),
  (145, 'Quem Ã© semelhante a JeovÃ¡, nosso Deus?'),
  (146, 'Use a educaÃ§Ã£o para louvar a JeovÃ¡'),
  (147, 'Confie que JeovÃ¡ tem o poder para nos salvar'),
  (148, 'VocÃª tem o mesmo conceito de Deus sobre a vida?'),
  (149, 'O que significa "andar com Deus"?'),
  (150, 'Este mundo estÃ¡ condenado Ã  destruiÃ§Ã£o?'),
  (151, 'JeovÃ¡ Ã© "uma altura protetora" para seu povo'),
  (152, 'Armagedom â€” por que e quando?'),
  (153, 'Tenha bem em mente o "atemorizante dia"!'),
  (154, 'O governo humano Ã© pesado na balanÃ§a'),
  (155, 'Chegou a hora do julgamento de BabilÃ´nia?'),
  (156, 'O Dia do JuÃ­zo â€” tempo de temor ou de esperanÃ§a?'),
  (157, 'Como os verdadeiros cristÃ£os adornam o ensino divino'),
  (158, 'Seja corajoso e confie em JeovÃ¡'),
  (159, 'Como encontrar seguranÃ§a num mundo perigoso'),
  (160, 'Mantenha a identidade cristÃ£!'),
  (161, 'Por que Jesus sofreu e morreu?'),
  (162, 'Seja liberto deste mundo em escuridÃ£o'),
  (163, 'Por que temer o Deus verdadeiro?'),
  (164, 'SerÃ¡ que Deus ainda estÃ¡ no controle?'),
  (165, 'Os valores de quem vocÃª preza?'),
  (166, 'Verdadeira fÃ© â€” O que Ã© e como mostrar'),
  (167, 'Ajamos sabiamente num mundo insensato'),
  (168, 'VocÃª pode sentir-se seguro neste mundo atribulado!'),
  (169, 'Por que ser orientado pela BÃ­blia?'),
  (170, 'Quem estÃ¡ qualificado para governar a humanidade?'),
  (171, 'PoderÃ¡ viver em paz agora â€” e para sempre!'),
  (172, 'Que reputaÃ§Ã£o vocÃª tem perante Deus?'),
  (173, 'Existe uma religiÃ£o verdadeira do ponto de vista de Deus?'),
  (174, 'Quem se qualificarÃ¡ para entrar no novo mundo de Deus?'),
  (175, 'O que prova que a BÃ­blia Ã© autÃªntica?'),
  (176, 'Quando haverÃ¡ verdadeira paz e seguranÃ§a?'),
  (177, 'Onde encontrar ajuda em tempos de afliÃ§Ã£o?'),
  (178, 'Ande no caminho da integridade'),
  (179, 'Rejeite as fantasias do mundo, empenhe-se pelas realidades do reino'),
  (180, 'A RessurreiÃ§Ã£o â€” Por que essa esperanÃ§a deve ser real para vocÃª'),
  (181, 'JÃ¡ Ã© mais tarde do que vocÃª imagina?'),
  (182, 'O que o Reino de Deus estÃ¡ fazendo por nÃ³s agora?'),
  (183, 'Desvie seus olhos do que Ã© fÃºtil'),
  (184, 'A morte Ã© o fim de tudo?'),
  (185, 'SerÃ¡ que a verdade influencia sua vida?'),
  (186, 'Sirva em uniÃ£o com o povo feliz de Deus'),
  (187, 'Por que um Deus amoroso permite a maldade?'),
  (188, 'VocÃª confia em JeovÃ¡?'),
  (189, 'Ande com Deus e receba bÃªnÃ§Ã£os para sempre'),
  (190, 'Como se cumprirÃ¡ a promessa de perfeita felicidade familiar'),
  (191, 'Como o amor e a fÃ© vencem o mundo'),
  (192, 'VocÃª estÃ¡ no caminho para a vida eterna?'),
  (193, 'Os problemas de hoje logo serÃ£o coisa do passado'),
  (194, 'Como a sabedoria de Deus nos ajuda')
ON CONFLICT (outline_number) DO UPDATE SET
  title = EXCLUDED.title,
  updated_at = now();

