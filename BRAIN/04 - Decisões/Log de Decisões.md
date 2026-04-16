---
tags: [decisoes, adr]
---

# 🧩 Log de Decisões (ADR)

Decisões técnicas e de produto. Cada decisão = um bloco. Não editar decisões antigas — criar uma nova que supera.

---

## ADR-001 — Adotar BRAIN no Obsidian como fonte da verdade
- **Data:** 2026-04-15
- **Status:** Aceito
- **Contexto:** Necessidade de centralizar modificações, bugs, ideias e histórico do projeto dashrisco / Marjo Guard.
- **Decisão:** Criar vault Obsidian em `/dashrisco/BRAIN` com estrutura por áreas (Visão Geral, Tarefas, Modificações, Decisões, Diário, Referências).
- **Consequências:** Todo item novo passa por aqui antes de virar issue/PR. PDF de sugestões do cliente foi transcrito para [[03 - Modificações/Desejadas]].

---

## ADR-002 — Workflow Git: branch por dia + PR obrigatório
- **Data:** 2026-04-15
- **Status:** Aceito — **regra crítica, prioridade máxima**
- **Contexto:** Necessidade de proteger `main`, garantir revisão de todas as alterações e ter rastreabilidade diária do que foi trabalhado.
- **Decisão:**
  1. Toda modificação/melhoria/implementação acontece em branch **exclusiva do dia** com padrão `work/YYYY-MM-DD`.
  2. `main` é protegida — proibido commit/push direto.
  3. Ao final do dia (ou do bloco de trabalho), abrir PR `work/YYYY-MM-DD` → `main` e **aguardar aprovação do JBD** antes de mergear.
- **Consequências:** Fluxo detalhado em [[⚠️ REGRAS CRÍTICAS]]. Comandos em [[06 - Referências/Comandos Úteis#Git]]. Qualquer agente (humano ou IA) que trabalhar no repositório precisa seguir.

---

## Template

```
## ADR-XXX — Título
- **Data:** YYYY-MM-DD
- **Status:** Proposto / Aceito / Superado por ADR-YYY
- **Contexto:**
- **Decisão:**
- **Alternativas consideradas:**
- **Consequências:**
```
