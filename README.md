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

Login com **usuário e senha** (não usa e-mail na tela de entrada).

Senha inicial para todos: `jdelizabeth123`

| Nome | Função | Usuário |
|------|--------|---------|
| Denison Oliveira | Ancião | denison.oliveira |
| João Neves | Ancião | joao.neves |
| Edvan Dantas | Ancião | edvan.dantas |
| Marcelo Almeida | Ancião | marcelo.almeida |
| Marcelo Freire | Ancião | marcelo.freire |
| Arnaldo Isliker | Ancião | arnaldo.isliker |
| Vinícius Isliker | SuperUser (Desenvolvedor) | vinicius.isliker |
| Ademilson | Servo Ministerial | ademilson |
| Alexsezar Tenório | Servo Ministerial | alexsezar.tenorio |
| André Neves | Servo Ministerial | andre.neves |
| Lucas Dias | Servo Ministerial | lucas.dias |
| Rikael | Servo Ministerial | rikael |
| Cosme Silva | Servo Ministerial | cosme.silva |
| Aerton | Publicador | aerton |
| Fábio Buri | Publicador | fabio.buri |
| Rubens | Publicador | rubens |
| Fábio Souza | Publicador | fabio.souza |
| Ygor | Publicador | ygor |
| Matheus | Publicador | matheus |

> **SuperUser** tem acesso total ao sistema. Anciãos e servos ministeriais acessam o hub administrativo. Publicadores podem fazer login, mas não acessam o hub.
