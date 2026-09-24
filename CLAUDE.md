# CLAUDE.md

Site + Hub administrativo da congregação Jardim Elizabeth. Comunicação em português.

## Stack

- **Site estático, sem build.** HTML/CSS/JS puro na raiz; a Vercel publica o repo como está (`vercel.json`: `buildCommand: null`, `outputDirectory: "."`). Não introduza bundler, framework ou TypeScript.
- **Supabase** (Auth + Postgres + Storage) acessado direto do navegador via `js/config.js` / `js/auth.js`.
- **Funções serverless** só em `api/` (push notifications).
- **PWA:** `sw.js` + `site.webmanifest`.

## Rodar local

```bash
npm run dev   # http://localhost:3000 — não precisa de npm install
```

Não abra os HTML direto pelo explorador de arquivos: o Supabase Auth exige HTTP.

## Fluxo de desenvolvimento

1. **Nunca commitar direto na `main`.** Push na `main` = deploy em produção na hora.
2. Trabalhe em branch (`feat/...`, `fix/...` ou a branch `claude/...` da sessão) e abra **PR para `main`**.
3. A Vercel gera uma **URL de preview** no PR: teste ali antes de mergear.
4. O CI (`.github/workflows/smoke.yml`) precisa passar. Se criar arquivo crítico novo, considere adicioná-lo ao smoke.
5. Merge do PR → produção em ~1 min.

Commits em Conventional Commits, em português: `feat: ...`, `fix: ...`.

## Banco de dados (Supabase)

- Toda mudança de schema, RPC, policy ou dado estrutural vai em **`supabase/migrations/`** com nome `YYYYMMDDHHMMSS_descricao.sql`.
- **Não crie arquivos novos em `supabase/manual/`.** É legado de patches aplicados à mão; não dá pra saber pelo repo o que já rodou em produção.
- Migrations devem ser idempotentes quando possível (`IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT`).
- Migration não é aplicada pelo deploy da Vercel. Avise no PR quando houver migration a aplicar e se o front depende dela.

## Estrutura

- `*.html` na raiz: páginas públicas + `hub.html` (Hub administrativo).
- `admin/`: páginas administrativas avulsas.
- `hub/sections/`, `css/hub-sections/`: partes do Hub.
- `js/`: lógica compartilhada; `js/admin/`: módulos do Hub.
- `components/`: header/footer.
- `scripts/`: utilitários (vários em Python/PowerShell, pensados para rodar no Windows do mantenedor, não no CI).
