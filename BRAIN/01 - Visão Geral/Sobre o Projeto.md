---
tags: [visao-geral]
---

# Sobre o Projeto

**Nome interno:** `jbd-alerts` (package.json raiz)
**Nome comercial / cliente:** Marjo Guard
**Pasta raiz:** `/Users/Eytor/dashrisco`

## Objetivo

Plataforma de monitoramento e alertas de risco (anti-fraude / compliance) para operações de cassino e sportsbook. Gera alertas, tasks de análise e painéis de investigação a partir de webhooks e eventos de usuários.

## Módulos

- **`api/`** — Backend Node/TypeScript (Express). Recebe webhooks, processa regras, expõe endpoints para o dashboard. Possui `uploads/` e `Dockerfile`.
- **`dashboard/`** — Frontend Next.js (App Router, TypeScript, Tailwind via `postcss.config.mjs`). Deploy Netlify (`netlify.toml`).
- **`access/`** — Políticas do ClickHouse (`users.list`, `roles.list`, `row_policies.list`, `quotas.list`, `masking_policies.list`, `settings_profiles.list`).
- **`preprocessed_configs/`** — Configs preprocessadas.
- **`start-local.sh`** — Script para subir o ambiente local.

## Principais áreas do dashboard (a confirmar)

- Monitoramento
- Alertas
- Painel de Alertas
- Painel de Tasks
- Investigação → Buscar Cliente, Relatórios
- Operacional → Grupos de Bloqueio
- Administração

## Integrações

- **NGX** — dashboard externo do cliente (link direto para perfil do usuário desejado).
- **Marjo Guard** — produto do cliente; deseja área de promoções editável por Cassino/Sportsbook/CRM.
- **Webhooks** — fonte primária de eventos (32 campos conhecidos).
