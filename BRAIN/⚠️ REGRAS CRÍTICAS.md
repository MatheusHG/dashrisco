---
tags: [regras, critico, workflow, git]
prioridade: MAXIMA
fixar: true
---

# ⚠️🚨 REGRAS CRÍTICAS — PRIORIDADE MÁXIMA 🚨⚠️

> **LEIA ANTES DE QUALQUER MODIFICAÇÃO, MELHORIA OU IMPLEMENTAÇÃO.**
> **NÃO NEGOCIÁVEL. NÃO PULAR ETAPAS.**

---

## 🔴 REGRA #1 — BRANCH EXCLUSIVA POR DIA

**Toda modificação / melhoria / implementação DEVE ser feita em uma branch exclusiva do dia.**

- Nome padrão: `work/YYYY-MM-DD` (ex.: `work/2026-04-15`)
- Alternativas aceitas: `dev/YYYY-MM-DD`, `daily/YYYY-MM-DD`
- **Nunca** commitar direto na `main`.
- **Nunca** reutilizar branch de outro dia — cada dia tem a sua versão de trabalho.

### Como criar no começo do dia

```bash
cd /Users/Eytor/dashrisco
git checkout main
git pull origin main
git checkout -b work/$(date +%Y-%m-%d)
git push -u origin work/$(date +%Y-%m-%d)
```

---

## 🔴 REGRA #2 — NUNCA MERGEAR DIRETO NA MAIN

**Proibido:** `git push origin main`, `git merge` direto, deploy sem PR.

**Fluxo obrigatório:**

1. Trabalhar o dia inteiro na branch `work/YYYY-MM-DD`.
2. Commits atômicos e descritivos ao longo do dia.
3. Push da branch do dia para o remote.
4. Abrir **Pull Request** `work/YYYY-MM-DD` → `main`.
5. **PARAR AQUI** e avisar o dono do repositório (JBD).
6. Aguardar **revisão + aprovação manual** do PR.
7. Só então → merge na `main` → deploy.

### Comando para abrir PR (GitHub CLI)

```bash
gh pr create \
  --base main \
  --head work/$(date +%Y-%m-%d) \
  --title "Work $(date +%Y-%m-%d)" \
  --body "Modificações do dia. Aguardando aprovação antes do merge."
```

---

## 📋 Checklist obrigatório antes de pedir aprovação

- [ ] Branch do dia criada a partir da `main` atualizada
- [ ] Commits têm mensagens claras (referenciando MOD-XX / T-XXX quando aplicável)
- [ ] Testes locais rodaram (`npm run dev` / testes manuais)
- [ ] Nenhum arquivo sensível (`.env`, credenciais) foi commitado
- [ ] PR aberto contra `main` com descrição do que foi alterado
- [ ] [[03 - Modificações/Desejadas]] atualizado (itens MOD-XX marcados conforme status)
- [ ] [[02 - Tarefas/Em Andamento]] e [[02 - Tarefas/Concluído]] atualizados
- [ ] **Aviso enviado ao JBD para revisar o PR**
- [ ] **⛔ MERGE SÓ APÓS APROVAÇÃO EXPLÍCITA**

---

## 🚫 O que NUNCA fazer

- ❌ Commitar direto na `main`
- ❌ Fazer push forçado (`--force`) em `main`
- ❌ Mergear PR sem revisão do JBD
- ❌ Pular o PR "só porque é uma mudança pequena"
- ❌ Deixar modificações do dia numa branch de outro dia
- ❌ Subir para produção sem o PR aprovado

---

## ✅ Fluxo resumido (cola na cabeça)

```
main ──●────────────────────────●── (merge só após aprovação)
        \                      /
         └── work/2026-04-15 ──┘
              ↑
          todo trabalho
          do dia vive aqui
```

---

Referenciado em: [[00 - Home]] • [[06 - Referências/Comandos Úteis]] • [[04 - Decisões/Log de Decisões]]
