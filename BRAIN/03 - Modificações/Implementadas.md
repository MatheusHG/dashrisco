---
tags: [modificacoes, implementadas]
---

# ✅ Modificações Implementadas

Registro histórico do que já entrou em produção. Mover itens de [[Desejadas]] para cá ao concluir.

Formato sugerido por item:

```
## MOD-XX — Título — YYYY-MM-DD
- PR/commit: 
- Ambiente: dev / staging / prod
- Testado por: 
- Notas:
```

---

## MOD-09 — Grupos de Bloqueio — 2026-04-15
- PR/commit: 37730e5 + bb90d35 (branch work/2026-04-15) — PR #4
- Ambiente: dev (aguarda merge para prod)
- Testado por: Eytor
- Notas:
  - **TOTP por operação**: NGX exige `auth_code` no body do `PUT /user/{id}/edit-client`. tokenManager expõe `generateTotpCode()`. sbClient passa código pré-gerado.
  - **Processamento paralelo**: lock/unlock geram 1 código TOTP e processam todos os membros via `Promise.allSettled` — elimina risco de replay protection e reduz tempo de ~N×1.5s para ~1.5s.
  - **Fallback UNLOCK_ALL**: desbloqueio com snapshot vazio (pós-restart) busca membros do DB e usa locks zerados.
  - **startSession()**: lock manual registra sessão no engine para countdown e auto-unlock funcionarem.
  - **reconcileStaleState()**: no boot, corrige grupos presos em "locked" no DB após restart.
  - **Excluir grupo**: botão de lixeira na lista e no detalhe, modal de confirmação, log de auditoria (group.deleted + userId/userName).

## MOD-12 — Checklist em formato texto — 2026-04-15
- PR/commit: c659dc2 (branch work/2026-04-15)
- Ambiente: dev (aguarda merge para prod)
- Testado por: Eytor
- Notas: Botão toggle check/text na criação/edição de alertas. Itens texto renderizados como headers. Steps texto na análise mostram só "Próximo". Backward compat com alertas existentes.

## MOD-04 — Enter perdendo mensagem na observação — 2026-04-15
- PR/commit: c659dc2 (branch work/2026-04-15)
- Ambiente: dev (aguarda merge para prod)
- Testado por: Eytor
- Notas: Enter (sem Shift) na textarea de observação do passo confirma o step. Shift+Enter adiciona nova linha.

## MOD-03 — Múltiplos anexos em comentários — 2026-04-15
- PR/commit: c659dc2 (branch work/2026-04-15)
- Ambiente: dev (aguarda merge para prod)
- Testado por: Eytor
- Notas: Paste e seleção acumulam imagens. Previews em grid. API serializa múltiplas como JSON array. Backward compat com comentários antigos.

## MOD-02 — Link direto ao perfil NGX no campo user_id — 2026-04-15
- PR/commit: f15f413 (branch work/2026-04-15)
- Ambiente: dev (aguarda merge para prod)
- Testado por: Eytor
- Notas: user_id nos dados do webhook vira `<a>` abrindo perfil NGX em nova aba. Aplicado em alerts/[id] e painel de análise de tasks. CPF link não implementado (aguarda confirmação do cliente).

## MOD-10 — Condição "Data da Aposta" sem input correto — 2026-04-15
- PR/commit: d540d52 (branch work/2026-04-15)
- Ambiente: dev (aguarda merge para prod)
- Testado por: Eytor
- Notas: Adicionado DATE_FIELDS, MONEY_FIELDS e getFieldType() em field-labels.ts. Wizard renderiza `<input type="date">` para campos de data, input monetário para valores e texto livre para o restante.

## MOD-06 — Filtro "Data Fim" excluindo tasks do mesmo dia — 2026-04-15
- PR/commit: d540d52 (branch work/2026-04-15)
- Ambiente: dev (aguarda merge para prod)
- Testado por: Eytor
- Notas: panel.ts endDate agora usa `T23:59:59.999Z` para incluir tasks criadas no dia selecionado.

## MOD-05 — Filtros no modo noturno — 2026-04-15
- PR/commit: 17268ab (branch work/2026-04-15)
- Ambiente: dev (aguarda merge para prod)
- Testado por: Eytor
- Notas: Fix no componente Input (color-scheme, dark:bg-card/50, text-foreground) + regra global CSS para select no dark mode
