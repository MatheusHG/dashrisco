"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getFieldLabel, formatCurrency, webhookTypeLabels } from "@/lib/field-labels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Pencil,
  Power,
  Bell,
  MessageSquare,
  ListTodo,
  Zap,
  Hash,
  GitBranch,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import Link from "next/link";


const typeColors: Record<string, string> = {
  WITHDRAWAL_REQUEST: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400",
  WITHDRAWAL_CONFIRMATION: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400",
  DEPOSIT_REQUEST: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400",
  CASINO_REFUND: "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400",
  USER_REGISTRATION: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-400",
  DEPOSIT: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400",
  CASINO_PRIZE: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-400",
  CASINO_BET: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-400",
  SPORT_PRIZE: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400",
  SPORT_BET: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400",
  LOGIN: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400",
};

const operatorLabels: Record<string, string> = {
  EQUAL: "=",
  NOT_EQUAL: "!=",
  GREATER: ">",
  GREATER_EQUAL: ">=",
  LESS: "<",
  LESS_EQUAL: "<=",
};

interface AlertFilter {
  id: string;
  field: string;
  operator: string;
  value: string;
  logicGate: string | null;
  order: number;
}

interface AlertConfig {
  id: string;
  name: string;
  description: string | null;
  webhookType: string;
  active: boolean;
  publishPanel: boolean;
  publishChat: boolean;
  chatWebhookUrl: string | null;
  createPanelTask: boolean;
  createClickupTask: boolean;
  clickupListId: string | null;
  selectedFields: string[];
  filters: AlertFilter[];
  createdAt: string;
  updatedAt: string;
  _count: { panelAlerts: number };
}

interface PanelAlertItem {
  id: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  createdAt: string;
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (
    (key.includes("value") || key.includes("credits")) &&
    typeof value === "number"
  ) {
    return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  }
  return String(value);
}

