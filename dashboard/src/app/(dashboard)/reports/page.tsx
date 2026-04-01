"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { webhookTypeLabels } from "@/lib/field-labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileBarChart, Bell, Target, Clock, ListTodo, Trophy, Loader2,
  FilterX, TrendingUp, TrendingDown, Minus, Users, Lock, ShieldAlert,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";

const COLORS = ["#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#6366f1"];


const tooltipStyle = {
  borderRadius: "12px", border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-card)", color: "var(--color-foreground)",
};

// ═══ Types ═══
interface RankingItem { userId: string; userName: string; tasksCompleted: number; avgSlaMinutes: number; minSlaMinutes: number; maxSlaMinutes: number; }
interface AlertsStats { byConfig: Array<{ alertConfigId: string; name: string; count: number }>; byType: Array<{ type: string; count: number }>; byDay: Array<{ date: string; count: number }>; total: number; }
interface ResolutionStats { total: number; open: number; inProgress: number; done: number; resolutionRate: number; sla: { avgMinutes: number; minMinutes: number; maxMinutes: number }; slaByUser: Array<{ userId: string; userName: string; avgSlaMinutes: number; tasksCompleted: number }>; }
interface AlertConfigOption { id: string; name: string; webhookType: string; active: boolean; }
interface RankingByType { webhookType: string; totalAlerts: number; totalResolved: number; resolutionRate: number; avgSlaMinutes: number; }
interface TrendData { current: number; previous: number; delta: number; }
interface Trends { alerts: TrendData; tasks: TrendData; resolved: TrendData; sla: TrendData; }
interface HourData { hour: number; count: number; }
interface TopUser { userId: string; userName: string; userUsername: string; count: number; }
interface GroupLockStats { totalLocks: number; totalUnlocks: number; avgLockSeconds: number; activeGroups: number; byGroup: Array<{ groupId: string; name: string; locks: number }>; }
interface SlaByDay { date: string; avgSlaMinutes: number; tasksResolved: number; }

