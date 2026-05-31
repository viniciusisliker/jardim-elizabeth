# jardim-elizabeth

Site da congregação Jardim Elizabeth.

## Deploy automático (Vercel)

O site é publicado automaticamente na Vercel ao fazer **push na branch `main`** do repositório [viniciusisliker/jardim-elizabeth](https://github.com/viniciusisliker/jardim-elizabeth).

| Ambiente | URL | Gatilho |
|----------|-----|---------|
| **Produção** | [jardimelizabeth.vercel.app](https://jardimelizabeth.vercel.app) | Push em `main` |
| **Preview** | URL única por commit/PR | Push em outras branches ou PR |

Configuração no repositório: `vercel.json` (site estático, sem build).

### Fluxo

```bash
git add .
git commit -m "sua mensagem"
git push origin main
```

A Vercel detecta o push, faz o deploy e atualiza a produção em ~1 minuto.

## Hub Administrativo

Acesso via ícone de perfil no canto superior direito. Anciãos e servos ministeriais têm acesso ao [hub.html](hub.html).

## Usuários (Supabase Auth)

Senha inicial para todos: `jdelizabeth123`

| Nome | Função | E-mail |
|------|--------|--------|
| Denison Oliveira | Ancião | denison.oliveira@jardimelizabeth.org |
| João Neves | Ancião | joao.neves@jardimelizabeth.org |
| Edvan Dantas | Ancião | edvan.dantas@jardimelizabeth.org |
| Marcelo Almeida | Ancião | marcelo.almeida@jardimelizabeth.org |
| Marcelo Freire | Ancião | marcelo.freire@jardimelizabeth.org |
| Arnaldo Isliker | Ancião | arnaldo.isliker@jardimelizabeth.org |
| Vinícius Isliker | SuperUser (Desenvolvedor) | vinicius.isliker@jardimelizabeth.org |
| Ademilson | Servo Ministerial | ademilson@jardimelizabeth.org |
| Alexsezar Tenório | Servo Ministerial | alexsezar.tenorio@jardimelizabeth.org |
| André Neves | Servo Ministerial | andre.neves@jardimelizabeth.org |
| Lucas Dias | Servo Ministerial | lucas.dias@jardimelizabeth.org |
| Rikael | Servo Ministerial | rikael@jardimelizabeth.org |
| Cosme Silva | Servo Ministerial | cosme.silva@jardimelizabeth.org |
| Aerton | Publicador | aerton@jardimelizabeth.org |
| Fábio Buri | Publicador | fabio.buri@jardimelizabeth.org |
| Rubens | Publicador | rubens@jardimelizabeth.org |
| Fábio Souza | Publicador | fabio.souza@jardimelizabeth.org |
| Ygor | Publicador | ygor@jardimelizabeth.org |
| Matheus | Publicador | matheus@jardimelizabeth.org |

> **SuperUser** tem acesso total ao sistema. Anciãos e servos ministeriais acessam o hub administrativo. Publicadores podem fazer login, mas não acessam o hub.
