---
tags: [visao-geral, stack]
---

# Stack Técnico

## Frontend — `dashboard/`
- **Next.js** (App Router) — `next.config.ts`
- **TypeScript** — `tsconfig.json`
- **Tailwind CSS** — `postcss.config.mjs`
- **Deploy:** Netlify (`netlify.toml`)

## Backend — `api/`
- **Node.js + Express** (a confirmar)
- **TypeScript** — `tsconfig.json`
- **Uploads:** pasta local `uploads/`
- **Containerização:** Docker

## Dados
- **ClickHouse** — políticas em `access/`
  - `users.list` — usuários
  - `roles.list` — papéis
  - `row_policies.list` — políticas de linha
  - `quotas.list` — cotas
  - `masking_policies.list` — mascaramento
  - `settings_profiles.list` — perfis de configuração

## Tooling
- **Monorepo:** `concurrently` (raiz)
- **Turbo:** `turbo.json` presente
- **Git:** repositório ativo (`.git`)

## Webhook — 32 campos conhecidos

ID do Usuário, CPF, Nome, Email, Usuario Bloqueado, ID do Saque, _queryResult, Contato, Creditos, KYC Verificado, Username, Valor do Saque, Afiliado, Data de Nascimento, Cadastro do Usuário, Bloq. Apostas, Status do Saque, Chave PIX, Tipo PIX, Bloq. Deposito, Data do Saque, Bloq. Saque, ID Externo Saque, Data Verificação KYC, Bloq. Apostas Bonus, Data Confirmação Saque, Jogador Convidado, Bloq. Apostas Cassino, Bloq. Apostas Esportivas, Aceito Reg. Marketing, DDI, Aceito Notificações.
