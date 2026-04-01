"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getFieldLabel, formatCurrency, parseCurrency } from "@/lib/field-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Pencil, AlertTriangle, Eye, Plus, CheckSquare, X, Bell,
  ListTodo, Zap, Columns, Filter, Share2, MessageSquare, Loader2, Save,
} from "lucide-react";

const WEBHOOK_TYPES = [
  { value: "SPORT_BET", label: "Apostas Sportbook", icon: "🏀" },
  { value: "SPORT_PRIZE", label: "Premios Sportbook", icon: "🏆" },
  { value: "CASINO_BET", label: "Apostas Cassino", icon: "🎰" },
  { value: "CASINO_PRIZE", label: "Premios Cassino", icon: "💰" },
  { value: "DEPOSIT", label: "Deposito", icon: "💳" },
  { value: "WITHDRAWAL_CONFIRMATION", label: "Saque", icon: "🏧" },
  { value: "LOGIN", label: "Login", icon: "🔐" },
];

const OPERATORS = [
  { value: "EQUAL", label: "= Igual" },
  { value: "NOT_EQUAL", label: "!= Diferente" },
  { value: "GREATER", label: "> Maior" },
  { value: "GREATER_EQUAL", label: ">= Maior ou igual" },
  { value: "LESS", label: "< Menor" },
  { value: "LESS_EQUAL", label: "<= Menor ou igual" },
];

const opLabel = (op: string) => {
  const m: Record<string, string> = { EQUAL: "=", NOT_EQUAL: "!=", GREATER: ">", GREATER_EQUAL: ">=", LESS: "<", LESS_EQUAL: "<=" };
  return m[op] ?? op;
};

interface FieldSchema { name: string; type: string; example: string; }
interface FilterItem { field: string; operator: string; value: string; logicGate: string | null; }

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
  checklist: string[];
  createClickupTask: boolean;
  clickupListId: string | null;
  selectedFields: string[];
  filters: Array<{ field: string; operator: string; value: string; logicGate: string | null; order: number }>;
}

