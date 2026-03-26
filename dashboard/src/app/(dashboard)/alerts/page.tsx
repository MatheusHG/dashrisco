"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Power,
  Zap,
  MessageSquare,
  ListTodo,
  Bell as BellIcon,
} from "lucide-react";
import Link from "next/link";

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
  WITHDRAWAL_CONFIRMATION:
    "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400",
  DEPOSIT:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400",
  CASINO_PRIZE:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-400",
  CASINO_BET:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-400",
  SPORT_PRIZE:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400",
  SPORT_BET:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400",
  LOGIN:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400",
};

interface AlertConfig {
  id: string;
  name: string;
  description: string | null;
  webhookType: string;
  active: boolean;
  publishPanel: boolean;
  publishChat: boolean;
  createPanelTask: boolean;
  createClickupTask: boolean;
  createdAt: string;
  filters: Array<{
    field: string;
    operator: string;
    value: string;
    logicGate: string | null;
  }>;
  _count: { panelAlerts: number };
}

const operatorLabel = (op: string) =>
  op === "EQUAL" ? "=" : op === "GREATER" ? ">" : "<";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.fetch<{ alerts: AlertConfig[] }>("/alerts");
      setAlerts(data.alerts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const toggleAlert = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.fetch(`/alerts/${id}/toggle`, { method: "PATCH" });
      fetchAlerts();
    } catch (err) {
      console.error(err);
    }
  };

  const activeAlerts = alerts.filter((a) => a.active);
  const inactiveAlerts = alerts.filter((a) => !a.active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
            <BellIcon className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Alertas Configurados</h1>
            <p className="text-sm text-muted-foreground">
              {alerts.length} alertas ({activeAlerts.length} ativos)
            </p>
          </div>
        </div>
        <Link href="/alerts/new">
          <Button className="rounded-xl gap-2 shadow-sm transition-all duration-200 hover:shadow-md">
            <Plus className="h-4 w-4" /> Criar Alerta
          </Button>
        </Link>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <BellIcon className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-1">Nenhum alerta configurado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie seu primeiro alerta para comecar a monitorar eventos.
            </p>
            <Link href="/alerts/new">
              <Button>
                <Plus className="h-4 w-4" /> Criar Alerta
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Active Alerts */}
          {activeAlerts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Ativos ({activeAlerts.length})
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {activeAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onToggle={toggleAlert}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Inactive Alerts */}
          {inactiveAlerts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Inativos ({inactiveAlerts.length})
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {inactiveAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onToggle={toggleAlert}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AlertCard({
  alert,
  onToggle,
}: {
  alert: AlertConfig;
  onToggle: (id: string, e: React.MouseEvent) => void;
}) {
  const colorClass =
    typeColors[alert.webhookType] || "bg-muted text-foreground";

  const destinations: string[] = [];
  if (alert.publishPanel) destinations.push("Painel");
  if (alert.publishChat) destinations.push("Chat");

  const tasks: string[] = [];
  if (alert.createPanelTask) tasks.push("Painel");
  if (alert.createClickupTask) tasks.push("ClickUp");

  return (
    <Link href={`/alerts/${alert.id}`}>
      <Card
        className={`transition-all hover:shadow-md cursor-pointer ${
          !alert.active ? "opacity-60" : ""
        }`}
      >
        <CardContent className="p-0">
          {/* Top color bar */}
          <div
            className={`h-1 rounded-t-xl ${
              alert.active ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          />

          <div className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{alert.name}</h3>
                </div>
                {alert.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {alert.description}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={(e) => onToggle(alert.id, e)}
                title={alert.active ? "Desativar" : "Ativar"}
              >
                <Power
                  className={`h-4 w-4 ${
                    alert.active ? "text-green-500" : "text-muted-foreground"
                  }`}
                />
              </Button>
            </div>

            {/* Type + Status badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`border-0 text-[11px] ${colorClass}`}>
                {webhookTypeLabels[alert.webhookType] || alert.webhookType}
              </Badge>
              <Badge
                variant={alert.active ? "success" : "secondary"}
                className="text-[11px]"
              >
                {alert.active ? "Ativo" : "Inativo"}
              </Badge>
            </div>

            {/* Filters preview */}
            {alert.filters.length > 0 && (
              <div className="rounded bg-muted px-2.5 py-1.5 text-xs font-mono text-muted-foreground">
                {alert.filters.map((f, i) => (
                  <span key={i}>
                    <span className="text-primary">{f.field}</span>{" "}
                    {operatorLabel(f.operator)} {f.value}
                    {i < alert.filters.length - 1 && (
                      <span className="mx-1 font-semibold">
                        {f.logicGate || "AND"}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* Footer stats */}
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {destinations.length > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {destinations.join(", ")}
                  </span>
                )}
                {tasks.length > 0 && (
                  <span className="flex items-center gap-1">
                    <ListTodo className="h-3 w-3" />
                    {tasks.join(", ")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Zap className="h-3 w-3 text-primary" />
                <span className="font-semibold">
                  {alert._count.panelAlerts}
                </span>
                <span className="text-muted-foreground">disparos</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
