# BRAIN — dashrisco

Vault do Obsidian dedicado ao projeto **dashrisco / JBD Alerts / Marjo Guard**.

## Como abrir

1. Abra o **Obsidian**.
2. Clique em "Open folder as vault".
3. Selecione esta pasta: `/Users/Eytor/dashrisco/BRAIN`.
4. Confie no vault quando solicitado.

Comece por [[00 - Home]].

## Estrutura

```
BRAIN/
├── 00 - Home.md                    ← comece aqui
├── 01 - Visão Geral/               sobre o projeto, arquitetura, stack
├── 02 - Tarefas/                   backlog, em andamento, concluído
├── 03 - Modificações/              desejadas, implementadas, bugs, melhorias
├── 04 - Decisões/                  log de ADRs
├── 05 - Notas Diárias/             daily notes
├── 06 - Referências/               comandos, links, glossário
├── Templates/                      modelos para tarefa/modificação/daily
├── Anexos/                         imagens e PDFs anexados
└── .obsidian/                      configuração do vault
```

## Fluxo recomendado

1. Ideia ou sugestão chega → entra em `03 - Modificações/Desejadas.md` (ou `Melhorias.md`).
2. Quando priorizada → vira task em `02 - Tarefas/Backlog.md`.
3. Iniciou → move para `Em Andamento.md` (WIP limit 3).
4. Concluiu → move para `Concluído.md` e espelha em `03 - Modificações/Implementadas.md`.
5. Decisões arquiteturais → `04 - Decisões/Log de Decisões.md`.
6. Dia a dia → daily notes em `05 - Notas Diárias/`.
