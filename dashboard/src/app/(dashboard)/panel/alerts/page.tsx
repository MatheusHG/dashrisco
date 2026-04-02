"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { getFieldLabel, webhookTypeLabels, WEBHOOK_TYPES } from "@/lib/field-labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, ChevronDown, AlertTriangle, Eye, Play, CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";

const WEBHOOK_TYPES_FILTER = [{ value: "", label: "Todos" }, ...WEBHOOK_TYPES.map(({ value, label }) => ({ value, label }))];

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

// Key fields to show by webhook type
const keyFields: Record<string, string[]> = {
  WITHDRAWAL_REQUEST: ["user_name", "user_username", "withdraw_value", "withdraw_status", "withdraw_pix_type"],
  WITHDRAWAL_CONFIRMATION: ["user_name", "user_username", "withdraw_value", "withdraw_status", "withdraw_pix_type"],
  DEPOSIT_REQUEST: ["user_name", "user_username", "deposit_value", "deposit_status"],
  DEPOSIT: ["user_name", "user_username", "deposit_value", "deposit_status"],
  CASINO_PRIZE: ["user_name", "game_name", "game_type", "prize_value"],
  CASINO_BET: ["user_name", "game_name", "bet_value"],
  CASINO_REFUND: ["user_name", "game_name", "refunded_value"],
  SPORT_PRIZE: ["user_name", "bet_value", "bet_return_value", "bet_events_count"],
  SPORT_BET: ["user_name", "bet_value", "bet_return_value", "bet_events_count"],
  LOGIN: ["login_username", "login_ip_address", "login_source"],
  USER_REGISTRATION: ["user_name", "user_cpf", "user_email", "user_has_kyc"],
};

interface AlertConfigOption {
  id: string;
  name: string;
}

interface PanelAlertItem {
  id: string;
  webhookType: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  mode: "ALERT" | "WATCH";
  createdAt: string;
  alertConfig: { id: string; name: string } | null;
  taskId: string | null;
  taskStatus: string | null;
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

export default function PanelAlertsPage() {
  const [alerts, setAlerts] = useState<PanelAlertItem[]>([]);
  const [alertConfigs, setAlertConfigs] = useState<AlertConfigOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [webhookType, setWebhookType] = useState("");
  const [alertConfigId, setAlertConfigId] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [queueFilter, setQueueFilter] = useState("pending"); // default: fila de pendentes

  const hasFilters = startDate || endDate || webhookType || alertConfigId || modeFilter || queueFilter !== "pending";

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (webhookType) params.set("webhookType", webhookType);
      if (alertConfigId) params.set("alertConfigId", alertConfigId);
      if (modeFilter) params.set("mode", modeFilter);
      if (queueFilter) params.set("queue", queueFilter);

      const data = await api.fetch<{
        alerts: PanelAlertItem[];
        totalPages: number;
      }>(`/panel/alerts?${params}`);
      setAlerts(data.alerts);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, startDate, endDate, webhookType, alertConfigId, modeFilter, queueFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Fetch alert configs for filter
  useEffect(() => {
    api
      .fetch<AlertConfigOption[]>("/reports/alert-configs")
      .then(setAlertConfigs)
      .catch(() => {});
  }, []);

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setWebhookType("");
    setAlertConfigId("");
    setModeFilter("");
    setQueueFilter("pending");
    setPage(1);
  };

  const getKeyFieldsForType = (type: string) =>
    keyFields[type] || ["user_name", "user_username"];

  const queueTabs = [
    { value: "pending", label: "Pendentes", icon: AlertTriangle },
    { value: "in_progress", label: "Em Analise", icon: Play },
    { value: "done", label: "Concluidos", icon: CheckCircle },
    { value: "", label: "Todos", icon: Eye },
  ];