function formatSla(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return `${h}h ${m}min`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function DeltaBadge({ delta, invertColor = false }: { delta: number; invertColor?: boolean }) {
  if (delta === 0) return <div className="flex items-center gap-0.5 text-[11px] text-muted-foreground"><Minus className="h-3 w-3" /> 0%</div>;
  const isPositive = delta > 0;
  const isGood = invertColor ? !isPositive : isPositive;
  return (
    <div className={`flex items-center gap-0.5 text-[11px] font-semibold ${isGood ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? "+" : ""}{delta}%
    </div>
  );
}

// ═══ Date presets ═══
function getPresetDates(preset: string): { start: string; end: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0]!;
  const today = fmt(now);
  switch (preset) {
    case "today": return { start: today, end: today };
    case "7d": return { start: fmt(new Date(now.getTime() - 7 * 86400000)), end: today };
    case "30d": return { start: fmt(new Date(now.getTime() - 30 * 86400000)), end: today };
    case "month": return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: today };
    default: return { start: "", end: "" };
  }
}

function ActiveAlertsBysector({ configs }: { configs: AlertConfigOption[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const activeConfigs = configs.filter((c) => c.active);
  if (activeConfigs.length === 0) return null;

  const byType = new Map<string, AlertConfigOption[]>();
  for (const c of activeConfigs) {
    const list = byType.get(c.webhookType) || [];
    list.push(c);
    byType.set(c.webhookType, list);
  }
  const items = Array.from(byType.entries()).sort((a, b) => b[1].length - a[1].length);
  const icons: Record<string, string> = { SPORT_BET: "🏀", SPORT_PRIZE: "🏆", CASINO_BET: "🎰", CASINO_PRIZE: "💰", DEPOSIT: "💳", WITHDRAWAL_CONFIRMATION: "🏧", LOGIN: "🔐" };

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 shadow-sm px-6 py-3 space-y-2">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 shrink-0">
          <Bell className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alertas ativos</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {items.map(([type, list]) => (
            <button key={type} onClick={() => setExpanded(expanded === type ? null : type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors ${expanded === type ? "bg-primary/15 ring-1 ring-primary/30" : "bg-muted/50 hover:bg-muted"}`}>
              <span className="text-sm">{icons[type] ?? "📊"}</span>
              <span className="text-xs font-medium text-foreground">{webhookTypeLabels[type] ?? type}</span>
              <span className="text-xs font-bold text-primary ml-0.5">{list.length}</span>
            </button>
          ))}
        </div>
      </div>
      {expanded && byType.get(expanded) && (
        <div className="flex flex-wrap gap-1.5 pl-10">
          {byType.get(expanded)!.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {c.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [alertsStats, setAlertsStats] = useState<AlertsStats | null>(null);
  const [resolutionStats, setResolutionStats] = useState<ResolutionStats | null>(null);
  const [alertConfigs, setAlertConfigs] = useState<AlertConfigOption[]>([]);
  const [rankingByType, setRankingByType] = useState<RankingByType[]>([]);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [alertsByHour, setAlertsByHour] = useState<HourData[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [groupLockStats, setGroupLockStats] = useState<GroupLockStats | null>(null);
  const [slaByDay, setSlaByDay] = useState<SlaByDay[]>([]);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedAlertConfig, setSelectedAlertConfig] = useState("");
  const [selectedWebhookType, setSelectedWebhookType] = useState("");

  const applyPreset = (preset: string) => {
    const { start, end } = getPresetDates(preset);
    setStartDate(start);
    setEndDate(end);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (selectedWebhookType) params.set("webhookType", selectedWebhookType);

      const rankingParams = new URLSearchParams(params);
      if (selectedAlertConfig) rankingParams.set("alertConfigId", selectedAlertConfig);

      const [rankingData, alertsData, resData, configsData, rankingTypeData, trendsData, hourData, topUsersData, lockData, slaData] = await Promise.all([
        api.fetch<RankingItem[]>(`/reports/ranking?${rankingParams}`),
        api.fetch<AlertsStats>(`/reports/alerts-stats?${params}`),
        api.fetch<ResolutionStats>(`/reports/resolution-stats?${params}`),
        api.fetch<AlertConfigOption[]>("/reports/alert-configs"),
        api.fetch<RankingByType[]>(`/reports/ranking-by-type?${params}`),
        api.fetch<Trends>(`/reports/trends?${params}`),
        api.fetch<HourData[]>(`/reports/alerts-by-hour?${params}`),
        api.fetch<TopUser[]>(`/reports/top-users-alerted?${params}`),
        api.fetch<GroupLockStats>(`/reports/group-lock-stats?${params}`),
        api.fetch<SlaByDay[]>(`/reports/sla-by-day?${params}`),
      ]);

      setRanking(rankingData);
      setAlertsStats(alertsData);
      setResolutionStats(resData);
      setAlertConfigs(configsData);
      setRankingByType(rankingTypeData);
      setTrends(trendsData);
      setAlertsByHour(hourData);
      setTopUsers(topUsersData);
      setGroupLockStats(lockData);
      setSlaByDay(slaData);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [startDate, endDate, selectedAlertConfig, selectedWebhookType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pieData = resolutionStats ? [
    { name: "Abertas", value: resolutionStats.open, color: "#f59e0b" },
    { name: "Em Andamento", value: resolutionStats.inProgress, color: "#ef4444" },
    { name: "Concluidas", value: resolutionStats.done, color: "#10b981" },
  ].filter((d) => d.value > 0) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
          <FileBarChart className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Relatorios</h1>
          <p className="text-sm text-muted-foreground">Analise de alertas, tasks e performance</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
        <CardContent className="p-6 space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Inicio</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-44 h-9 rounded-lg text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Fim</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-44 h-9 rounded-lg text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Categoria</Label>
              <select className="flex h-9 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground" value={selectedWebhookType} onChange={(e) => setSelectedWebhookType(e.target.value)}>
                <option value="">Todas</option>
                {Object.entries(webhookTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Alerta</Label>
              <select className="flex h-9 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground" value={selectedAlertConfig} onChange={(e) => setSelectedAlertConfig(e.target.value)}>
                <option value="">Todos</option>
                {alertConfigs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Button variant="outline" size="sm" className="rounded-lg gap-1.5 h-9" onClick={() => { setStartDate(""); setEndDate(""); setSelectedAlertConfig(""); setSelectedWebhookType(""); }}>
              <FilterX className="h-3.5 w-3.5" /> Limpar
            </Button>
          </div>
          {/* Quick presets */}
          <div className="flex gap-2">
            {[["today", "Hoje"], ["7d", "7 dias"], ["30d", "30 dias"], ["month", "Este mes"]].map(([key, label]) => (
              <Button key={key} variant="ghost" size="sm" className="h-7 text-xs rounded-full px-3" onClick={() => applyPreset(key)}>
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Carregando relatorios...</span>
        </div>
      ) : (
        <>
          {/* ═══ Active alerts by sector ═══ */}
          <ActiveAlertsBysector configs={alertConfigs} />

          {/* ═══ KPI Cards with trends ═══ */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Total de Alertas", value: alertsStats?.total ?? 0, sub: "disparados", icon: Bell, iconBg: "bg-blue-500/10", iconColor: "text-blue-500", trend: trends?.alerts },
              { title: "Taxa de Resolucao", value: `${resolutionStats?.resolutionRate ?? 0}%`, sub: `${resolutionStats?.done ?? 0} de ${resolutionStats?.total ?? 0} tasks`, icon: Target, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-500", trend: trends?.resolved },
              { title: "SLA Medio", value: formatSla(resolutionStats?.sla.avgMinutes ?? 0), sub: "para resolver tasks", icon: Clock, iconBg: "bg-amber-500/10", iconColor: "text-amber-500", trend: trends?.sla, invertDelta: true },
              { title: "Tasks Abertas", value: (resolutionStats?.open ?? 0) + (resolutionStats?.inProgress ?? 0), sub: "pendentes", icon: ListTodo, iconBg: "bg-orange-500/10", iconColor: "text-orange-500", trend: trends?.tasks, invertDelta: true },
            ].map((card) => (
              <Card key={card.title} className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.iconBg}`}>
                      <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold text-foreground">{card.value}</span>
                    {card.trend && <DeltaBadge delta={card.trend.delta} invertColor={card.invertDelta} />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ═══ Group Lock Stats ═══ */}
          {groupLockStats && groupLockStats.totalLocks > 0 && (
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { title: "Bloqueios", value: groupLockStats.totalLocks, icon: Lock, color: "text-red-500", bg: "bg-red-500/10" },
                { title: "Tempo Medio Bloqueio", value: `${groupLockStats.avgLockSeconds}s`, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
                { title: "Grupos Ativos", value: groupLockStats.activeGroups, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
              ].map((s) => (
                <Card key={s.title} className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.bg}`}>
                        <s.icon className={`h-4 w-4 ${s.color}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{s.value}</p>
                        <p className="text-[11px] text-muted-foreground">{s.title}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ═══ Alerts by Day (Area) + Alerts by Hour ═══ */}
          <div className="grid gap-4 md:grid-cols-2">
            {(alertsStats?.byDay.length ?? 0) > 0 && (
              <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-foreground">Alertas por Dia</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={alertsStats!.byDay}>
                        <defs>
                          <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR")} />
                        <Area type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} fill="url(#colorAlerts)" name="Alertas" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {alertsByHour.some((h) => h.count > 0) && (
              <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-foreground">Pico de Alertas por Hora</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={alertsByHour}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(h) => `${h}h`} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={tooltipStyle} labelFormatter={(h) => `${h}:00 - ${h}:59`} />
                        <Bar dataKey="count" name="Alertas" radius={[4, 4, 0, 0]}>
                          {alertsByHour.map((entry, i) => {
                            const max = Math.max(...alertsByHour.map((h) => h.count));
                            const intensity = max > 0 ? entry.count / max : 0;
                            const color = intensity > 0.7 ? "#ef4444" : intensity > 0.4 ? "#f59e0b" : "#ef4444";
                            return <Cell key={i} fill={color} fillOpacity={Math.max(0.3, intensity)} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ═══ SLA Trend + Task Status Pie ═══ */}
          <div className="grid gap-4 md:grid-cols-2">
            {slaByDay.length > 0 && (
              <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-foreground">Tendencia SLA por Dia</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={slaByDay}>
                        <defs>
                          <linearGradient id="colorSla" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatSla(v)} />
                        <Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR")} formatter={(v) => [formatSla(Number(v)), "SLA Medio"]} />
                        <Area type="monotone" dataKey="avgSlaMinutes" stroke="#f59e0b" strokeWidth={2} fill="url(#colorSla)" name="SLA" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-foreground">Status das Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8"><p className="text-sm text-muted-foreground">Sem dados.</p></div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ═══ Alerts by Type Pie + Alerts by Config Bar ═══ */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-foreground">Alertas por Tipo</CardTitle>
              </CardHeader>
              <CardContent>
                {(alertsStats?.byType.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8"><p className="text-sm text-muted-foreground">Sem dados.</p></div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={alertsStats!.byType.map((d) => ({ ...d, name: webhookTypeLabels[d.type] || d.type }))} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="count" label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                          {alertsStats!.byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {(alertsStats?.byConfig.length ?? 0) > 0 && (
              <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-foreground">Disparos por Alerta</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={alertsStats!.byConfig.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="count" fill="#10b981" name="Disparos" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ═══ Ranking by Category ═══ */}
          {rankingByType.length > 0 && (
            <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10"><Target className="h-4 w-4 text-violet-500" /></div>
                  Ranking por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-6 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rankingByType.map((r) => ({ ...r, name: webhookTypeLabels[r.webhookType] || r.webhookType }))}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Bar dataKey="totalAlerts" fill="#ef4444" name="Alertas" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="totalResolved" fill="#10b981" name="Resolvidos" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-xl border border-border/30 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30">
                        {["Categoria", "Alertas", "Resolvidos", "Taxa", "SLA Medio"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {rankingByType.map((item) => (
                        <tr key={item.webhookType} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-foreground">{webhookTypeLabels[item.webhookType] || item.webhookType}</td>
                          <td className="px-4 py-3 text-sm text-foreground">{item.totalAlerts}</td>
                          <td className="px-4 py-3 text-sm text-foreground">{item.totalResolved}</td>
                          <td className="px-4 py-3"><Badge variant={item.resolutionRate >= 80 ? "default" : item.resolutionRate >= 50 ? "secondary" : "destructive"} className="rounded-lg text-[10px]">{item.resolutionRate}%</Badge></td>
                          <td className="px-4 py-3 text-sm text-foreground">{item.avgSlaMinutes > 0 ? formatSla(item.avgSlaMinutes) : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ═══ Collaborator Ranking + Top Alerted Users ═══ */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Ranking */}
            <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10"><Trophy className="h-4 w-4 text-amber-500" /></div>
                  Ranking de Colaboradores
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ranking.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-10">
                    <Trophy className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Nenhuma task concluida.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ranking.map((item, i) => (
                      <div key={item.userId} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-zinc-400 text-white" : i === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"}`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{item.userName}</p>
                          <p className="text-[11px] text-muted-foreground">{item.tasksCompleted} tasks - SLA {formatSla(item.avgSlaMinutes)}</p>
                        </div>
                        <span className="text-lg font-bold text-foreground">{item.tasksCompleted}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Alerted Users */}
            <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10"><Users className="h-4 w-4 text-red-500" /></div>
                  Top Usuarios Alertados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topUsers.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-10">
                    <Users className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Nenhum usuario no periodo.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {topUsers.slice(0, 10).map((user, i) => {
                      const maxCount = topUsers[0]?.count ?? 1;
                      const pct = (user.count / maxCount) * 100;
                      return (
                        <div key={user.userId} className="group relative px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                          <div className="absolute inset-y-0 left-0 rounded-lg bg-red-500/8" style={{ width: `${pct}%` }} />
                          <div className="relative flex items-center gap-3">
                            <span className="text-[11px] font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{user.userName}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{user.userUsername || user.userId}</p>
                            </div>
                            <Badge variant="destructive" className="rounded-lg text-[10px]">{user.count}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ═══ SLA by Collaborator ═══ */}
          {(resolutionStats?.slaByUser.length ?? 0) > 0 && (
            <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-foreground">SLA Medio por Colaborador</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={resolutionStats!.slaByUser} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis type="number" tickFormatter={(v) => formatSla(v)} tick={{ fontSize: 11 }} />
                      <YAxis dataKey="userName" type="category" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatSla(Number(v)), "SLA Medio"]} />
                      <Bar dataKey="avgSlaMinutes" fill="#f59e0b" name="SLA Medio" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ═══ Group Lock by Group ═══ */}
          {groupLockStats && groupLockStats.byGroup.length > 0 && (
            <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                  <Lock className="h-4 w-4 text-red-500" /> Bloqueios por Grupo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupLockStats.byGroup} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="locks" fill="#ef4444" name="Bloqueios" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
