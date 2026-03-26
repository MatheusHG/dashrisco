"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Filter, X, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

const WEBHOOK_TYPES = [
  { value: "", label: "Todos" },
  { value: "CASINO_BET", label: "Apostas Cassino" },
  { value: "CASINO_PRIZE", label: "Premios Cassino" },
  { value: "SPORT_BET", label: "Apostas Sportbook" },
  { value: "SPORT_PRIZE", label: "Premios Sportbook" },
  { value: "LOGIN", label: "Login" },
  { value: "DEPOSIT", label: "Deposito" },
  { value: "WITHDRAWAL_CONFIRMATION", label: "Saque" },
];

const webhookTypeLabels: Record<string, string> = {
  CASINO_BET: "Apostas Cassino",
  CASINO_PRIZE: "Premios Cassino",
  SPORT_BET: "Apostas Sportbook",
  SPORT_PRIZE: "Premios Sportbook",
  LOGIN: "Login",
  DEPOSIT: "Deposito",
  WITHDRAWAL_CONFIRMATION: "Saque",
};

const typeColors: Record<string, string> = {
  WITHDRAWAL_CONFIRMATION: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400",
  DEPOSIT: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400",
  CASINO_PRIZE: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-400",
  CASINO_BET: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-400",
  SPORT_PRIZE: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400",
  SPORT_BET: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400",
  LOGIN: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400",
};

// Key fields to show by webhook type
const keyFields: Record<string, string[]> = {
  WITHDRAWAL_CONFIRMATION: ["user_name", "user_username", "withdraw_value", "withdraw_status", "withdraw_pix_type"],
  DEPOSIT: ["user_name", "user_username", "deposit_value", "deposit_status", "deposit_method"],
  CASINO_PRIZE: ["user_name", "casino_game_name", "casino_provider", "casino_bet_value", "casino_prize_value"],
  CASINO_BET: ["user_name", "casino_game_name", "casino_provider", "casino_bet_value"],
  SPORT_PRIZE: ["user_name", "bet_value", "bet_return_value", "bet_odds", "bet_events_count"],
  SPORT_BET: ["user_name", "bet_value", "bet_return_value", "bet_odds", "bet_events_count"],
  LOGIN: ["user_name", "user_email", "login_ip"],
};

const fieldLabels: Record<string, string> = {
  user_name: "Usuario",
  user_username: "Username",
  user_email: "Email",
  user_cpf: "CPF",
  user_contact: "Contato",
  withdraw_value: "Valor do Saque",
  withdraw_status: "Status",
  withdraw_pix_type: "Tipo PIX",
  deposit_value: "Valor do Deposito",
  deposit_status: "Status",
  deposit_method: "Metodo",
  casino_game_name: "Jogo",
  casino_provider: "Provedor",
  casino_bet_value: "Valor Aposta",
  casino_prize_value: "Valor Premio",
  bet_value: "Valor Aposta",
  bet_return_value: "Retorno",
  bet_odds: "Odds",
  bet_events_count: "Eventos",
  login_ip: "IP",
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
  createdAt: string;
  alertConfig: { id: string; name: string } | null;
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

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [webhookType, setWebhookType] = useState("");
  const [alertConfigId, setAlertConfigId] = useState("");

  const hasFilters = startDate || endDate || webhookType || alertConfigId;

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
  }, [page, startDate, endDate, webhookType, alertConfigId]);

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
    setPage(1);
  };

  const getKeyFieldsForType = (type: string) =>
    keyFields[type] || ["user_name", "user_username"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Painel de Alertas</h1>
            <p className="text-sm text-muted-foreground">{alerts.length} alertas disparados</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
            Filtros
            {hasFilters && (
              <Badge
                variant="secondary"
                className="ml-1 text-[10px] px-1.5 py-0"
              >
                !
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-4 pt-4 pb-4">
            <div className="space-y-1">
              <Label className="text-xs">Data Inicio</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-40 h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Fim</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-40 h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <select
                className="flex h-8 rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
                value={webhookType}
                onChange={(e) => {
                  setWebhookType(e.target.value);
                  setPage(1);
                }}
              >
                {WEBHOOK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Alerta</Label>
              <select
                className="flex h-8 rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
                value={alertConfigId}
                onChange={(e) => {
                  setAlertConfigId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                {alertConfigs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4" />
                Limpar
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhum alerta disparado
            {hasFilters ? " para os filtros selecionados." : " ainda."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const isExpanded = expandedId === alert.id;
            const fields = getKeyFieldsForType(alert.webhookType);
            const colorClass =
              typeColors[alert.webhookType] || "bg-muted text-foreground";

            return (
              <Card key={alert.id} className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Main row */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`text-[11px] border-0 ${colorClass}`}
                        >
                          {webhookTypeLabels[alert.webhookType] ||
                            alert.webhookType}
                        </Badge>
                        <Badge variant="outline" className="text-[11px]">
                          {alert.alertConfig?.name ?? "Config removida"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(alert.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                    </div>

                    {/* Key fields grid - always visible */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {fields.map((fieldKey) => {
                        const value = alert.data[fieldKey];
                        if (value === undefined && value === null) return null;
                        return (
                          <div key={fieldKey}>
                            <p className="text-[11px] text-muted-foreground">
                              {fieldLabels[fieldKey] || fieldKey}
                            </p>
                            <p className="text-sm font-medium text-foreground truncate">
                              {formatValue(fieldKey, value)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Expand toggle */}
                  <button
                    className="flex w-full items-center justify-center gap-1 border-t border-border py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : alert.id)
                    }
                  >
                    {isExpanded ? (
                      <>
                        Ocultar detalhes <ChevronUp className="h-3 w-3" />
                      </>
                    ) : (
                      <>
                        Ver todos os campos <ChevronDown className="h-3 w-3" />
                      </>
                    )}
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/30 p-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {Object.entries(alert.data)
                          .filter(
                            ([key]) => !fields.includes(key) && key !== "type"
                          )
                          .filter(
                            ([, v]) =>
                              v !== null && v !== undefined && v !== ""
                          )
                          .map(([key, value]) => (
                            <div key={key}>
                              <p className="text-[11px] text-muted-foreground">
                                {fieldLabels[key] || key}
                              </p>
                              <p className="text-sm text-foreground break-all">
                                {formatValue(key, value)}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <span className="flex items-center text-sm text-muted-foreground">
            {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Proximo
          </Button>
        </div>
      )}
    </div>
  );
}
