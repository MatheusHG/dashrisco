---
tags: [visao-geral, arquitetura]
---

# Arquitetura

## Monorepo

```
dashrisco/
├── api/                    # Backend Express + TS
│   ├── src/
│   ├── uploads/
│   └── Dockerfile
├── dashboard/              # Frontend Next.js
│   ├── src/
│   ├── public/
│   └── netlify.toml
├── access/                 # Políticas ClickHouse
├── preprocessed_configs/
├── start-local.sh
└── package.json            # Workspace com concurrently
```

## Execução local

```bash
npm run dev           # sobe api + dashboard em paralelo
npm run dev:api
npm run dev:dashboard
```

## Fluxo de dados (provável)

1. Webhook externo → `api/` valida e persiste evento.
2. Regras de alerta disparam baseadas em condições configuráveis (campos do webhook).
3. Alerta gera Task com checklist de verificação para o analista.
4. Dashboard Next.js consome API e renderiza painéis.
5. ClickHouse armazena dados analíticos; `access/` controla quem vê o quê via row policies.

## Banco de dados

- **ClickHouse** — inferido pela estrutura de `access/` (row_policies, quotas, masking, roles).

## Deploy

- Dashboard → Netlify
- API → Docker (Dockerfile presente)
