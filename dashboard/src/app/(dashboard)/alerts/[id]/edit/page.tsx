"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getFieldLabel, formatCurrency, parseCurrency } from "@/lib/field-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil, AlertTriangle, Eye, Plus, CheckSquare, X } from "lucide-react";

const WEBHOOK_TYPES = [
  { value: "CASINO_BET", label: "Apostas Cassino" },
  { value: "CASINO_PRIZE", label: "Premios Cassino" },
  { value: "SPORT_BET", label: "Apostas Sportbook" },
  { value: "SPORT_PRIZE", label: "Premios Sportbook" },
  { value: "LOGIN", label: "Login" },
  { value: "DEPOSIT", label: "Deposito" },
  { value: "WITHDRAWAL_CONFIRMATION", label: "Saque" },
];

const OPERATORS = [
  { value: "EQUAL", label: "Igual (=)" },
  { value: "GREATER", label: "Maior (>)" },
  { value: "LESS", label: "Menor (<)" },
];

interface FieldSchema {
  name: string;
  type: string;
  example: string;
}

interface Filter {
  field: string;
  operator: string;
  value: string;
  logicGate: string | null;
}

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
  filters: Array<{
    field: string;
    operator: string;
    value: string;
    logicGate: string | null;
    order: number;
  }>;
}

