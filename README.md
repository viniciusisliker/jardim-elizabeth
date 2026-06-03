# jardim-elizabeth

Site da congregação Jardim Elizabeth.

## Deploy automático (Vercel)

O site é publicado automaticamente na Vercel ao fazer **push na branch `main`** do repositório [viniciusisliker/jardim-elizabeth](https://github.com/viniciusisliker/jardim-elizabeth).

| Ambiente | URL | Gatilho |
|----------|-----|---------|
| **Produção** | [jardimelizabeth.vercel.app](https://jardimelizabeth.vercel.app) | Push em `main` |
| **Preview** | URL única por commit/PR | Push em outras branches ou PR |

Configuração no repositório: `vercel.json` (site estático, sem build).

### Desenvolvimento local

Na pasta do clone:

```bash
npm run dev
```

(Requer [Node.js](https://nodejs.org/) instalado. Não precisa de `npm install` — o servidor de desenvolvimento não usa dependências externas.)

Abra [http://localhost:3000](http://localhost:3000). O Supabase Auth exige servir por HTTP (não abra os HTML direto pelo Explorer).

### Fluxo

```bash
git add .
git commit -m "sua mensagem"
git push origin main
```

A Vercel detecta o push, faz o deploy e atualiza a produção em ~1 minuto.

## Hub Administrativo

Acesso via ícone de perfil no canto superior direito. Anciãos e servos ministeriais têm acesso ao [hub.html](hub.html).

## Autenticação (Supabase Auth)

Login com **usuário e senha** (não usa e-mail na tela de entrada).

Usuário e senha são fornecidos individualmente pelo administrador do sistema. Não compartilhe credenciais publicamente.

> **SuperUser** tem acesso total ao sistema. Anciãos e servos ministeriais acessam o hub administrativo. Publicadores podem fazer login, mas não acessam o hub.
