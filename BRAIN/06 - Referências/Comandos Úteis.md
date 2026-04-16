---
tags: [referencias, cli]
---

# 🛠️ Comandos Úteis

## Ambiente local

```bash
cd /Users/Eytor/dashrisco
./start-local.sh           # script próprio
npm run dev                # api + dashboard
npm run dev:api
npm run dev:dashboard
```

## Git

> 🚨 **OBRIGATÓRIO:** ler [[⚠️ REGRAS CRÍTICAS]] antes de qualquer mudança.
> Toda modificação vive em `work/YYYY-MM-DD` e só vai pra `main` via PR aprovado.

### Começo do dia (criar branch do dia)

```bash
cd /Users/Eytor/dashrisco
git checkout main && git pull origin main
git checkout -b work/$(date +%Y-%m-%d)
git push -u origin work/$(date +%Y-%m-%d)
```

### Durante o dia

```bash
git status
git add -p                                   # stage granular
git commit -m "MOD-XX: descrição curta"
git push
```

### Fim do dia — abrir PR (NÃO mergear)

```bash
gh pr create --base main --head work/$(date +%Y-%m-%d) \
  --title "Work $(date +%Y-%m-%d)" \
  --body "Aguardando revisão do JBD antes do merge."
```

⛔ **Merge só depois de aprovação explícita do JBD.**

## Docker (api)

```bash
cd api
docker build -t jbd-alerts-api .
docker run -p 3000:3000 jbd-alerts-api
```

## ClickHouse (access policies)

Arquivos em `access/*.list` são listas aplicadas ao ClickHouse. Revisar antes de alterar produção.

## Netlify (dashboard)

Deploy automático via `netlify.toml`. Builds a partir de `dashboard/`.
