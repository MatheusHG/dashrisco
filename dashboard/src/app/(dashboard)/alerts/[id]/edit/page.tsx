"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getFieldLabel, getFieldType, formatCurrency, parseCurrency, WEBHOOK_TYPES } from "@/lib/field-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Pencil, Plus, Database, Play, Loader2, X, Bell, ListTodo, Zap, CheckCircle,
  ArrowLeft, ArrowRight, Filter, Columns, FileText, Check, Eye,
  AlertTriangle, CheckSquare, Save, Share2, Type, Clock,
} from "lucide-react";

const OPERATORS = [
  { value: "EQUAL", label: "= Igual" },
  { value: "NOT_EQUAL", label: "!= Diferente" },
  { value: "GREATER", label: "> Maior" },
  { value: "GREATER_EQUAL", label: ">= Maior ou igual" },
  { value: "LESS", label: "< Menor" },
  { value: "LESS_EQUAL", label: "<= Menor ou igual" },
];

const STEP_LABELS = [
  { label: "Info", icon: FileText },
  { label: "Destino", icon: Bell },
  { label: "Tasks", icon: ListTodo },
  { label: "Webhook", icon: Zap },
  { label: "Campos", icon: Columns },
  { label: "Filtros", icon: Filter },
  { label: "Query DB", icon: Database },
  { label: "Revisao", icon: CheckCircle },
];

interface FieldSchema { name: string; type: string; example: string; }
interface FilterItem { field: string; operator: string; value: string; logicGate: string | null; }
interface QueryCondition { field: string; operator: string; value: string; logicGate: string | null; }
interface QueryTestResult { success: boolean; rows: Record<string, unknown>[]; columns: string[]; interpolatedQuery: string; }

interface AlertConfig {
  id: string;
  name: string;
  description: string | null;
  mode: "ALERT" | "WATCH";
  webhookType: string;
  active: boolean;
  publishPanel: boolean;
  publishChat: boolean;
  chatWebhookUrl: string | null;
  externalWebhookUrl: string | null;
  createPanelTask: boolean;
  checklist: (string | { type: string; label: string })[];
  createClickupTask: boolean;
  clickupListId: string | null;
  cooldownMinutes: number | null;
  requireEarlyPayout: boolean;
  queryEnabled: boolean;
  clickhouseQuery: string | null;
  selectedFields: string[];
  filters: Array<{ field: string; operator: string; value: string; logicGate: string | null; order: number }>;
  queryConditions: Array<{ field: string; operator: string; value: string; logicGate: string | null; order: number }>;
}

const opLabel = (op: string) => {
  const m: Record<string, string> = { EQUAL: "=", NOT_EQUAL: "!=", GREATER: ">", GREATER_EQUAL: ">=", LESS: "<", LESS_EQUAL: "<=" };
  return m[op] ?? op;
};