export default function EditAlertPage() {
  const params = useParams();
  const router = useRouter();
  const alertId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
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
  const [filters, setFilters] = useState<Filter[]>([]);
  const [availableFields, setAvailableFields] = useState<FieldSchema[]>([]);

  // Load alert data
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
      setFilters(
        data.filters.map((f) => ({
          field: f.field,
          operator: f.operator,
          value: f.value,
          logicGate: f.logicGate,
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  useEffect(() => {
    fetchAlert();
  }, [fetchAlert]);

  // Load fields when webhook type is set
  useEffect(() => {
    if (webhookType) {
      api
        .fetch<{ fields: FieldSchema[] }>(`/webhooks/schemas/${webhookType}`)
        .then((data) => setAvailableFields(data.fields))
        .catch(console.error);
    }
  }, [webhookType]);

  const toggleField = (fieldName: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldName)
        ? prev.filter((f) => f !== fieldName)
        : [...prev, fieldName]
    );
  };

  const addFilter = () => {
    setFilters([
      ...filters,
      {
        field: selectedFields[0] || "",
        operator: "EQUAL",
        value: "",
        logicGate: null,
      },
    ]);
  };

  const updateFilter = (
    index: number,
    key: keyof Filter,
    value: string | null
  ) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index]!, [key]: value };
    setFilters(newFilters);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
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
          checklist: createPanelTask ? checklist : [],
          createClickupTask,
          clickupListId: createClickupTask ? clickupListId : null,
          selectedFields,
          filters: filters.map((f, i) => ({
            field: f.field,
            operator: f.operator,
            value: f.value,
            logicGate: i < filters.length - 1 ? f.logicGate || "AND" : null,
            order: i,
          })),
        }),
      });
      router.push(`/alerts/${alertId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/alerts/${alertId}`)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-card/80 text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
          <Pencil className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Editar Alerta</h1>
          <p className="text-sm text-muted-foreground">Ajuste as configuracoes do alerta</p>
        </div>
      </div>

      {/* Informacoes Basicas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Informacoes Basicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Alerta</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Saques acima de R$1.000"
            />
          </div>
          <div className="space-y-2">
            <Label>Descricao (opcional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descricao do alerta"
            />
          </div>
        </CardContent>
      </Card>

      {/* Modo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Modo do Alerta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMode("ALERT")}
              className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-all ${mode === "ALERT" ? "border-red-500 bg-red-500/10 ring-1 ring-red-500/30" : "border-border/50 hover:bg-muted/50"}`}>
              <AlertTriangle className={`h-5 w-5 ${mode === "ALERT" ? "text-red-500" : "text-muted-foreground"}`} />
              <div>
                <p className={`text-sm ${mode === "ALERT" ? "font-semibold" : ""}`}>Alerta</p>
                <p className="text-xs text-muted-foreground">Notifica, toca som, envia pro chat</p>
              </div>
            </button>
            <button onClick={() => setMode("WATCH")}
              className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-all ${mode === "WATCH" ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30" : "border-border/50 hover:bg-muted/50"}`}>
              <Eye className={`h-5 w-5 ${mode === "WATCH" ? "text-blue-500" : "text-muted-foreground"}`} />
              <div>
                <p className={`text-sm ${mode === "WATCH" ? "font-semibold" : ""}`}>Acompanhamento</p>
                <p className="text-xs text-muted-foreground">Apenas registra, sem notificar</p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Publicacao */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Onde publicar o alerta?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={publishPanel}
              onChange={(e) => setPublishPanel(e.target.checked)}
              className="h-4 w-4"
            />
            <div>
              <p className="font-medium">Painel</p>
              <p className="text-sm text-muted-foreground">
                Exibir no painel de alertas da dashboard
              </p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={publishChat}
              onChange={(e) => setPublishChat(e.target.checked)}
              className="h-4 w-4"
            />
            <div>
              <p className="font-medium">Gmail Chat</p>
              <p className="text-sm text-muted-foreground">
                Enviar para um webhook do Google Chat
              </p>
            </div>
          </label>
          {publishChat && (
            <div className="space-y-2 ml-7">
              <Label>URL do Webhook</Label>
              <Input
                value={chatWebhookUrl}
                onChange={(e) => setChatWebhookUrl(e.target.value)}
                placeholder="https://chat.googleapis.com/v1/spaces/..."
              />
            </div>
          )}
          <div className="space-y-2 pt-4 border-t border-border/50">
            <Label>Webhook Externo (opcional)</Label>
            <p className="text-xs text-muted-foreground">Dispara um POST com os dados do alerta para uma URL externa</p>
            <Input
              value={externalWebhookUrl}
              onChange={(e) => setExternalWebhookUrl(e.target.value)}
              placeholder="https://exemplo.com/webhook"
            />
            {externalWebhookUrl.trim() && !/^https?:\/\/.+/.test(externalWebhookUrl.trim()) && (
              <p className="text-xs text-destructive">URL invalida. Deve comecar com http:// ou https://</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={createPanelTask}
              onChange={(e) => setCreatePanelTask(e.target.checked)}
              className="h-4 w-4"
            />
            <div>
              <p className="font-medium">Painel</p>
              <p className="text-sm text-muted-foreground">
                Criar task no painel da dashboard
              </p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={createClickupTask}
              onChange={(e) => setCreateClickupTask(e.target.checked)}
              className="h-4 w-4"
            />
            <div>
              <p className="font-medium">ClickUp</p>
              <p className="text-sm text-muted-foreground">
                Criar task no ClickUp automaticamente
              </p>
            </div>
          </label>
          {createClickupTask && (
            <div className="space-y-2 ml-7">
              <Label>ID da Lista do ClickUp</Label>
              <Input
                value={clickupListId}
                onChange={(e) => setClickupListId(e.target.value)}
                placeholder="ID da lista"
              />
            </div>
          )}
          {createPanelTask && (
            <div className="space-y-3 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-violet-500" />
                <div>
                  <p className="font-medium text-sm">Checklist de Verificacao</p>
                  <p className="text-xs text-muted-foreground">Itens que o analista deve verificar. A task conclui automaticamente quando todos forem marcados.</p>
                </div>
              </div>
              {checklist.map((item, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
                  <CheckSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1">{item}</span>
                  <button onClick={() => setChecklist(checklist.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  placeholder="Ex: Verificar FTD do usuario"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCheckItem.trim()) {
                      e.preventDefault();
                      setChecklist([...checklist, newCheckItem.trim()]);
                      setNewCheckItem("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!newCheckItem.trim()}
                  onClick={() => { setChecklist([...checklist, newCheckItem.trim()]); setNewCheckItem(""); }}
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tipo de Webhook</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {WEBHOOK_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => {
                  setWebhookType(type.value);
                  setSelectedFields([]);
                  setFilters([]);
                }}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  webhookType === type.value
                    ? "border-primary bg-primary/15 text-foreground font-semibold"
                    : "hover:bg-muted"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Select Fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Campos Selecionados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
            {availableFields.map((field) => (
              <label
                key={field.name}
                className={`flex items-center gap-2 rounded-lg border p-2 text-sm cursor-pointer ${
                  selectedFields.includes(field.name)
                    ? "border-primary bg-primary/15 text-foreground font-semibold"
                    : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedFields.includes(field.name)}
                  onChange={() => toggleField(field.name)}
                  className="h-4 w-4"
                />
                <div>
                  <p className="font-medium">{getFieldLabel(field.name)}</p>
                  <p className="text-xs text-muted-foreground">
                    {field.name} — {field.example}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Condicoes do Alerta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {filters.map((filter, index) => (
            <div key={index} className="space-y-2">
              {index > 0 && (
                <div className="flex justify-center">
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters[index - 1]?.logicGate || "AND"}
                    onChange={(e) =>
                      updateFilter(index - 1, "logicGate", e.target.value)
                    }
                  >
                    <option value="AND">E (AND)</option>
                    <option value="OR">OU (OR)</option>
                  </select>
                </div>
              )}
              <div className="flex gap-2 items-center">
                <select
                  className="flex-1 rounded border px-2 py-1 text-sm"
                  value={filter.field}
                  onChange={(e) =>
                    updateFilter(index, "field", e.target.value)
                  }
                >
                  {selectedFields.map((f) => (
                    <option key={f} value={f}>
                      {getFieldLabel(f)}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded border px-2 py-1 text-sm"
                  value={filter.operator}
                  onChange={(e) =>
                    updateFilter(index, "operator", e.target.value)
                  }
                >
                  {OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
                <Input
                  className="flex-1"
                  placeholder="0,00"
                  value={filter.value ? formatCurrency(String(Math.round(Number(filter.value) * 100))) : ""}
                  onChange={(e) => updateFilter(index, "value", parseCurrency(e.target.value))}
                />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeFilter(index)}
                >
                  X
                </Button>
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addFilter}>
            + Adicionar Condicao
          </Button>

          {filters.length > 0 && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium mb-1">Preview da regra:</p>
              <p className="text-sm font-mono">
                {filters
                  .map((f, i) => {
                    const opLabel =
                      f.operator === "EQUAL"
                        ? "="
                        : f.operator === "GREATER"
                        ? ">"
                        : "<";
                    const gate =
                      i < filters.length - 1
                        ? ` ${f.logicGate || "AND"} `
                        : "";
                    return `${getFieldLabel(f.field)} ${opLabel} ${f.value ? formatCurrency(String(Math.round(Number(f.value) * 100))) : "?"}${gate}`;
                  })
                  .join("")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving || !name}>
          {saving ? "Salvando..." : "Salvar Alteracoes"}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push(`/alerts/${alertId}`)}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