export default function EditAlertPage() {
  const params = useParams();
  const router = useRouter();
  const alertId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"ALERT" | "WATCH">("ALERT");
  const [webhookType, setWebhookType] = useState("");
  const [publishPanel, setPublishPanel] = useState(false);
  const [publishChat, setPublishChat] = useState(false);
  const [chatWebhookUrl, setChatWebhookUrl] = useState("");
  const [externalWebhookUrl, setExternalWebhookUrl] = useState("");
  const [createPanelTask, setCreatePanelTask] = useState(false);
  const [createClickupTask, setCreateClickupTask] = useState(false);
  const [clickupListId, setClickupListId] = useState("");
  const [checklist, setChecklist] = useState<string[]>([]);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterItem[]>([]);
  const [availableFields, setAvailableFields] = useState<FieldSchema[]>([]);

  const fetchAlert = useCallback(async () => {
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
      setChecklist((data.checklist as string[]) || []);
      setCreatePanelTask(data.createPanelTask);
      setCreateClickupTask(data.createClickupTask);
      setClickupListId(data.clickupListId || "");
      setSelectedFields(data.selectedFields);
      setFilters(data.filters.map((f) => ({ field: f.field, operator: f.operator, value: f.value, logicGate: f.logicGate })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [alertId]);

  useEffect(() => { fetchAlert(); }, [fetchAlert]);

  useEffect(() => {
    if (webhookType) {
      api.fetch<{ fields: FieldSchema[] }>(`/webhooks/schemas/${webhookType}`)
        .then((data) => setAvailableFields(data.fields)).catch(console.error);
    }
  }, [webhookType]);

  const handleSave = async () => {
    setError(""); setSaving(true);
    try {
      await api.fetch(`/alerts/${alertId}`, {
        method: "PUT",
        body: JSON.stringify({
          name, description: description || undefined, mode, webhookType,
          publishPanel, publishChat,
          chatWebhookUrl: publishChat ? chatWebhookUrl : null,
          externalWebhookUrl: externalWebhookUrl.trim() || null,
          createPanelTask, checklist: createPanelTask ? checklist : [],
          createClickupTask, clickupListId: createClickupTask ? clickupListId : null,
          selectedFields,
          filters: filters.map((f, i) => ({
            field: f.field, operator: f.operator, value: f.value,
            logicGate: i < filters.length - 1 ? f.logicGate || "AND" : null, order: i,
          })),
        }),
      });
      router.push(`/alerts/${alertId}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Erro ao salvar"); }
    finally { setSaving(false); }
  };

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="flex gap-8">
      {/* Left - Form */}
      <div className="flex-1 max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/alerts/${alertId}`)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-card text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Editar Alerta</h1>
            <p className="text-sm text-muted-foreground">Ajuste as configuracoes do alerta</p>
          </div>
        </div>

        {/* ═══ Info + Modo ═══ */}
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-foreground"><Pencil className="h-5 w-5 text-amber-500" /><h2 className="text-lg font-semibold">Informacoes Basicas</h2></div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Nome do Alerta</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Saques acima de R$1.000" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Descricao (opcional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o objetivo deste alerta" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Modo do Alerta</Label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMode("ALERT")}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${mode === "ALERT" ? "border-red-500 bg-red-500/10 ring-1 ring-red-500/30" : "border-border/50 hover:bg-muted/50"}`}>
                  <AlertTriangle className={`h-5 w-5 ${mode === "ALERT" ? "text-red-500" : "text-muted-foreground"}`} />
                  <div>
                    <p className={`text-sm ${mode === "ALERT" ? "font-semibold" : ""}`}>Alerta</p>
                    <p className="text-[11px] text-muted-foreground">Notifica, toca som, envia pro chat</p>
                  </div>
                </button>
                <button onClick={() => setMode("WATCH")}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${mode === "WATCH" ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30" : "border-border/50 hover:bg-muted/50"}`}>
                  <Eye className={`h-5 w-5 ${mode === "WATCH" ? "text-blue-500" : "text-muted-foreground"}`} />
                  <div>
                    <p className={`text-sm ${mode === "WATCH" ? "font-semibold" : ""}`}>Acompanhamento</p>
                    <p className="text-[11px] text-muted-foreground">Apenas registra, sem notificar</p>
                  </div>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══ Destino ═══ */}
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
                  <p className="text-sm font-semibold">Compartilhar via Webhook (opcional)</p>
                  <p className="text-xs text-muted-foreground">Dispara um POST com os dados do alerta para uma URL externa</p>
                </div>
              </div>
              <Input value={externalWebhookUrl} onChange={(e) => setExternalWebhookUrl(e.target.value)} placeholder="https://exemplo.com/webhook" className="h-10 rounded-xl text-sm" />
              {externalWebhookUrl.trim() && !/^https?:\/\/.+/.test(externalWebhookUrl.trim()) && (
                <p className="text-xs text-destructive">URL invalida. Deve comecar com http:// ou https://</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ═══ Tasks ═══ */}
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-foreground"><ListTodo className="h-5 w-5 text-violet-500" /><h2 className="text-lg font-semibold">Tasks</h2></div>
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
                  <div>
                    <p className="text-sm font-semibold">Checklist de Verificacao</p>
                    <p className="text-xs text-muted-foreground">A task conclui automaticamente quando todos os itens forem marcados.</p>
                  </div>
                </div>
                {checklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2">
                    <CheckSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm flex-1">{item}</span>
                    <button onClick={() => setChecklist(checklist.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)} placeholder="Ex: Verificar FTD do usuario" className="h-9 rounded-xl text-sm flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter" && newCheckItem.trim()) { e.preventDefault(); setChecklist([...checklist, newCheckItem.trim()]); setNewCheckItem(""); } }} />
                  <Button variant="outline" size="sm" className="rounded-xl gap-1 shrink-0" disabled={!newCheckItem.trim()}
                    onClick={() => { setChecklist([...checklist, newCheckItem.trim()]); setNewCheckItem(""); }}>
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ Webhook Type ═══ */}
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-foreground"><Zap className="h-5 w-5 text-emerald-500" /><h2 className="text-lg font-semibold">Tipo de Evento</h2></div>
            <div className="grid grid-cols-2 gap-2">
              {WEBHOOK_TYPES.map((t) => (
                <button key={t.value} onClick={() => { setWebhookType(t.value); setSelectedFields([]); setFilters([]); }}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${webhookType === t.value ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border/50 hover:bg-muted/50"}`}>
                  <span className="text-xl">{t.icon}</span>
                  <span className={`text-sm ${webhookType === t.value ? "font-semibold" : ""}`}>{t.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ═══ Campos ═══ */}
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-foreground"><Columns className="h-5 w-5 text-cyan-500" /><h2 className="text-lg font-semibold">Campos do Webhook</h2></div>
            <p className="text-sm text-muted-foreground">
              Selecione os campos para usar nos filtros e na mensagem.{" "}
              <button className="text-primary hover:underline" onClick={() => setSelectedFields(availableFields.map((f) => f.name))}>Selecionar todos</button>
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
              {availableFields.map((field) => (
                <label key={field.name} className={`flex items-center gap-2 rounded-xl border p-3 text-sm cursor-pointer transition-all ${selectedFields.includes(field.name) ? "border-primary bg-primary/10" : "border-border/50 hover:bg-muted/50"}`}>
                  <input type="checkbox" checked={selectedFields.includes(field.name)} onChange={() => {
                    setSelectedFields((p) => p.includes(field.name) ? p.filter((f) => f !== field.name) : [...p, field.name]);
                  }} className="h-3.5 w-3.5 accent-primary" />
                  <div>
                    <p className="font-medium text-xs">{getFieldLabel(field.name)}</p>
                    <p className="text-[10px] text-muted-foreground">{field.name} — {field.example}</p>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ═══ Filtros ═══ */}
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-foreground"><Filter className="h-5 w-5 text-orange-500" /><h2 className="text-lg font-semibold">Condicoes do Alerta</h2></div>
            <p className="text-sm text-muted-foreground">Filtre os dados do webhook antes de disparar. Sem filtros, todos os eventos passam.</p>

            {filters.map((filter, i) => (
              <div key={i} className="space-y-2">
                {i > 0 && (
                  <div className="flex justify-center">
                    <select className="rounded-lg border border-border/60 bg-transparent px-3 py-1 text-xs font-semibold" value={filters[i - 1]?.logicGate || "AND"}
                      onChange={(e) => { const u = [...filters]; u[i - 1] = { ...u[i - 1]!, logicGate: e.target.value }; setFilters(u); }}>
                      <option value="AND">E (AND)</option><option value="OR">OU (OR)</option>
                    </select>
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <select className="flex-1 h-9 rounded-xl border border-border/60 bg-transparent px-3 text-sm" value={filter.field}
                    onChange={(e) => { const u = [...filters]; u[i] = { ...u[i]!, field: e.target.value }; setFilters(u); }}>
                    {selectedFields.map((f) => <option key={f} value={f}>{getFieldLabel(f)}</option>)}
                  </select>
                  <select className="h-9 rounded-xl border border-border/60 bg-transparent px-3 text-sm" value={filter.operator}
                    onChange={(e) => { const u = [...filters]; u[i] = { ...u[i]!, operator: e.target.value }; setFilters(u); }}>
                    {OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                  </select>
                  <Input placeholder="0,00" value={filter.value ? formatCurrency(String(Math.round(Number(filter.value) * 100))) : ""}
                    onChange={(e) => { const u = [...filters]; u[i] = { ...u[i]!, value: parseCurrency(e.target.value) }; setFilters(u); }} className="flex-1 h-9 rounded-xl" />
                  <button onClick={() => setFilters(filters.filter((_, j) => j !== i))} className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" className="rounded-xl gap-1.5"
              onClick={() => setFilters([...filters, { field: selectedFields[0] || "", operator: "EQUAL", value: "", logicGate: null }])}>
              <Plus className="h-3.5 w-3.5" /> Adicionar Condicao
            </Button>

            {filters.length > 0 && (
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Preview</p>
                <p className="text-sm font-mono text-foreground">
                  {filters.map((f, i) => `${getFieldLabel(f.field)} ${opLabel(f.operator)} ${f.value ? formatCurrency(String(Math.round(Number(f.value) * 100))) : "?"}${i < filters.length - 1 ? ` ${f.logicGate || "AND"} ` : ""}`).join("")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ Actions ═══ */}
        {error && <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{error}</div>}
        <div className="flex items-center gap-3">
          <Button className="rounded-xl gap-1.5" onClick={handleSave} disabled={saving || !name}>
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvando...</> : <><Save className="h-3.5 w-3.5" />Salvar Alteracoes</>}
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => router.push(`/alerts/${alertId}`)}>Cancelar</Button>
        </div>
      </div>

      {/* Right - Summary Panel */}
      <div className="w-72 shrink-0 hidden lg:block">
        <div className="sticky top-8 space-y-3">
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-5 space-y-3 text-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo</p>

              <div className="space-y-0.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Nome</p>
                <p className="text-xs font-medium">{name || "—"}</p>
              </div>

              <div className="space-y-0.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Modo</p>
                <p className="text-xs font-medium">{mode === "ALERT" ? "Alerta" : "Acompanhamento"}</p>
              </div>

              <div className="space-y-0.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Webhook</p>
                <p className="text-xs font-medium">{WEBHOOK_TYPES.find((t) => t.value === webhookType)?.label || "—"}</p>
              </div>

              <div className="border-t border-border" />

              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Destino</p>
                <div className="flex flex-wrap gap-1">
                  {publishPanel && <Badge variant="secondary" className="text-[10px]">Painel</Badge>}
                  {publishChat && <Badge variant="secondary" className="text-[10px]">Chat</Badge>}
                  {externalWebhookUrl.trim() && <Badge variant="secondary" className="text-[10px]">Webhook</Badge>}
                  {!publishPanel && !publishChat && !externalWebhookUrl.trim() && <span className="text-muted-foreground italic text-xs">—</span>}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Campos ({selectedFields.length})</p>
                {selectedFields.length > 0 ? (
                  <div className="flex flex-wrap gap-1">{selectedFields.slice(0, 3).map((f) => <Badge key={f} variant="outline" className="text-[9px]">{getFieldLabel(f)}</Badge>)}{selectedFields.length > 3 && <Badge variant="outline" className="text-[9px]">+{selectedFields.length - 3}</Badge>}</div>
                ) : <span className="text-muted-foreground italic text-xs">—</span>}
              </div>

              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Filtros ({filters.length})</p>
                {filters.length > 0 ? (
                  <p className="text-[10px] font-mono text-muted-foreground">{filters.map((f, i) => `${getFieldLabel(f.field)} ${opLabel(f.operator)} ${f.value ? formatCurrency(String(Math.round(Number(f.value) * 100))) : "?"}${i < filters.length - 1 ? ` ${f.logicGate || "AND"} ` : ""}`).join("")}</p>
                ) : <span className="text-muted-foreground italic text-xs">Nenhum</span>}
              </div>

              {checklist.length > 0 && (
                <>
                  <div className="border-t border-border" />
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Checklist ({checklist.length})</p>
                    {checklist.map((item, i) => (
                      <div key={i} className="flex items-center gap-1 text-[10px]"><CheckSquare className="h-2.5 w-2.5 text-muted-foreground" />{item}</div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
