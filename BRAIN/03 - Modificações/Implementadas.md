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
- PR/commit: 5ca30c7 (branch work/2026-04-15)
- Ambiente: dev (aguarda merge para prod)
- Testado por: Eytor
- Notas: lockGroup() aborta quando nenhum membro é bloqueado com sucesso (evita evento unlocked espúrio). reconcileStaleState() no boot corrige grupos "locked" presos no DB após restart do servidor. 2FA resolvido automaticamente pelo tokenManager via sbRequest retry em 401/403.

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