  return (
    <div className="space-y-4">
      {/* Header compact */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Fila de Alertas</h1>
        <div className="flex items-center gap-2">
          <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="w-32 h-8 text-xs rounded-lg" />
          <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="w-32 h-8 text-xs rounded-lg" />
          <select className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs text-foreground" value={webhookType} onChange={(e) => { setWebhookType(e.target.value); setPage(1); }}>
            {WEBHOOK_TYPES_FILTER.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {hasFilters && <button onClick={clearFilters} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="h-3.5 w-3.5" /></button>}
        </div>
      </div>

      {/* Queue tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/50">
        {queueTabs.map((tab) => {
          const active = queueFilter === tab.value;
          const Icon = tab.icon;
          return (
            <button key={tab.value} onClick={() => { setQueueFilter(tab.value); setPage(1); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              <Icon className="h-3.5 w-3.5" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* Alert list */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <CheckCircle className="h-10 w-10 opacity-20" />
          <p className="text-sm">{queueFilter === "pending" ? "Nenhum alerta pendente" : queueFilter === "done" ? "Nenhuma analise concluida" : "Nenhum alerta encontrado"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const isExpanded = expandedId === alert.id;
            const fields = getKeyFieldsForType(alert.webhookType);
            const colorClass = typeColors[alert.webhookType] || "bg-muted text-foreground";
            const userName = (alert.data.user_name as string) || (alert.data.user_username as string) || "";
            const mainValue = (() => {
              const d = alert.data;
              switch (alert.webhookType) {
                case "WITHDRAWAL_REQUEST": case "WITHDRAWAL_CONFIRMATION": return d.withdraw_value;
                case "DEPOSIT_REQUEST": case "DEPOSIT": return d.deposit_value;
                case "SPORT_BET": case "CASINO_BET": return d.bet_value;
                case "SPORT_PRIZE": return d.bet_return_value;
                case "CASINO_PRIZE": return d.prize_value;
                case "CASINO_REFUND": return d.refunded_value;
                default: return undefined;
              }
            })();

            return (
              <div key={alert.id} className="group rounded-xl border border-border/50 bg-card/80 overflow-hidden hover:border-border transition-colors">
                {/* Main row */}
                <div className="flex items-center gap-4 px-4 py-3">
                  {/* Left: type color dot + user info */}
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <Badge className={`text-[10px] border-0 shrink-0 ${colorClass}`}>
                      {webhookTypeLabels[alert.webhookType] || alert.webhookType}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{userName || alert.title}</p>
                      <p className="text-[11px] text-muted-foreground">{alert.alertConfig?.name} · {new Date(alert.createdAt).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>

                  {/* Center: value */}
                  {mainValue !== undefined && mainValue !== null && mainValue !== "" && (
                    <span className="text-sm font-bold text-foreground shrink-0">
                      R$ {Number(mainValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  )}

                  {/* Right: action */}
                  <div className="flex items-center gap-2 shrink-0">
                    {alert.taskId ? (
                      alert.taskStatus === "done" ? (
                        <Link href={`/panel/tasks/${alert.taskId}/analise`} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-500 transition-colors">
                          <CheckCircle className="h-3 w-3" /> Concluida
                        </Link>
                      ) : alert.taskStatus === "in_progress" ? (
                        <Link href={`/panel/tasks/${alert.taskId}/analise`} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-semibold hover:bg-amber-400 transition-colors">
                          <Play className="h-3 w-3" /> Continuar
                        </Link>
                      ) : (
                        <Link href={`/panel/tasks/${alert.taskId}/analise`} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-colors">
                          <Play className="h-3 w-3" /> Analisar
                        </Link>
                      )
                    ) : (
                      <button onClick={() => setExpandedId(isExpanded ? null : alert.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                    )}
                    {alert.taskId && (
                      <button onClick={() => setExpandedId(isExpanded ? null : alert.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-border/30">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {Object.entries(alert.data)
                        .filter(([k]) => k !== "type")
                        .filter(([, v]) => v !== null && v !== undefined && v !== "")
                        .slice(0, 15)
                        .map(([key, value]) => (
                          <div key={key}>
                            <p className="text-[10px] text-muted-foreground">{getFieldLabel(key)}</p>
                            <p className="text-xs font-medium text-foreground truncate">{formatValue(key, value)}</p>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" className="rounded-lg text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span className="text-xs text-muted-foreground">{page} de {totalPages}</span>
          <Button variant="outline" size="sm" className="rounded-lg text-xs" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Proximo</Button>
        </div>
      )}
    </div>
  );
}
