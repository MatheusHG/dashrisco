---
tags: [modificacoes, desejadas, cliente]
fonte: "Sugestões de melhorias e alterações - Marjo Guard.pdf"
data_recebimento: 2026-04-15
---

# 🔥 Modificações Desejadas — Marjo Guard

Sugestões diretas do cliente (PDF na raiz do projeto). Cada item é um candidato a task. Marque `[x]` quando for para [[Implementadas]] ou [[02 - Tarefas/Em Andamento]].

---

## MOD-01 — Integração com Marjo Guard: Área de Promoções
- [ ] Disponibilizar uma área para que as equipes de **cassino**, **sportsbook** e **CRM/Marketing** possam inserir novas comunicações de ofertas.
- **Tipo:** Nova feature
- **Impacto:** Alto — envolve múltiplas áreas do cliente
- **Dúvidas:** Quem gerencia permissões? Integração com Marjo Guard é via API ou iframe?

## MOD-02 — Acesso rápido ao perfil do cliente (NGX)
- [x] Em dados de Webhook, inserir link direto que abra o perfil do usuário no dashboard da NGX.
- **Status:** ✅ Implementado em 2026-04-15 — branch work/2026-04-15
- **Tipo:** Melhoria UX
- **Impacto:** Baixo/médio
- **URL base NGX (perfil do usuário):**

  ```
  https://dashboard.marjosports.com.br/back-office/online-client/search?query=ID&field=123
  ```

- **Parâmetros:**
  - `query` = tipo de busca (usar `ID`)
  - `field` = valor — preencher com **`ID do Usuário`** vindo do webhook (ex.: `6802468436249a0028d11260`)
- **Template final:**

  ```
  https://dashboard.marjosports.com.br/back-office/online-client/search?query=ID&field={{ID_DO_USUARIO}}
  ```

- **Onde aplicar:** bloco "DADOS DO WEBHOOK (32 CAPOS)" → transformar o valor do campo `ID do Usuário` em link clicável (`target="_blank"`, `rel="noopener noreferrer"`).
- **Validar:** confirmar com cliente se `query=ID` é o correto ou se há variações (ex.: `query=CPF&field={{CPF}}`) para também oferecer link por CPF.

## MOD-03 — Anexo de múltiplos arquivos em comentários
- [x] Permitir envio de **mais de um print/imagem** na mesma mensagem (atividade/comentários das tasks).
- **Status:** ✅ Implementado em 2026-04-15 — branch work/2026-04-15
- **Tipo:** Melhoria
- **Onde:** Área "ATIVIDADE" das tasks.

## MOD-04 — Correção no envio com "Enter"
- [x] Revisar envio ao pressionar Enter — mensagem é perdida em alguns casos.
- **Status:** ✅ Implementado em 2026-04-15 — branch work/2026-04-15
- **Tipo:** Bug
- **Onde:** Caixa de comentário dentro das tasks.

## MOD-05 — Filtros no modo noturno (legibilidade)
- [x] Ajustar visualização ao filtrar por data no modo noturno; opções dentro do dropdown não são visíveis.
- **Tipo:** Bug visual (CSS)
- **Prioridade:** Alta (bloqueia uso no dark mode)
- **Status:** ✅ Implementado em 2026-04-15 — branch work/2026-04-15

## MOD-06 — Filtro por responsável + data fim
- [x] Ao inserir data "Fim" no filtro, tasks não carregam. Sem data fim o filtro funciona.
- **Status:** ✅ Implementado em 2026-04-15 — branch work/2026-04-15
- **Tipo:** Bug
- **Componente:** filtro do Painel de Tasks.

## MOD-07 — Área para **Reports**
- [ ] Criar área (abaixo da aba "Painel de Tasks") com funcionamento de esteira, para **criação manual de tasks de reports**.
- [ ] Todos os agentes devem ter permissão de acesso.
- **Tipo:** Nova feature

## MOD-08 — Área de **Esteira de Demandas**
- [ ] Abaixo da área de "reports", criar área para criação manual de tasks e designação de agentes responsáveis.
- **Tipo:** Nova feature
- **Relacionado a:** [[#MOD-07 — Área para **Reports**]]

## MOD-09 — Concluir funcionamento dos **Grupos de Bloqueio**
- [x] Finalizar comportamento da tela "Grupos de Bloqueio" (há grupos com membros 0 e desbloqueio automático).
- **Status:** ✅ Implementado em 2026-04-15 — branch work/2026-04-15
- **Tipo:** Bug / feature incompleta
- **Tela:** Operacional → Grupos de Bloqueio.

## MOD-10 — Correção nas condições do webhook: campo "Data da Aposta"
- [x] Ao selecionar "Data da Aposta" nas condições, não aparecem opções esperadas (dia atual, data inicial/final, etc.).
- **Status:** ✅ Implementado em 2026-04-15 — branch work/2026-04-15
- **Tipo:** Bug
- **Tela:** Wizard de condições do webhook → aba "Filtros".

## MOD-11 — Nova condição **Cooldown** nos webhooks
- [ ] Criar filtro "Cooldown" para configurar intervalo de tempo entre disparos de um mesmo alerta.
- **Tipo:** Nova feature
- **Tela:** Condições do Webhook (ao lado de "Valor da Aposta" etc.).

## MOD-12 — Checklist de verificação com itens em **formato texto**
- [x] Em "Checklist de Verificação" (criação/edição de alertas), permitir inserir itens tipo **texto** (cabeçalho/pergunta), não apenas checkbox.
- **Status:** ✅ Implementado em 2026-04-15 — branch work/2026-04-15
- **Exemplo:**
  - "O Usuário lucrou para si desde o último depósito?" (TEXTO)
  - SIM (checklist)
  - NÃO (checklist)
- **Tipo:** Melhoria

---

## Índice rápido

| ID | Título | Tipo | Status |
|----|--------|------|--------|
| MOD-01 | Área de Promoções Marjo Guard | Feature | ⏳ |
| MOD-02 | Link direto p/ perfil NGX | UX | ✅ |
| MOD-03 | Múltiplos anexos no comentário | Melhoria | ✅ |
| MOD-04 | Enter perdendo mensagem | Bug | ✅ |
| MOD-05 | Filtros ilegíveis no dark mode | Bug | ✅ |
| MOD-06 | Filtro data Fim quebra tasks | Bug | ✅ |
| MOD-07 | Área de Reports | Feature | ⏳ |
| MOD-08 | Esteira de Demandas | Feature | ⏳ |
| MOD-09 | Grupos de Bloqueio | Bug/Feat | ✅ |
| MOD-10 | Condição "Data da Aposta" sem opções | Bug | ✅ |
| MOD-11 | Condição Cooldown | Feature | ⏳ |
| MOD-12 | Checklist em formato texto | Melhoria | ✅ |

Legenda: ⏳ pendente • 🔧 em andamento • ✅ concluído • 🚫 cancelado