export default function AlertDetailPage() {
  const params = useParams();
  const router = useRouter();
  const alertId = params.id as string;

  const [alert, setAlert] = useState<AlertConfig | null>(null);
  const [history, setHistory] = useState<PanelAlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [alertData, historyData] = await Promise.all([
        api.fetch<AlertConfig>(`/alerts/${alertId}`),
        api.fetch<{ alerts: PanelAlertItem[] }>(
          `/alerts/${alertId}/history?limit=10`
        ),
      ]);
      setAlert(alertData);
      setHistory(historyData.alerts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleActive = async () => {
    await api.fetch(`/alerts/${alertId}/toggle`, { method: "PATCH" });
    fetchData();
  };

  const deleteAlert = async () => {
    if (!confirm("Tem certeza que deseja excluir este alerta? Esta acao nao pode ser desfeita.")) return;
    try {
      await api.fetch(`/alerts/${alertId}`, { method: "DELETE" });
      router.push("/alerts");
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!alert) return <p className="text-destructive">Alerta nao encontrado</p>;

  const colorClass =
    typeColors[alert.webhookType] || "bg-muted text-foreground";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.push("/alerts")}
          className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-card/80 text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
            <Bell className="h-5 w-5 text-amber-500" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{alert.name}</h1>
            <Badge variant={alert.active ? "success" : "destructive"}>
              {alert.active ? "Ativo" : "Inativo"}
            </Badge>
            <Badge className={`border-0 ${colorClass}`}>
              {webhookTypeLabels[alert.webhookType] || alert.webhookType}
            </Badge>
          </div>
          {alert.description && (
            <p className="text-muted-foreground mt-1">{alert.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Criado em {new Date(alert.createdAt).toLocaleString("pt-BR")} | Atualizado em{" "}
            {new Date(alert.updatedAt).toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={`/alerts/${alertId}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          </Link>
          <Button
            variant={alert.active ? "outline" : "default"}
            size="sm"
            onClick={toggleActive}
          >
            <Power className="h-4 w-4" />
            {alert.active ? "Desativar" : "Ativar"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={deleteAlert}
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </Button>
        </div>
      </div>

      {/* Config Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Disparos */}
        <Card>
          <CardContent className="pt-6 text-center">
            <Zap className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-3xl font-bold">{alert._count.panelAlerts}</p>
            <p className="text-xs text-muted-foreground">Disparos totais</p>
          </CardContent>
        </Card>

        {/* Publicacao */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Publicacao</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Painel</span>
                <Badge variant={alert.publishPanel ? "success" : "secondary"}>
                  {alert.publishPanel ? "Sim" : "Nao"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Google Chat</span>
                <Badge variant={alert.publishChat ? "success" : "secondary"}>
                  {alert.publishChat ? "Sim" : "Nao"}
                </Badge>
              </div>
              {alert.publishChat && alert.chatWebhookUrl && (
                <p
                  className="text-[10px] text-muted-foreground truncate"
                  title={alert.chatWebhookUrl}
                >
                  {alert.chatWebhookUrl}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <ListTodo className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Tasks</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Task Painel</span>
                <Badge
                  variant={alert.createPanelTask ? "success" : "secondary"}
                >
                  {alert.createPanelTask ? "Sim" : "Nao"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">ClickUp</span>
                <Badge
                  variant={alert.createClickupTask ? "success" : "secondary"}
                >
                  {alert.createClickupTask ? "Sim" : "Nao"}
                </Badge>
              </div>
              {alert.createClickupTask && alert.clickupListId && (
                <p className="text-[10px] text-muted-foreground">
                  Lista: {alert.clickupListId}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Campos */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">
                Campos ({alert.selectedFields.length})
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {alert.selectedFields.map((field) => (
                <Badge key={field} variant="outline" className="text-[10px]">
                  {getFieldLabel(field)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Condicoes do Alerta</p>
          </div>
          {alert.filters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem filtros — todos os eventos do tipo{" "}
              <span className="font-medium">
                {webhookTypeLabels[alert.webhookType]}
              </span>{" "}
              disparam este alerta.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {alert.filters.map((f, i) => (
                <div key={f.id} className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5">
                    <span className="text-sm font-medium text-primary">
                      {getFieldLabel(f.field)}
                    </span>
                    <span className="text-sm font-bold">
                      {operatorLabels[f.operator] || f.operator}
                    </span>
                    <span className="text-sm font-medium">{f.value ? formatCurrency(String(Math.round(Number(f.value) * 100))) : "?"}</span>
                  </div>
                  {i < alert.filters.length - 1 && (
                    <Badge variant="secondary" className="text-xs">
                      {f.logicGate || "AND"}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">
              Historico de Disparos ({alert._count.panelAlerts})
            </CardTitle>
          </div>
          {history.length > 0 && (
            <Link href="/panel/alerts">
              <Button variant="ghost" size="sm" className="text-xs">
                Ver todos
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum disparo registrado ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((item) => {
                const isExpanded = expandedId === item.id;
                const userName =
                  (item.data.user_name as string) ||
                  (item.data.user_username as string) ||
                  "-";

                // Valor principal baseado no tipo de webhook
                const mainValue = (() => {
                  const d = item.data;
                  const fmt = (v: unknown) => v ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null;
                  switch (alert.webhookType) {
                    case "WITHDRAWAL_REQUEST": case "WITHDRAWAL_CONFIRMATION": return fmt(d.withdraw_value);
                    case "DEPOSIT_REQUEST": case "DEPOSIT": return fmt(d.deposit_value);
                    case "SPORT_BET": case "CASINO_BET": return fmt(d.bet_value);
                    case "SPORT_PRIZE": return fmt(d.bet_return_value);
                    case "CASINO_PRIZE": return fmt(d.prize_value);
                    case "CASINO_REFUND": return fmt(d.refunded_value);
                    default: return null;
                  }
                })();

                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border overflow-hidden"
                  >
                    <div
                      className="flex items-center gap-4 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : item.id)
                      }
                    >
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">
                            {userName}
                          </span>
                          {mainValue && (
                            <span className="text-sm font-semibold text-primary">
                              {mainValue}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.createdAt).toLocaleString("pt-BR")}
                          </span>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border bg-muted/30 p-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {Object.entries(item.data)
                            .filter(([k]) => k !== "type")
                            .filter(
                              ([, v]) =>
                                v !== null && v !== undefined && v !== ""
                            )
                            .map(([key, value]) => (
                              <div key={key}>
                                <p className="text-[11px] text-muted-foreground">
                                  {getFieldLabel(key)}
                                </p>
                                <p className="text-sm font-medium break-all">
                                  {key === "user_id" && value ? (
                                    <a href={`https://dashboard.marjosports.com.br/back-office/online-client/search?query=ID&field=${String(value)}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{String(value)}</a>
                                  ) : formatValue(key, value)}
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
