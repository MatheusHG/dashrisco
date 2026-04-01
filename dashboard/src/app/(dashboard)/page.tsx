"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bell, Users, Lock, ListTodo, CheckCircle, AlertTriangle, Activity,
  TrendingUp, TrendingDown, Minus, Clock, ArrowRight, Zap,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import Link from "next/link";

const COLORS = ["#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899"];
const tooltipStyle = { borderRadius: "12px", border: "1px solid var(--color-border)", backgroundColor: "var(--color-card)", color: "var(--color-foreground)" };

const webhookTypeLabels: Record<string, string> = {
  CASINO_BET: "Cassino Bet", CASINO_PRIZE: "Cassino Prize", SPORT_BET: "Sport Bet",
  SPORT_PRIZE: "Sport Prize", LOGIN: "Login", DEPOSIT: "Deposito", WITHDRAWAL_CONFIRMATION: "Saque",
};

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  open: { label: "Aberta", bg: "bg-yellow-500/15", text: "text-yellow-700 dark:text-yellow-400" },
  in_progress: { label: "Em Andamento", bg: "bg-blue-500/15", text: "text-blue-700 dark:text-blue-400" },
};

interface Stats {
  alertsActive: number; alertsTriggered24h: number; groupsActive: number;
  usersCount: number; tasksOpen: number; tasksDone: number; tasksInProgress: number;
  alertsThisWeek: number; alertsDelta: number;
  alertsByDay: Array<{ date: string; count: number }>;
  alertsByType: Array<{ type: string; count: number }>;
  alertsActiveByType: Array<{ type: string; count: number; configs: Array<{ id: string; name: string }> }>;
  recentAlerts: Array<{ id: string; webhookType: string; title: string; createdAt: string; userName: string | null; alertConfig: { name: string } | null }>;
  recentTasks: Array<{ id: string; title: string; status: string; priority: number; createdAt: string; assignedUserName: string | null }>;
  topConfigs: Array<{ alertConfigId: string; name: string; count: number }>;
}

function formatTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function ActiveAlertsSector({ items }: { items: Array<{ type: string; count: number; configs: Array<{ id: string; name: string }> }> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const icons: Record<string, string> = { SPORT_BET: "🏀", SPORT_PRIZE: "🏆", CASINO_BET: "🎰", CASINO_PRIZE: "💰", DEPOSIT: "💳", WITHDRAWAL_CONFIRMATION: "🏧", LOGIN: "🔐" };
  const labels: Record<string, string> = { SPORT_BET: "Sportbook", SPORT_PRIZE: "Sport Prize", CASINO_BET: "Cassino", CASINO_PRIZE: "Casino Prize", DEPOSIT: "Deposito", WITHDRAWAL_CONFIRMATION: "Saque", LOGIN: "Login" };

  return (
    <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
      <CardContent className="py-4 px-6 space-y-2">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <Bell className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alertas ativos por setor</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {items.map((item) => (
              <button key={item.type} onClick={() => setExpanded(expanded === item.type ? null : item.type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors ${expanded === item.type ? "bg-primary/15 ring-1 ring-primary/30" : "bg-muted/50 hover:bg-muted"}`}>
                <span className="text-sm">{icons[item.type] ?? "📊"}</span>
                <span className="text-xs font-medium text-foreground">{labels[item.type] ?? item.type}</span>
                <span className="text-xs font-bold text-primary ml-0.5">{item.count}</span>
              </button>
            ))}
          </div>
        </div>
        {expanded && (() => {
          const found = items.find((i) => i.type === expanded);
          if (!found) return null;
          return (
            <div className="flex flex-wrap gap-1.5 pl-10">
              {found.configs.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {c.name}
                </span>
              ))}
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.fetch<Stats>("/dashboard/stats").then(setStats).catch(console.error);
  }, []);

  const s = stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Ola, {user?.name}
            </h1>
            <p className="text-sm text-muted-foreground">Central de Alertas e Monitoramento</p>
          </div>
        </div>
        {s && (
          <div className="hidden md:flex items-center gap-2">
            <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold ${s.alertsDelta > 0 ? "bg-red-500/10 text-red-600" : s.alertsDelta < 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
              {s.alertsDelta > 0 ? <TrendingUp className="h-3 w-3" /> : s.alertsDelta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {s.alertsDelta > 0 ? "+" : ""}{s.alertsDelta}% vs semana anterior
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {s ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Alertas (24h)", value: s.alertsTriggered24h, sub: `${s.alertsActive} configs ativas`, icon: Bell, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Tasks Abertas", value: s.tasksOpen + s.tasksInProgress, sub: `${s.tasksInProgress} em andamento`, icon: ListTodo, color: "text-orange-500", bg: "bg-orange-500/10" },
            { label: "Tasks Concluidas", value: s.tasksDone, sub: "total resolvidas", icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: "Grupos Bloqueio", value: s.groupsActive, sub: `${s.usersCount} usuarios`, icon: Lock, color: "text-violet-500", bg: "bg-violet-500/10" },
          ].map((card) => (
            <Card key={card.label} className="rounded-2xl border-border/50 bg-card/80 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{card.label}</CardTitle>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.bg}`}><card.icon className={`h-4 w-4 ${card.color}`} /></div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">{card.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{card.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map((i) => <Card key={i} className="rounded-2xl h-28"><CardContent className="p-6"><div className="h-4 w-24 bg-muted animate-pulse rounded" /><div className="h-8 w-16 bg-muted animate-pulse rounded mt-3" /></CardContent></Card>)}
        </div>
      )}

      {/* Active alerts by sector */}
      {s && s.alertsActiveByType.length > 0 && <ActiveAlertsSector items={s.alertsActiveByType} />}

      {/* Charts row */}
      {s && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Alerts trend (7 days) */}
          <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm md:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-foreground">Alertas - Ultimos 7 dias</CardTitle>
                <Badge variant="secondary" className="text-[10px] rounded-lg">{s.alertsThisWeek} total</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={s.alertsByDay}>
                    <defs>
                      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR")} />
                    <Area type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} fill="url(#grad)" name="Alertas" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Alerts by type (pie) */}
          <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground">Por Tipo</CardTitle>
            </CardHeader>
            <CardContent>
              {s.alertsByType.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">Sem dados</div>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={s.alertsByType.map((d) => ({ ...d, name: webhookTypeLabels[d.type] || d.type }))} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="count">
                        {s.alertsByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="space-y-1 mt-2">
                {s.alertsByType.slice(0, 4).map((t, i) => (
                  <div key={t.type} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground">{webhookTypeLabels[t.type] || t.type}</span>
                    </div>
                    <span className="font-semibold text-foreground">{t.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom row: Recent alerts + Tasks + Top configs */}
      {s && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Recent alerts */}
          <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm md:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-foreground flex items-center gap-1.5"><Bell className="h-4 w-4 text-blue-500" /> Ultimos Alertas</CardTitle>
                <Link href="/panel/alerts" className="text-xs text-primary hover:underline flex items-center gap-0.5">Ver todos <ArrowRight className="h-3 w-3" /></Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/30">
                {s.recentAlerts.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Nenhum alerta recente</div>
                ) : s.recentAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-center gap-3 px-6 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                      <Zap className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{alert.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[9px] rounded px-1 py-0">{webhookTypeLabels[alert.webhookType] || alert.webhookType}</Badge>
                        {alert.alertConfig && <span className="text-[10px] text-muted-foreground">{alert.alertConfig.name}</span>}
                        {alert.userName && <span className="text-[10px] text-muted-foreground">- {alert.userName}</span>}
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">{formatTime(alert.createdAt)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Right column: Tasks + Top configs */}
          <div className="space-y-4">
            {/* Pending tasks */}
            <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm text-foreground flex items-center gap-1.5"><ListTodo className="h-4 w-4 text-orange-500" /> Tasks Pendentes</CardTitle>
                  <Link href="/panel/tasks" className="text-xs text-primary hover:underline flex items-center gap-0.5">Ver <ArrowRight className="h-3 w-3" /></Link>
                </div>
              </CardHeader>
              <CardContent>
                {s.recentTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma task pendente</p>
                ) : (
                  <div className="space-y-2">
                    {s.recentTasks.map((task) => {
                      const st = STATUS_STYLES[task.status] ?? STATUS_STYLES.open;
                      return (
                        <Link key={task.id} href="/panel/tasks" className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-muted/50 transition-colors group">
                          {task.priority <= 2 && <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${task.priority === 1 ? "text-red-500" : "text-orange-500"}`} />}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{task.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[9px] font-semibold px-1.5 py-0 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                              {task.assignedUserName && <span className="text-[10px] text-muted-foreground">{task.assignedUserName}</span>}
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{formatTime(task.createdAt)}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top alert configs */}
            {s.topConfigs.length > 0 && (
              <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-foreground">Top Alertas (7d)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {s.topConfigs.map((cfg, i) => {
                      const max = s.topConfigs[0]?.count ?? 1;
                      const pct = (cfg.count / max) * 100;
                      return (
                        <div key={cfg.alertConfigId} className="relative rounded-lg overflow-hidden">
                          <div className="absolute inset-0 rounded-lg bg-primary/5" style={{ width: `${pct}%` }} />
                          <div className="relative flex items-center justify-between px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground w-4">{i + 1}</span>
                              <span className="text-xs font-medium text-foreground truncate">{cfg.name}</span>
                            </div>
                            <Badge variant="secondary" className="text-[10px] rounded-lg">{cfg.count}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
