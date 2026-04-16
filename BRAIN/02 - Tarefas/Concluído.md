---
tags: [tarefas, concluido]
---

# ✅ Concluído

Registro cronológico. Item mais recente no topo.

## 2026-04-15 — T-004 Grupos de Bloqueio (MOD-09)
- Detalhes: TOTP exigido por chamada NGX (auth_code no body). tokenManager expõe generateTotpCode(). Lock/unlock paralelo via Promise.allSettled com 1 código por operação. Fallback UNLOCK_ALL para snapshot vazio pós-restart. startSession() registra sessão manual no engine para countdown/auto-unlock. reconcileStaleState() no boot corrige estado stale. Excluir grupo com modal de confirmação e log de auditoria.
- Branch: work/2026-04-15
- Commits: 5ca30c7, 37730e5, bb90d35 — PR #4

## 2026-04-15 — T-008 Enter perdendo mensagem na observação (MOD-04)
- Detalhes: Enter (sem Shift) na textarea de observação do passo na análise agora chama confirmStep(). Shift+Enter adiciona nova linha.
- Branch: work/2026-04-15
- Commit: c659dc2

## 2026-04-15 — T-007 Checklist em formato texto (MOD-12)
- Detalhes: Botão toggle check/text antes do input de checklist. Itens texto renderizados como headers. Steps texto na análise mostram apenas "Próximo". Progresso exclui itens texto. Backward compat com string[].
- Branch: work/2026-04-15
- Commit: c659dc2

## 2026-04-15 — T-006 Múltiplos anexos em comentários (MOD-03)
- Detalhes: Paste e seleção acumulam imagens em array. Previews em grid com X individual. API aceita N arquivos 'images' e serializa como JSON array no campo imageUrl. Display no timeline backward compat.
- Branch: work/2026-04-15
- Commit: c659dc2

## 2026-04-15 — T-005 Link direto ao perfil NGX no campo user_id (MOD-02)
- Detalhes: Campo user_id nos blocos de dados do webhook agora é link clicável abrindo dashboard.marjosports.com.br/back-office/online-client/search?query=ID&field={id}. Aplicado em alerts/[id]/page.tsx e panel/tasks/[id]/analise/page.tsx.
- Branch: work/2026-04-15
- Commit: f15f413

## 2026-04-15 — T-003 Campo "Data da Aposta" sem input correto no wizard (MOD-10)
- Detalhes: Adicionado DATE_FIELDS, MONEY_FIELDS e getFieldType() em field-labels.ts. Wizard de condições agora renderiza `<input type="date">` para campos de data, input monetário para valores, e texto livre para o restante. Preview também corrigido.
- Branch: work/2026-04-15
- Commit: d540d52

## 2026-04-15 — T-002 Filtro "Data Fim" excluía tasks do mesmo dia (MOD-06)
- Detalhes: panel.ts linha 233 — endDate recebia `new Date(query.endDate)` que aponta para meia-noite UTC, excluindo tasks criadas naquele dia. Corrigido para `T23:59:59.999Z`.
- Branch: work/2026-04-15
- Commit: d540d52

## 2026-04-15 — T-001 Filtros invisíveis no dark mode (MOD-05)
- Detalhes: Adicionado `text-foreground`, `dark:bg-card/50` e `color-scheme` no componente Input. Regra global CSS para `<select>` no dark mode em globals.css.
- Branch: work/2026-04-15
- Commit: 17268ab
