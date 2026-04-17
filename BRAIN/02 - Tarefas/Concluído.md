---
tags: [tarefas, concluido]
---

# ✅ Concluído

Registro cronológico. Item mais recente no topo.

## 2026-04-17 — T-011 Cooldown nas condições do webhook (MOD-11)
- Detalhes: Campo `cooldownMinutes` no AlertConfig. Engine verifica no PanelAlert se já existe disparo recente para o mesmo alertConfig + user_id dentro do cooldown. UI no wizard (Step 6 Filtros) com input de minutos. Funciona em create e edit.
- Branch: work/2026-04-15
- Arquivos: schema.prisma, alertEngine.ts, alerts.ts, alerts/new/page.tsx, alerts/[id]/edit/page.tsx

## 2026-04-17 — Fix startDate BRT (complemento endDate fix)
- Detalhes: startDate também precisava de -03:00 BRT. Sem fix, startDate=UTC midnight = 21h BRT dia anterior, criando janela de 27h e sobreposição de 3h entre dias consecutivos (701+227≠839).
- Branch: work/2026-04-15
- Commit: cfc62ba

## 2026-04-17 — T-013 Filtro por Central de Alerta no Painel de Tasks (MOD-13)
- Detalhes: Select "Central de Alerta" adicionado na barra de filtros do Painel de Tasks. API `/panel/tasks` passou a aceitar `alertConfigId` como query param. Frontend busca `/reports/alert-configs` para popular o dropdown.
- Branch: work/2026-04-15
- Commit: ac0833e

## 2026-04-17 — Fix endDate fuso BRT (MOD-06 complemento)
- Detalhes: `panel/alerts` nunca tinha recebido a correção de endDate (usava `new Date()` = meia-noite UTC). `panel/tasks` e todos os endpoints de `reports.ts` usavam `T23:59:59.999Z` = 21h BRT, excluindo tasks criadas após 21h. Corrigido para `T23:59:59.999-03:00` (fim do dia BRT real).
- Branch: work/2026-04-15
- Commit: 4022494

## 2026-04-17 — Fix link NGX user_id em alertas e tasks (MOD-02 extensão)
- Detalhes: Campo `user_id` nos dados do webhook agora é link clicável em `panel/alerts/page.tsx` (bloco expandido) e `panel/tasks/page.tsx` (seção "Dados do webhook" no modal).
- Branch: work/2026-04-15
- Commit: cad8fef

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
