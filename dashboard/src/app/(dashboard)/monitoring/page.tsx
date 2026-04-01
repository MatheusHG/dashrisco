"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { webhookTypeLabels } from "@/lib/field-labels";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bell, Users, Lock, ListTodo, CheckCircle, AlertTriangle, Activity,
  TrendingUp, Clock, ArrowRight, Zap, Settings, Monitor,
  GripVertical, Eye, EyeOff, RotateCcw, X, Search, Shield,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import Link from "next/link";
import { Responsive, WidthProvider } from "react-grid-layout";
import type { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

const COLORS = ["#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899"];
const tooltipStyle = { borderRadius: "12px", border: "1px solid var(--color-border)", backgroundColor: "var(--color-card)", color: "var(--color-foreground)" };

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

// ═══════════════════════════════════════
// WIDGET CATALOG
// ═══════════════════════════════════════
interface WidgetDef {
  id: string;
  label: string;
  description: string;
  icon: typeof Bell;
  category: string;
  defaultLayout: { w: number; h: number };
  minW?: number; minH?: number;
}

const WIDGET_CATALOG: WidgetDef[] = [
  // KPIs
  { id: "kpi_alerts", label: "KPI Alertas (24h)", description: "Alertas disparados nas ultimas 24h", icon: Bell, category: "KPIs", defaultLayout: { w: 3, h: 2 } },
  { id: "kpi_tasks_open", label: "KPI Tasks Abertas", description: "Tasks abertas e em andamento", icon: ListTodo, category: "KPIs", defaultLayout: { w: 3, h: 2 } },
  { id: "kpi_tasks_done", label: "KPI Tasks Concluidas", description: "Total de tasks resolvidas", icon: CheckCircle, category: "KPIs", defaultLayout: { w: 3, h: 2 } },
  { id: "kpi_groups", label: "KPI Grupos Bloqueio", description: "Grupos de bloqueio ativos", icon: Lock, category: "KPIs", defaultLayout: { w: 3, h: 2 } },
  // Monitoramento
  { id: "alerts_sector", label: "Alertas por Setor", description: "Alertas ativos agrupados por tipo", icon: Shield, category: "Monitoramento", defaultLayout: { w: 12, h: 2 } },
  { id: "recent_alerts", label: "Ultimos Alertas", description: "Lista dos alertas mais recentes", icon: Bell, category: "Monitoramento", defaultLayout: { w: 8, h: 5 }, minH: 3 },
  { id: "pending_tasks", label: "Tasks Pendentes", description: "Tasks abertas aguardando resolucao", icon: ListTodo, category: "Monitoramento", defaultLayout: { w: 4, h: 3 }, minH: 2 },
  { id: "top_configs", label: "Top Alertas (7d)", description: "Alertas que mais dispararam na semana", icon: TrendingUp, category: "Monitoramento", defaultLayout: { w: 4, h: 3 }, minH: 2 },
  // Graficos
  { id: "chart_trend", label: "Tendencia de Alertas", description: "Grafico dos ultimos 7 dias", icon: Activity, category: "Graficos", defaultLayout: { w: 8, h: 4 }, minH: 3 },
  { id: "chart_type", label: "Alertas por Tipo", description: "Pizza de distribuicao por tipo", icon: Zap, category: "Graficos", defaultLayout: { w: 4, h: 4 }, minH: 3 },
  // Feeds por tipo
  { id: "notif_locks", label: "Feed Bloqueios", description: "Notificacoes de grupos bloqueados", icon: Lock, category: "Feeds por Tipo", defaultLayout: { w: 6, h: 4 }, minH: 2 },
  { id: "notif_casino", label: "Feed Cassino", description: "Alertas de apostas/premios cassino", icon: Zap, category: "Feeds por Tipo", defaultLayout: { w: 6, h: 4 }, minH: 2 },
  { id: "notif_sport", label: "Feed Sportbook", description: "Alertas de apostas/premios esportivos", icon: Activity, category: "Feeds por Tipo", defaultLayout: { w: 6, h: 4 }, minH: 2 },
  { id: "notif_withdraw", label: "Feed Saques Aprovados", description: "Alertas de saques aprovados", icon: CheckCircle, category: "Feeds por Tipo", defaultLayout: { w: 6, h: 4 }, minH: 2 },
  { id: "notif_withdraw_req", label: "Feed Saques Pendentes", description: "Alertas de saques solicitados", icon: Clock, category: "Feeds por Tipo", defaultLayout: { w: 6, h: 4 }, minH: 2 },
  { id: "notif_deposit", label: "Feed Depositos", description: "Alertas de depositos", icon: ArrowRight, category: "Feeds por Tipo", defaultLayout: { w: 6, h: 4 }, minH: 2 },
  { id: "notif_login", label: "Feed Logins", description: "Alertas de login de usuarios", icon: Users, category: "Feeds por Tipo", defaultLayout: { w: 6, h: 4 }, minH: 2 },
  // Ferramentas
  { id: "search_client", label: "Busca Rapida", description: "Buscar cliente rapidamente", icon: Search, category: "Ferramentas", defaultLayout: { w: 4, h: 2 } },
];

const DEFAULT_VISIBLE = ["kpi_alerts", "kpi_tasks_open", "kpi_tasks_done", "kpi_groups", "alerts_sector", "chart_trend", "chart_type", "recent_alerts", "pending_tasks", "top_configs"];

function buildLayouts(visible: string[]): Layout[] {
  const layouts: Layout[] = [];
  let y = 0, rowX = 0;
  for (const id of visible) {
    const def = WIDGET_CATALOG.find((w) => w.id === id);
    if (!def) continue;
    const { w, h } = def.defaultLayout;
    if (rowX + w > 12) { rowX = 0; y += 2; }
    layouts.push({ i: id, x: rowX, y, w, h, minW: def.minW ?? 2, minH: def.minH ?? 2 });
    rowX += w;
    if (rowX >= 12) { rowX = 0; y += h; }
  }
  return layouts;
}

function loadConfig(userId: string) {
  try { const r = localStorage.getItem(`monitoring_${userId}`); if (r) return JSON.parse(r) as { visible: string[]; layouts: Layout[] }; } catch {} return null;
}
function saveConfig(userId: string, visible: string[], layouts: Layout[]) {
  localStorage.setItem(`monitoring_${userId}`, JSON.stringify({ visible, layouts }));
}

// ═══════════════════════════════════════
// UTILS
// ═══════════════════════════════════════
function formatTime(d: string) { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return "agora"; if (m < 60) return `${m}min`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`; }

function FeedWidget({ alerts, title, icon: Icon, color }: { alerts: Stats["recentAlerts"]; title: string; icon: typeof Bell; color: string }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1.5 mb-2 px-1"><Icon className={`h-3.5 w-3.5 ${color}`} /><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</span><Badge variant="secondary" className="text-[9px] ml-auto">{alerts.length}</Badge></div>
      <div className="flex-1 overflow-y-auto space-y-1">
        {alerts.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Nenhum alerta</p> : alerts.map((a) => (
          <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors">
            <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
            <div className="flex-1 min-w-0"><p className="text-[11px] text-foreground truncate">{a.userName || a.title}</p><p className="text-[10px] text-muted-foreground">{a.alertConfig?.name}</p></div>
            <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(a.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// PAGE
// ═══════════════════════════════════════
export default function MonitoringPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [editing, setEditing] = useState(false);
  const [visible, setVisible] = useState<string[]>(DEFAULT_VISIBLE);
  const [layouts, setLayouts] = useState<Layout[]>(buildLayouts(DEFAULT_VISIBLE));

  useEffect(() => { if (!user?.id) return; const c = loadConfig(user.id); if (c) { setVisible(c.visible); setLayouts(c.layouts); } }, [user?.id]);
  useEffect(() => { api.fetch<Stats>("/dashboard/stats").then(setStats).catch(console.error); }, []);

  const onLayoutChange = useCallback((nl: Layout[]) => { setLayouts(nl); if (user?.id) saveConfig(user.id, visible, nl); }, [user?.id, visible]);
  const toggleWidget = useCallback((id: string) => {
    setVisible((prev) => {
      const next = prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id];
      const nl = prev.includes(id) ? layouts.filter((l) => l.i !== id) : [...layouts, ...buildLayouts([id]).map((l) => ({ ...l, y: Infinity }))];
      setLayouts(nl); if (user?.id) saveConfig(user.id, next, nl); return next;
    });
  }, [layouts, user?.id]);
  const resetLayout = useCallback(() => { setVisible(DEFAULT_VISIBLE); const nl = buildLayouts(DEFAULT_VISIBLE); setLayouts(nl); if (user?.id) saveConfig(user.id, DEFAULT_VISIBLE, nl); setShowConfig(false); }, [user?.id]);

  const feedAlerts = useMemo(() => {
    if (!stats) return { locks: [], casino: [], sport: [], withdraw: [], withdrawReq: [], deposit: [], login: [] };
    const a = stats.recentAlerts;
    return { locks: [] as typeof a, casino: a.filter((x) => x.webhookType === "CASINO_BET" || x.webhookType === "CASINO_PRIZE"), sport: a.filter((x) => x.webhookType === "SPORT_BET" || x.webhookType === "SPORT_PRIZE"), withdraw: a.filter((x) => x.webhookType === "WITHDRAWAL_CONFIRMATION"), withdrawReq: a.filter((x) => x.webhookType === "WITHDRAWAL_REQUEST"), deposit: a.filter((x) => x.webhookType === "DEPOSIT"), login: a.filter((x) => x.webhookType === "LOGIN") };
  }, [stats]);

  const categories = useMemo(() => { const m = new Map<string, WidgetDef[]>(); for (const w of WIDGET_CATALOG) { const l = m.get(w.category) || []; l.push(w); m.set(w.category, l); } return m; }, []);

  const s = stats;

  const renderWidget = (id: string) => {
    if (!s) return <div className="flex items-center justify-center h-full"><div className="h-4 w-24 bg-muted animate-pulse rounded" /></div>;
    switch (id) {
      case "kpi_alerts": return (<div className="p-4 h-full flex flex-col justify-center"><div className="flex items-center justify-between mb-1"><span className="text-xs text-muted-foreground">Alertas (24h)</span><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10"><Bell className="h-3.5 w-3.5 text-blue-500" /></div></div><p className="text-3xl font-bold">{s.alertsTriggered24h}</p><p className="text-[10px] text-muted-foreground">{s.alertsActive} configs ativas</p></div>);
      case "kpi_tasks_open": return (<div className="p-4 h-full flex flex-col justify-center"><div className="flex items-center justify-between mb-1"><span className="text-xs text-muted-foreground">Tasks Abertas</span><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/10"><ListTodo className="h-3.5 w-3.5 text-orange-500" /></div></div><p className="text-3xl font-bold">{s.tasksOpen + s.tasksInProgress}</p><p className="text-[10px] text-muted-foreground">{s.tasksInProgress} em andamento</p></div>);
      case "kpi_tasks_done": return (<div className="p-4 h-full flex flex-col justify-center"><div className="flex items-center justify-between mb-1"><span className="text-xs text-muted-foreground">Tasks Concluidas</span><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10"><CheckCircle className="h-3.5 w-3.5 text-emerald-500" /></div></div><p className="text-3xl font-bold">{s.tasksDone}</p><p className="text-[10px] text-muted-foreground">total resolvidas</p></div>);
      case "kpi_groups": return (<div className="p-4 h-full flex flex-col justify-center"><div className="flex items-center justify-between mb-1"><span className="text-xs text-muted-foreground">Grupos Bloqueio</span><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10"><Lock className="h-3.5 w-3.5 text-violet-500" /></div></div><p className="text-3xl font-bold">{s.groupsActive}</p><p className="text-[10px] text-muted-foreground">{s.usersCount} usuarios</p></div>);
      case "alerts_sector": {
        const icons: Record<string, string> = { SPORT_BET: "🏀", SPORT_PRIZE: "🏆", CASINO_BET: "🎰", CASINO_PRIZE: "💰", DEPOSIT: "💳", WITHDRAWAL_CONFIRMATION: "🏧", WITHDRAWAL_REQUEST: "📋", LOGIN: "🔐" };
        return (<div className="p-4 h-full"><div className="flex items-center gap-2 mb-2"><Bell className="h-3.5 w-3.5 text-blue-500" /><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alertas ativos por setor</span></div><div className="flex items-center gap-2 flex-wrap">{s.alertsActiveByType.map((item) => (<div key={item.type} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/50"><span className="text-sm">{icons[item.type] ?? "📊"}</span><span className="text-xs font-medium">{webhookTypeLabels[item.type] || item.type}</span><span className="text-xs font-bold text-primary">{item.count}</span></div>))}</div></div>);
      }
      case "chart_trend": return (<div className="p-4 h-full flex flex-col"><div className="flex items-center justify-between mb-2"><span className="text-sm font-semibold">Alertas - 7 dias</span><Badge variant="secondary" className="text-[10px]">{s.alertsThisWeek} total</Badge></div><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={s.alertsByDay}><defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} /><YAxis tick={{ fontSize: 10 }} allowDecimals={false} /><Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR")} /><Area type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} fill="url(#grad)" name="Alertas" /></AreaChart></ResponsiveContainer></div></div>);
      case "chart_type": return (<div className="p-4 h-full flex flex-col"><span className="text-sm font-semibold mb-2">Por Tipo</span>{s.alertsByType.length === 0 ? <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Sem dados</div> : (<><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={s.alertsByType.map((d) => ({ ...d, name: webhookTypeLabels[d.type] || d.type }))} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="count">{s.alertsByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer></div><div className="space-y-1 mt-1">{s.alertsByType.slice(0, 5).map((t, i) => (<div key={t.type} className="flex items-center justify-between text-[11px]"><div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} /><span className="text-muted-foreground">{webhookTypeLabels[t.type] || t.type}</span></div><span className="font-semibold">{t.count}</span></div>))}</div></>)}</div>);
      case "recent_alerts": return (<div className="h-full flex flex-col"><div className="flex items-center justify-between px-4 pt-3 pb-1"><span className="text-sm font-semibold flex items-center gap-1.5"><Bell className="h-4 w-4 text-blue-500" />Ultimos Alertas</span><Link href="/panel/alerts" className="text-xs text-primary hover:underline flex items-center gap-0.5">Ver todos<ArrowRight className="h-3 w-3" /></Link></div><div className="flex-1 overflow-y-auto divide-y divide-border/30">{s.recentAlerts.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Nenhum alerta</p> : s.recentAlerts.map((a) => (<div key={a.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10"><Zap className="h-3 w-3 text-blue-500" /></div><div className="flex-1 min-w-0"><p className="text-xs text-foreground truncate">{a.title}</p><div className="flex items-center gap-2 mt-0.5"><Badge variant="outline" className="text-[9px] rounded px-1 py-0">{webhookTypeLabels[a.webhookType] || a.webhookType}</Badge>{a.userName && <span className="text-[10px] text-muted-foreground">{a.userName}</span>}</div></div><span className="text-[10px] text-muted-foreground shrink-0">{formatTime(a.createdAt)}</span></div>))}</div></div>);
      case "pending_tasks": return (<div className="h-full flex flex-col"><div className="flex items-center justify-between px-4 pt-3 pb-1"><span className="text-sm font-semibold flex items-center gap-1.5"><ListTodo className="h-4 w-4 text-orange-500" />Tasks Pendentes</span><Link href="/panel/tasks" className="text-xs text-primary hover:underline flex items-center gap-0.5">Ver<ArrowRight className="h-3 w-3" /></Link></div><div className="flex-1 overflow-y-auto px-4 pb-2">{s.recentTasks.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Nenhuma task</p> : <div className="space-y-1.5">{s.recentTasks.map((t) => { const st = STATUS_STYLES[t.status] ?? STATUS_STYLES.open; return (<Link key={t.id} href="/panel/tasks" className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">{t.priority <= 2 && <AlertTriangle className={`h-3 w-3 shrink-0 ${t.priority === 1 ? "text-red-500" : "text-orange-500"}`} />}<div className="flex-1 min-w-0"><p className="text-[11px] font-medium truncate">{t.title}</p><span className={`text-[9px] font-semibold px-1.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span></div><span className="text-[10px] text-muted-foreground">{formatTime(t.createdAt)}</span></Link>); })}</div>}</div></div>);
      case "top_configs": return (<div className="p-4 h-full flex flex-col"><span className="text-sm font-semibold mb-2">Top Alertas (7d)</span><div className="flex-1 overflow-y-auto space-y-1.5">{s.topConfigs.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p> : s.topConfigs.map((c, i) => { const max = s.topConfigs[0]?.count ?? 1; return (<div key={c.alertConfigId} className="relative rounded-lg overflow-hidden"><div className="absolute inset-0 rounded-lg bg-primary/5" style={{ width: `${(c.count / max) * 100}%` }} /><div className="relative flex items-center justify-between px-3 py-1.5"><div className="flex items-center gap-2"><span className="text-[10px] font-bold text-muted-foreground w-4">{i + 1}</span><span className="text-xs font-medium truncate">{c.name}</span></div><Badge variant="secondary" className="text-[10px]">{c.count}</Badge></div></div>); })}</div></div>);
      case "notif_locks": return <div className="p-4 h-full"><FeedWidget alerts={feedAlerts.locks} title="Bloqueios" icon={Lock} color="text-red-500" /></div>;
      case "notif_casino": return <div className="p-4 h-full"><FeedWidget alerts={feedAlerts.casino} title="Cassino" icon={Zap} color="text-purple-500" /></div>;
      case "notif_sport": return <div className="p-4 h-full"><FeedWidget alerts={feedAlerts.sport} title="Sportbook" icon={Activity} color="text-blue-500" /></div>;
      case "notif_withdraw": return <div className="p-4 h-full"><FeedWidget alerts={feedAlerts.withdraw} title="Saques Aprovados" icon={CheckCircle} color="text-red-500" /></div>;
      case "notif_withdraw_req": return <div className="p-4 h-full"><FeedWidget alerts={feedAlerts.withdrawReq} title="Saques Pendentes" icon={Clock} color="text-orange-500" /></div>;
      case "notif_deposit": return <div className="p-4 h-full"><FeedWidget alerts={feedAlerts.deposit} title="Depositos" icon={ArrowRight} color="text-green-500" /></div>;
      case "notif_login": return <div className="p-4 h-full"><FeedWidget alerts={feedAlerts.login} title="Logins" icon={Users} color="text-cyan-500" /></div>;
      case "search_client": return (<div className="p-4 h-full flex flex-col justify-center"><span className="text-xs font-semibold text-muted-foreground mb-2">Busca Rapida</span><Link href="/clients" className="flex items-center gap-2 h-10 px-3 rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"><Search className="h-4 w-4" />Buscar cliente por nome, CPF...</Link></div>);
      default: return <div className="p-4 text-sm text-muted-foreground">Widget desconhecido</div>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Monitor className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Monitoramento</h1>
            <p className="text-sm text-muted-foreground">Painel personalizado — arraste e redimensione os widgets</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={editing ? "default" : "outline"} size="sm" className="rounded-xl gap-1.5" onClick={() => setEditing(!editing)}>
            {editing ? <><CheckCircle className="h-3.5 w-3.5" />Pronto</> : <><GripVertical className="h-3.5 w-3.5" />Editar Layout</>}
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setShowConfig(!showConfig)}>
            <Settings className="h-3.5 w-3.5" /> Widgets
          </Button>
        </div>
      </div>

      {/* Widget config panel */}
      {showConfig && (
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div><p className="text-sm font-semibold">Configurar Widgets</p><p className="text-xs text-muted-foreground">Selecione quais widgets exibir no seu painel</p></div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="rounded-lg gap-1 text-xs" onClick={resetLayout}><RotateCcw className="h-3 w-3" /> Resetar</Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowConfig(false)}><X className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-4">
              {Array.from(categories.entries()).map(([cat, widgets]) => (
                <div key={cat}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {widgets.map((w) => {
                      const active = visible.includes(w.id);
                      const Icon = w.icon;
                      return (
                        <button key={w.id} onClick={() => toggleWidget(w.id)}
                          className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${active ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/50 opacity-60"}`}>
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-primary/10" : "bg-muted"}`}>
                            <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{w.label}</p><p className="text-[10px] text-muted-foreground truncate">{w.description}</p></div>
                          {active ? <Eye className="h-3.5 w-3.5 text-primary shrink-0" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {editing && <p className="text-xs text-muted-foreground text-center animate-pulse">Arraste para reposicionar e redimensione pelos cantos</p>}

      {/* Grid */}
      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: layouts }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={60}
        isDraggable={editing}
        isResizable={editing}
        onLayoutChange={onLayoutChange}
        draggableHandle=".widget-drag-handle"
        compactType="vertical"
        useCSSTransforms
      >
        {visible.map((id) => (
          <div key={id}>
            <Card className={`rounded-2xl border-border/50 bg-card/80 shadow-sm h-full overflow-hidden ${editing ? "ring-1 ring-primary/20" : ""}`}>
              {editing && (
                <div className="widget-drag-handle flex items-center justify-between px-3 py-1 bg-muted/30 border-b border-border/30 cursor-grab active:cursor-grabbing">
                  <div className="flex items-center gap-1.5"><GripVertical className="h-3 w-3 text-muted-foreground" /><span className="text-[10px] font-medium text-muted-foreground">{WIDGET_CATALOG.find((w) => w.id === id)?.label}</span></div>
                  <button onClick={() => toggleWidget(id)} className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                </div>
              )}
              <div className={editing ? "h-[calc(100%-28px)]" : "h-full"}>{renderWidget(id)}</div>
            </Card>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