export default function EditAlertPage() {
  const params = useParams();
  const router = useRouter();
  const alertId = params.id as string;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"ALERT" | "WATCH">("ALERT");
  const [publishPanel, setPublishPanel] = useState(false);
  const [publishChat, setPublishChat] = useState(false);
  const [externalWebhookUrl, setExternalWebhookUrl] = useState("");
  const [chatWebhookUrl, setChatWebhookUrl] = useState("");
  const [createPanelTask, setCreatePanelTask] = useState(false);
  const [createClickupTask, setCreateClickupTask] = useState(false);
  const [clickupListId, setClickupListId] = useState("");
  const [checklist, setChecklist] = useState<{ type: "check" | "text"; label: string }[]>([]);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [newCheckItemType, setNewCheckItemType] = useState<"check" | "text">("check");
  const [webhookType, setWebhookType] = useState("");
  const [availableFields, setAvailableFields] = useState<FieldSchema[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterItem[]>([]);
  const [cooldownMinutes, setCooldownMinutes] = useState<number | null>(null);
  const [requireEarlyPayout, setRequireEarlyPayout] = useState(false);
  const [queryEnabled, setQueryEnabled] = useState(false);
  const [clickhouseQuery, setClickhouseQuery] = useState("");
  const [queryConditions, setQueryConditions] = useState<QueryCondition[]>([]);
  const [queryTestResult, setQueryTestResult] = useState<QueryTestResult | null>(null);
  const [queryTestLoading, setQueryTestLoading] = useState(false);
  const [queryTestError, setQueryTestError] = useState("");
  const [queryTestVars, setQueryTestVars] = useState<Record<string, string>>({});

  const fetchAlert = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.fetch<AlertConfig>(`/alerts/${alertId}`);
      setName(data.name);
      setDescription(data.description || "");
      setMode(data.mode || "ALERT");
      setWebhookType(data.webhookType);
      setPublishPanel(data.publishPanel);
      setPublishChat(data.publishChat);
      setChatWebhookUrl(data.chatWebhookUrl || "");
      setExternalWebhookUrl(data.externalWebhookUrl || "");
      setChecklist(((data.checklist as (string | { type: string; label: string })[]) || []).map((item) =>
        typeof item === "string" ? { type: "check" as const, label: item } : { type: (item.type === "text" ? "text" : "check") as "check" | "text", label: item.label }
      ));
      setCreatePanelTask(data.createPanelTask);
      setCreateClickupTask(data.createClickupTask);
      setClickupListId(data.clickupListId || "");
      setSelectedFields(data.selectedFields || []);
      setFilters((data.filters || []).map((f) => ({ field: f.field, operator: f.operator, value: f.value, logicGate: f.logicGate })));
      setCooldownMinutes(data.cooldownMinutes ?? null);
      setRequireEarlyPayout(Boolean(data.requireEarlyPayout));
      setQueryEnabled(Boolean(data.queryEnabled));
      setClickhouseQuery(data.clickhouseQuery || "");
      setQueryConditions((data.queryConditions || []).map((c) => ({ field: c.field, operator: c.operator, value: c.value, logicGate: c.logicGate })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar alerta");
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  useEffect(() => {
    fetchAlert();
  }, [fetchAlert]);

  useEffect(() => {
    if (webhookType) {
      api.fetch<{ fields: FieldSchema[] }>(`/webhooks/schemas/${webhookType}`)
        .then((data) => setAvailableFields(data.fields))
        .catch(console.error);
    }
  }, [webhookType]);

  const queryVars = Array.from(new Set((clickhouseQuery.match(/\{\{(\w+)\}\}/g) || []).map((m) => m.slice(2, -2))));
  const allVarsFilled = queryVars.every((v) => queryTestVars[v]?.trim());

  const testQuery = async () => {
    if (!clickhouseQuery.trim() || !allVarsFilled) return;
    setQueryTestLoading(true);
    setQueryTestError("");
    setQueryTestResult(null);
    try {
      const result = await api.fetch<QueryTestResult>("/alerts/test-query", {
        method: "POST",
        body: JSON.stringify({ query: clickhouseQuery, sampleData: queryTestVars }),
      });
      setQueryTestResult(result);
    } catch (err: any) {
      setQueryTestError(err.message || "Erro ao executar query");
    } finally {
      setQueryTestLoading(false);
    }
  };

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      await api.fetch(`/alerts/${alertId}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          description: description || undefined,
          mode,
          webhookType,
          publishPanel,
          publishChat,
          chatWebhookUrl: publishChat ? chatWebhookUrl : null,
          externalWebhookUrl: externalWebhookUrl.trim() || null,
          createPanelTask,
          createClickupTask,
          clickupListId: createClickupTask ? clickupListId : null,
          checklist: createPanelTask ? checklist : [],
          selectedFields,
          filters: filters.map((f, i) => ({
            field: f.field,
            operator: f.operator,
            value: f.value,
            logicGate: i < filters.length - 1 ? f.logicGate || "AND" : null,
            order: i,
          })),
          cooldownMinutes: cooldownMinutes && cooldownMinutes > 0 ? cooldownMinutes : null,
          requireEarlyPayout: (webhookType === "SPORT_BET" || webhookType === "SPORT_PRIZE") ? requireEarlyPayout : false,
          queryEnabled,
          clickhouseQuery: queryEnabled ? clickhouseQuery : null,
          queryConditions: queryEnabled
            ? queryConditions.map((c, i) => ({
                field: c.field,
                operator: c.operator,
                value: c.value,
                logicGate: i < queryConditions.length - 1 ? c.logicGate || "AND" : null,
                order: i,
              }))
            : [],
        }),
      });
      router.push(`/alerts/${alertId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const canNext = (s: number) => {
    if (s === 1) return !!name;
    if (s === 2) {
      if (!(publishPanel || publishChat)) return false;
      if (externalWebhookUrl.trim() && !/^https?:\/\/.+/.test(externalWebhookUrl.trim())) return false;
      return true;
    }
    if (s === 4) return !!webhookType;
    if (s === 5) return selectedFields.length > 0;
    return true;
  };

  const Nav = ({ back, next, nextLabel, nextDisabled }: { back?: number; next?: number | (() => void); nextLabel?: string; nextDisabled?: boolean }) => (
    <div className="flex items-center gap-3 pt-2">
      {back && (
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => setStep(back)}>
          <ArrowLeft className="h-3.5 w-3.5" />Voltar
        </Button>
      )}
      {next && (
        <Button size="sm" className="gap-1.5 rounded-xl" disabled={nextDisabled} onClick={() => typeof next === "function" ? next() : setStep(next)}>
          {nextLabel ?? "Proximo"}<ArrowRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="flex gap-8">
      <div className="flex-1 max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/alerts/${alertId}`)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-card text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Editar Alerta</h1>
            <p className="text-sm text-muted-foreground">Passo {step} de 8</p>
          </div>
        </div>

        <div className="flex gap-1">
          {STEP_LABELS.map((s, i) => {
            const num = i + 1;
            const Icon = s.icon;
            const active = num === step;
            const done = num < step;
            return (
              <button
                key={num}
                onClick={() => setStep(num)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-medium transition-all ${
                  active ? "bg-primary text-primary-foreground" : done ? "bg-primary/15 text-primary cursor-pointer" : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>

        {step === 1 && (
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 text-foreground"><FileText className="h-5 w-5 text-blue-500" /><h2 className="text-lg font-semibold">Informacoes Basicas</h2></div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Nome do Alerta</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Aposta alta sem deposito" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Descricao (opcional)</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o objetivo deste alerta" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Modo do Alerta</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setMode("ALERT")} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${mode === "ALERT" ? "border-red-500 bg-red-500/10 ring-1 ring-red-500/30" : "border-border/50 hover:bg-muted/50"}`}>
                    <AlertTriangle className={`h-5 w-5 ${mode === "ALERT" ? "text-red-500" : "text-muted-foreground"}`} />
                    <div>
                      <p className={`text-sm ${mode === "ALERT" ? "font-semibold text-foreground" : "text-foreground"}`}>Alerta</p>
                      <p className="text-[11px] text-muted-foreground">Notifica, toca som, envia pro chat</p>
                    </div>
                  </button>
                  <button onClick={() => setMode("WATCH")} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${mode === "WATCH" ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30" : "border-border/50 hover:bg-muted/50"}`}>
                    <Eye className={`h-5 w-5 ${mode === "WATCH" ? "text-blue-500" : "text-muted-foreground"}`} />
                    <div>
                      <p className={`text-sm ${mode === "WATCH" ? "font-semibold text-foreground" : "text-foreground"}`}>Acompanhamento</p>
                      <p className="text-[11px] text-muted-foreground">Apenas registra, sem notificar</p>
                    </div>
                  </button>
                </div>
              </div>
              <Nav next={2} nextDisabled={!canNext(1)} />
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 text-foreground"><Bell className="h-5 w-5 text-amber-500" /><h2 className="text-lg font-semibold">Onde publicar?</h2></div>
              {[
                { checked: publishPanel, set: setPublishPanel, title: "Painel da Dashboard", desc: "Exibir no sino de notificacoes e no painel de alertas" },
                { checked: publishChat, set: setPublishChat, title: "Google Chat", desc: "Enviar para um webhook do Google Chat" },
              ].map((opt) => (
                <label key={opt.title} className={`flex items-center gap-3 cursor-pointer rounded-xl border p-4 transition-all ${opt.checked ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/50"}`}>
                  <input type="checkbox" checked={opt.checked} onChange={(e) => opt.set(e.target.checked)} className="h-4 w-4 accent-primary rounded" />
                  <div><p className="text-sm font-medium">{opt.title}</p><p className="text-xs text-muted-foreground">{opt.desc}</p></div>
                </label>
              ))}
              {publishChat && (
                <div className="space-y-2 pl-2 border-l-2 border-primary/30 ml-2">
                  <Label className="text-xs text-muted-foreground">URL do Webhook</Label>
                  <Input value={chatWebhookUrl} onChange={(e) => setChatWebhookUrl(e.target.value)} placeholder="https://chat.googleapis.com/v1/spaces/..." className="h-10 rounded-xl text-sm" />
                </div>
              )}

              <div className="space-y-3 pt-3 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-cyan-500" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Compartilhar via Webhook (opcional)</p>
                    <p className="text-xs text-muted-foreground">Dispara um POST com os dados do alerta para uma URL externa</p>
                  </div>
                </div>
                <Input value={externalWebhookUrl} onChange={(e) => setExternalWebhookUrl(e.target.value)} placeholder="https://exemplo.com/webhook" className="h-10 rounded-xl text-sm" />
                {externalWebhookUrl.trim() && !/^https?:\/\/.+/.test(externalWebhookUrl.trim()) && (
                  <p className="text-xs text-destructive">URL invalida. Deve comecar com http:// ou https://</p>
                )}
              </div>
              <Nav back={1} next={3} nextDisabled={!canNext(2)} />
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 text-foreground"><ListTodo className="h-5 w-5 text-violet-500" /><h2 className="text-lg font-semibold">Criar tasks automaticamente?</h2></div>
              {[
                { checked: createPanelTask, set: setCreatePanelTask, title: "Task no Painel", desc: "Cria uma task no kanban da dashboard" },
                { checked: createClickupTask, set: setCreateClickupTask, title: "Task no ClickUp", desc: "Cria automaticamente no ClickUp" },
              ].map((opt) => (
                <label key={opt.title} className={`flex items-center gap-3 cursor-pointer rounded-xl border p-4 transition-all ${opt.checked ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/50"}`}>
                  <input type="checkbox" checked={opt.checked} onChange={(e) => opt.set(e.target.checked)} className="h-4 w-4 accent-primary rounded" />
                  <div><p className="text-sm font-medium">{opt.title}</p><p className="text-xs text-muted-foreground">{opt.desc}</p></div>
                </label>
              ))}
              {createClickupTask && (
                <div className="space-y-2 pl-2 border-l-2 border-primary/30 ml-2">
                  <Label className="text-xs text-muted-foreground">ID da Lista do ClickUp</Label>
                  <Input value={clickupListId} onChange={(e) => setClickupListId(e.target.value)} placeholder="ID da lista" className="h-10 rounded-xl text-sm" />
                </div>
              )}

              {createPanelTask && (
                <div className="space-y-3 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-violet-500" />
                    <p className="text-sm font-semibold text-foreground">Checklist de Verificacao</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Defina os itens que o analista deve verificar ao analisar a task. A task sera concluida automaticamente quando todos forem marcados.</p>

                  {checklist.map((item, i) => (
                    <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${item.type === "text" ? "bg-violet-500/10 border border-violet-500/20" : "bg-muted/30"}`}>
                      {item.type === "text" ? <Type className="h-3.5 w-3.5 text-violet-500 shrink-0" /> : <CheckSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span className={`text-sm flex-1 ${item.type === "text" ? "font-medium text-violet-700 dark:text-violet-300" : ""}`}>{item.label}</span>
                      <button onClick={() => setChecklist(checklist.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      title={newCheckItemType === "check" ? "Checkbox — clique para mudar para Texto" : "Texto — clique para mudar para Checkbox"}
                      onClick={() => setNewCheckItemType(t => t === "check" ? "text" : "check")}
                      className={`h-9 w-9 shrink-0 rounded-xl border flex items-center justify-center transition-colors ${newCheckItemType === "text" ? "border-violet-500 bg-violet-500/10 text-violet-600" : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"}`}
                    >
                      {newCheckItemType === "text" ? <Type className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
                    </button>
                    <Input value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)} placeholder={newCheckItemType === "text" ? "Ex: O usuario lucrou desde o ultimo deposito?" : "Ex: Verificar FTD do usuario"} className="h-9 rounded-xl text-sm flex-1" onKeyDown={(e) => {
                      if (e.key === "Enter" && newCheckItem.trim()) {
                        e.preventDefault();
                        setChecklist([...checklist, { type: newCheckItemType, label: newCheckItem.trim() }]);
                        setNewCheckItem("");
                      }
                    }} />
                    <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1 shrink-0" disabled={!newCheckItem.trim()} onClick={() => { setChecklist([...checklist, { type: newCheckItemType, label: newCheckItem.trim() }]); setNewCheckItem(""); }}>
                      <Plus className="h-3.5 w-3.5" /> Adicionar
                    </Button>
                  </div>
                </div>
              )}
              <Nav back={2} next={4} />
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 text-foreground"><Zap className="h-5 w-5 text-emerald-500" /><h2 className="text-lg font-semibold">Tipo de Evento</h2></div>
              <p className="text-sm text-muted-foreground">Qual tipo de webhook deve disparar este alerta?</p>
              <div className="grid grid-cols-2 gap-2">
                {WEBHOOK_TYPES.map((t) => (
                  <button key={t.value} onClick={() => setWebhookType(t.value)} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${webhookType === t.value ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border/50 hover:bg-muted/50"}`}>
                    <span className="text-xl">{t.icon}</span>
                    <span className={`text-sm ${webhookType === t.value ? "font-semibold text-foreground" : "text-foreground"}`}>{t.label}</span>
                  </button>
                ))}
              </div>
              <Nav back={3} next={5} nextDisabled={!canNext(4)} />
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 text-foreground"><Columns className="h-5 w-5 text-cyan-500" /><h2 className="text-lg font-semibold">Campos do Webhook</h2></div>
              <p className="text-sm text-muted-foreground">Selecione os campos para usar nos filtros e na mensagem. <button className="text-primary hover:underline" onClick={() => setSelectedFields(availableFields.map((f) => f.name))}>Selecionar todos</button></p>
              <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                {availableFields.map((field) => (
                  <label key={field.name} className={`flex items-center gap-2 rounded-xl border p-3 text-sm cursor-pointer transition-all ${selectedFields.includes(field.name) ? "border-primary bg-primary/10" : "border-border/50 hover:bg-muted/50"}`}>
                    <input type="checkbox" checked={selectedFields.includes(field.name)} onChange={() => setSelectedFields((p) => p.includes(field.name) ? p.filter((f) => f !== field.name) : [...p, field.name])} className="h-3.5 w-3.5 accent-primary" />
                    <div><p className="font-medium text-xs">{getFieldLabel(field.name)}</p><p className="text-[10px] text-muted-foreground">{field.name} — {field.example}</p></div>
                  </label>
                ))}
              </div>
              <Nav back={4} next={6} nextDisabled={!canNext(5)} />
            </CardContent>
          </Card>
        )}

        {step === 6 && (
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 text-foreground"><Filter className="h-5 w-5 text-orange-500" /><h2 className="text-lg font-semibold">Condicoes do Webhook</h2></div>
              <p className="text-sm text-muted-foreground">Filtre os dados do webhook antes de disparar. Sem filtros, todos os eventos passam.</p>

              {filters.map((filter, i) => (
                <div key={i} className="space-y-2">
                  {i > 0 && (
                    <div className="flex justify-center">
                      <select className="rounded-lg border border-border/60 bg-transparent px-3 py-1 text-xs font-semibold" value={filters[i - 1]?.logicGate || "AND"} onChange={(e) => { const u = [...filters]; u[i - 1] = { ...u[i - 1]!, logicGate: e.target.value }; setFilters(u); }}>
                        <option value="AND">E (AND)</option><option value="OR">OU (OR)</option>
                      </select>
                    </div>
                  )}
                  <div className="flex gap-2 items-center">
                    <select className="flex-1 h-9 rounded-xl border border-border/60 bg-transparent px-3 text-sm" value={filter.field} onChange={(e) => { const u = [...filters]; u[i] = { ...u[i]!, field: e.target.value }; setFilters(u); }}>
                      {selectedFields.map((f) => <option key={f} value={f}>{getFieldLabel(f)}</option>)}
                    </select>
                    <select className="h-9 rounded-xl border border-border/60 bg-transparent px-3 text-sm" value={filter.operator} onChange={(e) => { const u = [...filters]; u[i] = { ...u[i]!, operator: e.target.value }; setFilters(u); }}>
                      {OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                    {getFieldType(filter.field) === "date" ? (
                      <Input type="date" value={filter.value || ""} onChange={(e) => { const u = [...filters]; u[i] = { ...u[i]!, value: e.target.value }; setFilters(u); }} className="flex-1 h-9 rounded-xl" />
                    ) : getFieldType(filter.field) === "money" ? (
                      <Input placeholder="0,00" value={filter.value ? formatCurrency(String(Math.round(Number(filter.value) * 100))) : ""} onChange={(e) => { const u = [...filters]; u[i] = { ...u[i]!, value: parseCurrency(e.target.value) }; setFilters(u); }} className="flex-1 h-9 rounded-xl" />
                    ) : (
                      <Input placeholder="Valor" value={filter.value || ""} onChange={(e) => { const u = [...filters]; u[i] = { ...u[i]!, value: e.target.value }; setFilters(u); }} className="flex-1 h-9 rounded-xl" />
                    )}
                    <button onClick={() => setFilters(filters.filter((_, j) => j !== i))} className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10"><X className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}

              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setFilters([...filters, { field: selectedFields[0] || "", operator: "EQUAL", value: "", logicGate: null }])}>
                <Plus className="h-3.5 w-3.5" /> Adicionar Condicao
              </Button>

              {filters.length > 0 && (
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Preview</p>
                  <p className="text-sm font-mono text-foreground">{filters.map((f, i) => `${getFieldLabel(f.field)} ${opLabel(f.operator)} ${f.value ? (getFieldType(f.field) === "money" ? formatCurrency(String(Math.round(Number(f.value) * 100))) : f.value) : "?"}${i < filters.length - 1 ? ` ${f.logicGate || "AND"} ` : ""}`).join("")}</p>
                </div>
              )}

              {(webhookType === "SPORT_BET" || webhookType === "SPORT_PRIZE") && (
                <label className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all ${requireEarlyPayout ? "border-primary bg-primary/10" : "border-border/50 hover:bg-muted/50"}`}>
                  <input type="checkbox" checked={requireEarlyPayout} onChange={(e) => setRequireEarlyPayout(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Pagamento Antecipado</p>
                    <p className="text-[11px] text-muted-foreground">Só dispara se a aposta tiver algum evento com odds_type em HOME_EP, AWAY_EP ou DRAW_EP.</p>
                  </div>
                </label>
              )}

              {/* Cooldown */}
              <div className="rounded-xl border border-border/50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-foreground">Cooldown</h3>
                </div>
                <p className="text-xs text-muted-foreground">Intervalo minimo entre disparos deste alerta para o mesmo usuario. Deixe vazio para desativar.</p>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} placeholder="Ex: 30" value={cooldownMinutes ?? ""} onChange={(e) => setCooldownMinutes(e.target.value ? Number(e.target.value) : null)} className="w-32 h-9 rounded-xl" />
                  <span className="text-sm text-muted-foreground">minutos</span>
                </div>
              </div>

              <Nav back={5} next={7} />
            </CardContent>
          </Card>
        )}

        {step === 7 && (
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 text-foreground"><Database className="h-5 w-5 text-violet-500" /><h2 className="text-lg font-semibold">Consulta no Banco (Opcional)</h2></div>
              <p className="text-sm text-muted-foreground">Execute uma query SQL no ClickHouse como verificacao adicional. Use <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-primary">{"{{campo}}"}</code> para dados do webhook.</p>

              <label className={`flex items-center gap-3 cursor-pointer rounded-xl border p-4 transition-all ${queryEnabled ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/50"}`}>
                <input type="checkbox" checked={queryEnabled} onChange={(e) => setQueryEnabled(e.target.checked)} className="h-4 w-4 accent-primary" />
                <div><p className="text-sm font-medium">Habilitar consulta ClickHouse</p><p className="text-xs text-muted-foreground">Verifica dados no banco antes de disparar o alerta</p></div>
              </label>

              {queryEnabled && (
                <div className="space-y-5 pt-2">
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Variaveis disponiveis (clique para inserir)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableFields.map((f) => (
                        <button key={f.name} type="button" onClick={() => setClickhouseQuery((q) => q + `{{${f.name}}}`)} className="text-[11px] font-mono bg-violet-500/10 text-violet-600 dark:text-violet-400 px-2 py-1 rounded-lg hover:bg-violet-500/20 transition-colors border border-violet-500/20">
                          {`{{${f.name}}}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Query SQL</p>
                    <textarea value={clickhouseQuery} onChange={(e) => setClickhouseQuery(e.target.value)} rows={7} placeholder={"SELECT count() AS deposit_count\nFROM majorsports.transfers\nWHERE user = '{{user_id}}'\n  AND type = 'DEPOSIT'\n  AND status = 'PAID'"} className="w-full rounded-xl border border-border/60 bg-zinc-950/5 dark:bg-zinc-950/50 px-4 py-3 text-sm font-mono resize-y min-h-[140px] focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none leading-relaxed" />
                  </div>

                  {queryVars.length > 0 && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                      <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5" /> Valores para teste
                      </p>
                      <p className="text-xs text-muted-foreground">Preencha com dados reais para testar a query.</p>
                      <div className="grid grid-cols-2 gap-3">
                        {queryVars.map((v) => (
                          <div key={v} className="space-y-1">
                            <Label className="text-[11px] font-mono text-amber-600 dark:text-amber-400">{`{{${v}}}`}</Label>
                            <Input placeholder={`Ex: valor de ${v}`} value={queryTestVars[v] ?? ""} onChange={(e) => setQueryTestVars((p) => ({ ...p, [v]: e.target.value }))} className="h-9 text-xs font-mono rounded-lg" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Button type="button" size="sm" className="gap-1.5 rounded-xl" onClick={testQuery} disabled={queryTestLoading || !clickhouseQuery.trim() || (queryVars.length > 0 && !allVarsFilled)}>
                      {queryTestLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      Executar Teste
                    </Button>
                    {queryVars.length > 0 && !allVarsFilled && <p className="text-xs text-amber-500">Preencha os valores acima</p>}
                  </div>

                  {queryTestError && <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{queryTestError}</div>}

                  {queryTestResult?.success && (
                    <div className="space-y-4">
                      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Sucesso - {queryTestResult.rows.length} linha(s) retornada(s)</p>
                      </div>

                      {queryTestResult.rows.length > 0 && (
                        <div className="rounded-xl border border-border/50 overflow-hidden">
                          <table className="w-full text-xs">
                            <thead><tr className="bg-muted/50 border-b">{queryTestResult.columns.map((col) => <th key={col} className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">{col}</th>)}</tr></thead>
                            <tbody>{queryTestResult.rows.map((row, i) => <tr key={i} className="border-b last:border-0">{queryTestResult.columns.map((col) => <td key={col} className="px-4 py-2.5 font-mono font-medium">{String((row as Record<string, unknown>)[col] ?? "")}</td>)}</tr>)}</tbody>
                          </table>
                        </div>
                      )}

                      <div className="space-y-3 pt-1">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Condicoes sobre o resultado</p>
                        <p className="text-xs text-muted-foreground">Quando o resultado deve disparar o alerta?</p>

                        {queryConditions.map((cond, i) => (
                          <div key={i} className="space-y-2">
                            {i > 0 && <div className="flex justify-center"><select className="rounded-lg border border-border/60 bg-transparent px-3 py-1 text-xs font-semibold" value={queryConditions[i - 1]?.logicGate || "AND"} onChange={(e) => { const u = [...queryConditions]; u[i - 1] = { ...u[i - 1]!, logicGate: e.target.value }; setQueryConditions(u); }}><option value="AND">E (AND)</option><option value="OR">OU (OR)</option></select></div>}
                            <div className="flex gap-2 items-center">
                              <select className="flex-1 h-9 rounded-xl border border-border/60 bg-transparent px-3 text-sm" value={cond.field} onChange={(e) => { const u = [...queryConditions]; u[i] = { ...u[i]!, field: e.target.value }; setQueryConditions(u); }}>
                                {queryTestResult.columns.map((col) => <option key={col} value={col}>{col}</option>)}
                              </select>
                              <select className="h-9 rounded-xl border border-border/60 bg-transparent px-3 text-sm" value={cond.operator} onChange={(e) => { const u = [...queryConditions]; u[i] = { ...u[i]!, operator: e.target.value }; setQueryConditions(u); }}>
                                {OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                              </select>
                              <Input placeholder="0,00" value={cond.value ? formatCurrency(String(Math.round(Number(cond.value) * 100))) : ""} onChange={(e) => { const u = [...queryConditions]; u[i] = { ...u[i]!, value: parseCurrency(e.target.value) }; setQueryConditions(u); }} className="flex-1 h-9 rounded-xl" />
                              <button onClick={() => setQueryConditions(queryConditions.filter((_, j) => j !== i))} className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10"><X className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        ))}

                        <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setQueryConditions([...queryConditions, { field: queryTestResult.columns[0] ?? "", operator: "EQUAL", value: "", logicGate: null }])}>
                          <Plus className="h-3.5 w-3.5" /> Adicionar Condicao
                        </Button>

                        {queryConditions.length > 0 && (
                          <div className="rounded-xl bg-muted/50 p-3">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Preview</p>
                            <p className="text-sm font-mono">{queryConditions.map((c, i) => `${c.field} ${opLabel(c.operator)} ${c.value || "?"}${i < queryConditions.length - 1 ? ` ${c.logicGate || "AND"} ` : ""}`).join("")}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <Nav back={6} next={8} nextLabel="Revisar" nextDisabled={queryEnabled && !queryTestResult?.success} />
            </CardContent>
          </Card>
        )}

        {step === 8 && (
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 text-foreground"><CheckCircle className="h-5 w-5 text-emerald-500" /><h2 className="text-lg font-semibold">Revisao Final</h2></div>

              <div className="space-y-4">
                {[
                  { label: "Nome", value: name, sub: description },
                  { label: "Modo", value: mode === "ALERT" ? "Alerta" : "Acompanhamento" },
                  { label: "Webhook", value: WEBHOOK_TYPES.find((t) => t.value === webhookType)?.label },
                ].map((r) => (
                  <div key={r.label} className="flex items-start justify-between rounded-xl bg-muted/30 p-3">
                    <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.label}</p><p className="text-sm font-medium mt-0.5">{r.value}</p>{r.sub && <p className="text-xs text-muted-foreground">{r.sub}</p>}</div>
                  </div>
                ))}

                <div className="flex gap-2">
                  {publishPanel && <Badge variant="secondary" className="rounded-lg">Painel</Badge>}
                  {publishChat && <Badge variant="secondary" className="rounded-lg">Google Chat</Badge>}
                  {externalWebhookUrl.trim() && <Badge variant="secondary" className="rounded-lg">Webhook Externo</Badge>}
                  {createPanelTask && <Badge variant="secondary" className="rounded-lg">Task Painel</Badge>}
                  {createClickupTask && <Badge variant="secondary" className="rounded-lg">Task ClickUp</Badge>}
                </div>

                {filters.length > 0 && (
                  <div className="rounded-xl bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Filtros Webhook</p>
                    <p className="text-sm font-mono">{filters.map((f, i) => `${getFieldLabel(f.field)} ${opLabel(f.operator)} ${f.value ? formatCurrency(String(Math.round(Number(f.value) * 100))) : "?"}${i < filters.length - 1 ? ` ${f.logicGate || "AND"} ` : ""}`).join("")}</p>
                  </div>
                )}

                {queryEnabled && (
                  <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-3 space-y-2">
                    <div className="flex items-center gap-1.5"><Database className="h-3.5 w-3.5 text-violet-500" /><p className="text-[10px] uppercase tracking-wider text-violet-600 dark:text-violet-400 font-semibold">Consulta ClickHouse</p></div>
                    <pre className="text-xs font-mono bg-muted/50 rounded-lg p-2 overflow-auto max-h-20">{clickhouseQuery}</pre>
                    {queryConditions.length > 0 && <p className="text-xs font-mono text-muted-foreground">Condicoes: {queryConditions.map((c, i) => `${c.field} ${opLabel(c.operator)} ${c.value}${i < queryConditions.length - 1 ? ` ${c.logicGate || "AND"} ` : ""}`).join("")}</p>}
                  </div>
                )}

                {checklist.length > 0 && (
                  <div className="rounded-xl bg-muted/30 p-3 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><CheckSquare className="h-3 w-3" />Checklist ({checklist.length} itens)</p>
                    {checklist.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        {item.type === "text" ? <Type className="h-3 w-3 text-violet-500" /> : <CheckSquare className="h-3 w-3 text-muted-foreground" />}
                        {item.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{error}</div>}

              <div className="flex items-center gap-3 pt-2">
                <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => setStep(7)}><ArrowLeft className="h-3.5 w-3.5" />Voltar</Button>
                <Button size="sm" className="gap-1.5 rounded-xl" onClick={handleSave} disabled={saving}>
                  {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvando...</> : <><Save className="h-3.5 w-3.5" />Salvar Alteracoes</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="w-72 shrink-0 hidden lg:block">
        <div className="sticky top-8 space-y-3">
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-5 space-y-3 text-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo</p>

              {[
                { label: "Nome", value: name || "—", step: 1 },
                { label: "Modo", value: mode === "ALERT" ? "Alerta" : "Acompanhamento", step: 1 },
                { label: "Webhook", value: WEBHOOK_TYPES.find((t) => t.value === webhookType)?.label || "—", step: 4 },
              ].map((r) => (
                <div key={r.label} className="flex items-start justify-between group cursor-pointer rounded-lg p-2 -mx-2 hover:bg-muted" onClick={() => setStep(r.step)}>
                  <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.label}</p><p className="text-xs font-medium mt-0.5">{r.value}</p></div>
                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 mt-1" />
                </div>
              ))}

              <div className="border-t border-border" />

              <div className="flex items-start justify-between group cursor-pointer rounded-lg p-2 -mx-2 hover:bg-muted" onClick={() => setStep(2)}>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Destino</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {publishPanel && <Badge variant="secondary" className="text-[10px]">Painel</Badge>}
                    {publishChat && <Badge variant="secondary" className="text-[10px]">Chat</Badge>}
                    {externalWebhookUrl.trim() && <Badge variant="secondary" className="text-[10px]">Webhook</Badge>}
                    {!publishPanel && !publishChat && !externalWebhookUrl.trim() && <span className="text-muted-foreground italic text-xs">—</span>}
                  </div>
                </div>
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 mt-1" />
              </div>

              <div className="flex items-start justify-between group cursor-pointer rounded-lg p-2 -mx-2 hover:bg-muted" onClick={() => setStep(5)}>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Campos ({selectedFields.length})</p>
                  {selectedFields.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedFields.slice(0, 3).map((f) => <Badge key={f} variant="outline" className="text-[9px]">{getFieldLabel(f)}</Badge>)}
                      {selectedFields.length > 3 && <Badge variant="outline" className="text-[9px]">+{selectedFields.length - 3}</Badge>}
                    </div>
                  ) : <span className="text-muted-foreground italic text-xs">—</span>}
                </div>
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 mt-1" />
              </div>

              <div className="flex items-start justify-between group cursor-pointer rounded-lg p-2 -mx-2 hover:bg-muted" onClick={() => setStep(6)}>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Filtros ({filters.length})</p>
                  {filters.length > 0 ? (
                    <p className="text-[10px] font-mono text-muted-foreground mt-1">{filters.map((f, i) => `${getFieldLabel(f.field)} ${opLabel(f.operator)} ${f.value ? formatCurrency(String(Math.round(Number(f.value) * 100))) : "?"}${i < filters.length - 1 ? ` ${f.logicGate || "AND"} ` : ""}`).join("")}</p>
                  ) : <span className="text-muted-foreground italic text-xs">Nenhum</span>}
                </div>
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 mt-1" />
              </div>

              {queryEnabled && (
                <div className="flex items-start justify-between group cursor-pointer rounded-lg p-2 -mx-2 hover:bg-muted" onClick={() => setStep(7)}>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Query DB</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{queryConditions.length > 0 ? `${queryConditions.length} condicao(oes)` : "Sem condicoes"}</p>
                  </div>
                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 mt-1" />
                </div>
              )}

              {checklist.length > 0 && (
                <>
                  <div className="border-t border-border" />
                  <div className="flex items-start justify-between group cursor-pointer rounded-lg p-2 -mx-2 hover:bg-muted" onClick={() => setStep(3)}>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Checklist ({checklist.length})</p>
                      <div className="space-y-1 mt-1">
                        {checklist.slice(0, 3).map((item, i) => (
                          <div key={i} className="flex items-center gap-1 text-[10px]">
                            {item.type === "text" ? <Type className="h-2.5 w-2.5 text-violet-500" /> : <CheckSquare className="h-2.5 w-2.5 text-muted-foreground" />}
                            {item.label}
                          </div>
                        ))}
                        {checklist.length > 3 && <p className="text-[10px] text-muted-foreground">+{checklist.length - 3} itens</p>}
                      </div>
                    </div>
                    <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 mt-1" />
                  </div>
                </>
              )}

              <div className="border-t border-border" />
              <Button className="w-full rounded-xl gap-1.5" onClick={handleSave} disabled={saving || !name}>
                {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvando...</> : <><Save className="h-3.5 w-3.5" />Salvar Alteracoes</>}
              </Button>
              <Button variant="outline" className="w-full rounded-xl" onClick={() => router.push(`/alerts/${alertId}`)}>Cancelar</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
