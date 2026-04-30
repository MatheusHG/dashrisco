"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { webhookTypeLabels } from "@/lib/field-labels";
import { parseCommentImageUrls } from "@/lib/comment-images";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Search, UserSearch, Bell, ListTodo, Clock, CalendarDays, Eye, EyeOff, Loader2, UserX,
  BarChart3, Shield, ShieldOff, DollarSign, TrendingUp, TrendingDown, Wallet,
  MessageSquare, User, X, Send, Trash2, Pencil, Check, History,
  ArrowRight, UserPlus, UserMinus, AlertTriangle, FileText, Type, Minus,
  Lock, Users, Plus, ExternalLink,
} from "lucide-react";

// ═══ Types ═══

const lockLabels: Record<string, string> = {
  bet: "Aposta", bonus_bet: "Bonus", casino_bet: "Cassino",
  deposit: "Deposito", withdraw: "Saque", esport_bet: "E-sport",
};

interface PanelAlertItem { id: string; webhookType: string; title: string; message: string; data: Record<string, unknown>; createdAt: string; alertConfig: { id: string; name: string } | null; }
interface PanelTaskItem { id: string; title: string; description: string | null; status: string; priority: number; data: Record<string, unknown> | null; assignedTo: string | null; completedBy: string | null; createdAt: string; updatedAt: string; completedAt: string | null; assignedUserName: string | null; completedByName: string | null; _count?: { comments: number }; }
interface Summary { totalAlerts: number; totalTasks: number; tasksOpen: number; tasksDone: number; byType: Array<{ type: string; count: number }>; byConfig: Array<{ alertConfigId: string; name: string; count: number }>; firstAlertAt: string | null; lastAlertAt: string | null; }
interface SearchResult { alerts: PanelAlertItem[]; tasks: PanelTaskItem[]; summary: Summary | null; }
interface ClientProfile { profile: Record<string, unknown> | null; financials: { totalDeposits: number; totalDeposited: number; totalWithdrawals: number; totalWithdrawn: number; netPnl: number; totalSportBets: number; totalCasinoBets: number; biggestCasinoWin: number; biggestSportWin: number; }; recentDeposits: Array<{ value: number; createdAt: string }>; recentWithdrawals: Array<{ value: number; createdAt: string }>; }
interface TaskComment { id: string; userId: string | null; userName: string; message: string; imageUrl: string | null; createdAt: string; }
interface TaskDetail { id: string; title: string; description: string | null; status: string; priority: number; data: Record<string, unknown> | null; assignedTo: string | null; completedBy: string | null; completedAt: string | null; createdAt: string; updatedAt: string; comments: TaskComment[]; assignedUser: { id: string; name: string } | null; completedByUser: { id: string; name: string } | null; allUsers: { id: string; name: string }[]; }
interface HistoryEntry { id: string; action: string; details: Record<string, unknown> | null; createdAt: string; user: { id: string; name: string } | null; }

interface GroupInfo {
  groupId: string; groupName: string; active: boolean; lockSeconds: number;
  memberCount: number; totalLocks: number; userTriggers: number;
  lastLockAt: string | null;
  locksByHour: Array<{ hour: number; count: number }>;
  members: Array<{ ngxUserId: string; ngxName: string | null; isCurrentUser: boolean }>;
}
interface AvailableGroup { id: string; name: string; _count: { members: number }; }
interface GroupInfoResult { groups: GroupInfo[]; availableGroups: AvailableGroup[]; }

const fmtBrl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  open: { label: "Aberta", bg: "bg-yellow-500/15", text: "text-yellow-700 dark:text-yellow-400" },
  in_progress: { label: "Em Andamento", bg: "bg-blue-500/15", text: "text-blue-700 dark:text-blue-400" },
  done: { label: "Concluida", bg: "bg-green-500/15", text: "text-green-700 dark:text-green-400" },
};

const PRIORITY_LABELS: Record<number, string> = { 1: "Urgente", 2: "Alta", 3: "Normal", 4: "Baixa" };

// ═══ Task Detail Modal (reused from tasks page) ═══
function TaskModal({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const fetchTask = useCallback(async () => {
    try {
      const [data, hist] = await Promise.all([
        api.fetch<TaskDetail>(`/panel/tasks/${taskId}`),
        api.fetch<HistoryEntry[]>(`/panel/tasks/${taskId}/history`),
      ]);
      setTask(data);
      setHistory(hist);
      setDescDraft(data.description ?? "");
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [taskId]);

  useEffect(() => { fetchTask(); }, [fetchTask]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const updateField = async (field: string, value: unknown) => {
    await api.fetch(`/panel/tasks/${taskId}`, { method: "PUT", body: JSON.stringify({ [field]: value }) });
    await fetchTask();
  };

  const addComment = async () => {
    if (!newComment.trim() || sending) return;
    setSending(true);
    try {
      await api.fetch(`/panel/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ message: newComment.trim() }) });
      setNewComment("");
      await fetchTask();
    } finally { setSending(false); }
  };

  const deleteComment = async (id: string) => {
    await api.fetch(`/panel/tasks/${taskId}/comments/${id}`, { method: "DELETE" });
    await fetchTask();
  };

  const saveDesc = () => {
    const val = descDraft.trim() || null;
    if (val !== (task?.description ?? null)) updateField("description", val);
    setEditingDesc(false);
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card rounded-2xl p-8 text-sm text-muted-foreground">Carregando...</div>
    </div>
  );
  if (!task) { onClose(); return null; }

  const statusStyle = STATUS_STYLES[task.status] ?? STATUS_STYLES.open;

  // Build unified timeline
  type TItem = { kind: "comment"; id: string; userName: string; message: string; imageUrl: string | null; commentId: string; createdAt: string } | { kind: "event"; id: string; action: string; details: Record<string, unknown> | null; userName: string; createdAt: string };
  const timeline: TItem[] = [];
  for (const c of task.comments) timeline.push({ kind: "comment", id: `c-${c.id}`, userName: c.userName, message: c.message, imageUrl: c.imageUrl, commentId: c.id, createdAt: c.createdAt });
  for (const h of history) timeline.push({ kind: "event", id: `h-${h.id}`, action: h.action, details: h.details, userName: h.user?.name ?? "Sistema", createdAt: h.createdAt });
  timeline.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div ref={backdropRef} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[5vh] pb-8 overflow-y-auto" onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-[820px] mx-4">
        {/* Header */}
        <div className="px-8 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                  {statusStyle.label}
                </span>
                <span className="text-[11px] text-muted-foreground">Prioridade: {PRIORITY_LABELS[task.priority]}</span>
              </div>
              <h2 className="text-lg font-bold text-foreground">{task.title}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_240px] border-t border-border">
          {/* Left */}
          <div className="p-6 space-y-5 border-r border-border">
            {/* Description */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Descricao</p>
              {editingDesc ? (
                <div className="space-y-2">
                  <textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} rows={3} autoFocus className="w-full rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm resize-y min-h-[60px] outline-none focus:ring-2 focus:ring-primary/30" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveDesc} className="h-7 text-xs">Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setDescDraft(task.description ?? ""); setEditingDesc(false); }} className="h-7 text-xs">Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-foreground cursor-text rounded-lg p-3 bg-muted/30 hover:bg-muted/50 transition-colors min-h-[40px] whitespace-pre-wrap" onClick={() => setEditingDesc(true)}>
                  {task.description || <span className="text-muted-foreground">Clique para adicionar descricao...</span>}
                </div>
              )}
            </div>

            {/* Activity */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Atividade</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-[11px] text-muted-foreground">{showHistory ? "Todos" : "So comentarios"}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showHistory}
                    onClick={() => setShowHistory(!showHistory)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showHistory ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${showHistory ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
                  </button>
                  <span className="text-[11px] text-muted-foreground">Historico</span>
                </label>
              </div>
              <div className="flex gap-3 mb-4">
                <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">U</div>
                <div className="flex-1 relative">
                  <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Escrever comentario..." rows={1}
                    className="w-full rounded-lg border border-input bg-muted/30 px-3 py-2.5 pr-10 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/30"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(); } }} />
                  <button onClick={addComment} disabled={!newComment.trim() || sending}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-primary hover:bg-primary/10 disabled:opacity-30">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-0 max-h-[400px] overflow-y-auto">
                {(() => {
                  const filtered = showHistory ? timeline : timeline.filter((i) => i.kind === "comment");
                  return filtered.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">{showHistory ? "Nenhuma atividade" : "Nenhum comentario"}</p> : filtered.map((item, idx) => {
                  const isLast = idx === filtered.length - 1;
                  if (item.kind === "comment") return (
                    <div key={item.id} className="flex gap-3 relative group">
                      {!isLast && <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />}
                      <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">{item.userName.charAt(0).toUpperCase()}</div>
                      <div className="flex-1 min-w-0 pb-4">
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold">{item.userName}</span>
                            <span className="text-[10px] text-muted-foreground">{fmtDate(item.createdAt)}</span>
                            <button className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={() => deleteComment(item.commentId)}><Trash2 className="h-3 w-3" /></button>
                          </div>
                          {item.message && <p className="text-sm whitespace-pre-wrap">{item.message}</p>}
                          {(() => {
                            const urls = parseCommentImageUrls(item.imageUrl);
                            if (urls.length === 0) return null;
                            return (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {urls.map((url, ui) => (
                                  <img key={ui} src={url} alt={`Imagem ${ui + 1}`} className="max-h-48 rounded-lg border border-border" />
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                  // Event
                  const iconMap: Record<string, typeof ArrowRight> = { "task.status_changed": ArrowRight, "task.assigned": UserPlus, "task.unassigned": UserMinus, "task.priority_changed": AlertTriangle, "task.title_changed": Type, "task.description_changed": FileText, "task.comment_added": MessageSquare };
                  const Icon = iconMap[item.action] ?? History;
                  const d = item.details ?? {};
                  let desc = item.action.replace("task.", "");
                  if (item.action === "task.status_changed") desc = `alterou status: ${d.from} → ${d.to}`;
                  else if (item.action === "task.assigned") desc = `atribuiu para ${d.to}`;
                  else if (item.action === "task.unassigned") desc = `removeu responsavel`;
                  else if (item.action === "task.priority_changed") desc = `prioridade: ${d.from} → ${d.to}`;
                  else if (item.action === "task.description_changed") desc = "editou descricao";
                  else if (item.action === "task.comment_added") desc = "comentou";
                  return (
                    <div key={item.id} className="flex gap-3 relative">
                      {!isLast && <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card z-10"><Icon className="h-3 w-3 text-muted-foreground" /></div>
                      <div className="flex-1 min-w-0 pb-3 pt-1.5">
                        <div className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{item.userName}</span> {desc}</div>
                        <div className="text-[10px] text-muted-foreground/70">{fmtDate(item.createdAt)}</div>
                      </div>
                    </div>
                  );
                });
                })()}
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="p-5 space-y-4">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Status</p>
              <select className={`w-full h-8 rounded-lg border-0 px-2 text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`} value={task.status} onChange={(e) => updateField("status", e.target.value)}>
                <option value="open">Aberta</option><option value="in_progress">Em Andamento</option><option value="done">Concluida</option>
              </select>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Prioridade</p>
              <select className="w-full h-8 rounded-lg border border-input bg-transparent px-2 text-xs" value={task.priority} onChange={(e) => updateField("priority", Number(e.target.value))}>
                <option value={1}>Urgente</option><option value={2}>Alta</option><option value={3}>Normal</option><option value={4}>Baixa</option>
              </select>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Responsavel</p>
              {task.assignedUser ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
                  <span className="text-xs font-medium flex-1 truncate">{task.assignedUser.name}</span>
                  <button onClick={() => updateField("assignedTo", null)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                </div>
              ) : (
                <select className="w-full h-8 rounded-lg border border-dashed border-border bg-transparent px-2 text-xs text-muted-foreground" value="" onChange={(e) => updateField("assignedTo", e.target.value || null)}>
                  <option value="">Atribuir...</option>
                  {task.allUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}
            </div>
            <div className="border-t border-border pt-3">
              {task.completedByUser && (
                <div className="mb-2">
                  <p className="text-[10px] text-muted-foreground">Concluida por</p>
                  <p className="text-xs font-medium">{task.completedByUser.name}</p>
                  {task.completedAt && <p className="text-[10px] text-muted-foreground">{fmtDate(task.completedAt)}</p>}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">Criada: {fmtDate(task.createdAt)}</p>
              <p className="text-[10px] text-muted-foreground">Atualizada: {fmtDate(task.updatedAt)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ MAIN PAGE ═══
export default function ClientsPage() {
  const [userId, setUserId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [allTime, setAllTime] = useState(true);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [groupInfo, setGroupInfo] = useState<GroupInfoResult | null>(null);
  const [addingToGroup, setAddingToGroup] = useState(false);

  // Task filters (client-side)
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("");
  const [taskDateFrom, setTaskDateFrom] = useState("");
  const [taskDateTo, setTaskDateTo] = useState("");

  const handleSearch = useCallback(async () => {
    if (!userId.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ userId: userId.trim() });
      if (allTime) params.set("allTime", "true");
      else {
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
      }

      const encodedId = encodeURIComponent(userId.trim());
      const [searchData, profileData, groupData] = await Promise.all([
        api.fetch<SearchResult>(`/clients/search?${params}`),
        api.fetch<ClientProfile>(`/clients/profile?userId=${encodedId}`).catch(() => null),
        api.fetch<GroupInfoResult>(`/clients/group-info?userId=${encodedId}`).catch(() => null),
      ]);
      setResult(searchData);
      setClientProfile(profileData);
      setGroupInfo(groupData);
    } catch (err) {
      console.error(err);
      setResult(null);
      setClientProfile(null);
      setGroupInfo(null);
    } finally {
      setLoading(false);
    }
  }, [userId, startDate, endDate, allTime]);

  const p = clientProfile?.profile;
  const f = clientProfile?.financials;
  const locks = (p?.locks ?? {}) as Record<string, boolean>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
          <UserSearch className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Buscar Cliente</h1>
          <p className="text-sm text-muted-foreground">Perfil completo, financeiro, alertas e tasks</p>
        </div>
      </div>

      {/* Search */}
      <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
        <CardContent className="p-6 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">ID do Usuario (NGX)</Label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Ex: 676f60a451a73300284c7b30" value={userId} onChange={(e) => setUserId(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                  className="h-11 rounded-xl border-border/60 bg-background/50 pl-10 font-mono text-foreground" />
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={loading || !userId.trim()} className="h-11 rounded-xl gap-2 shadow-sm">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? "Buscando..." : "Buscar"}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border/50 px-3 py-2.5 hover:bg-muted/50">
              <input type="checkbox" checked={allTime} onChange={(e) => setAllTime(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
              <span className="text-sm font-medium text-foreground">Todo o periodo</span>
            </label>
            {!allTime && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Inicio</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-44 h-10 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Fim</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-44 h-10 rounded-xl" />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {searched && !loading && (
        <>
          {/* ═══ Profile Card ═══ */}
          {p && (
            <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500/10 via-blue-500/5 to-transparent p-6">
                <div className="flex items-start gap-5">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary text-2xl font-bold">
                    {String(p.name).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-foreground">{String(p.name)}</h2>
                    <p className="text-sm text-muted-foreground font-mono">{String(p.username)}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>ID: <span className="font-mono text-foreground">{String(p.id)}</span></span>
                      {p.email ? <span>Email: <span className="text-foreground">{String(p.email)}</span></span> : null}
                      {p.cpf ? <span>CPF: <span className="text-foreground">{String(p.cpf).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.$3-**")}</span></span> : null}
                      {p.createdAt ? <span>Conta: <span className="text-foreground">{fmtDate(String(p.createdAt))}</span></span> : null}
                      {p.hasKyc ? <Badge variant="default" className="text-[10px] rounded-lg">KYC</Badge> : null}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground uppercase">Saldo</p>
                    <p className="text-2xl font-bold text-foreground">{fmtBrl(Number(p.balance))}</p>
                  </div>
                </div>
                {/* Locks */}
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {Object.entries(lockLabels).map(([key, label]) => {
                    const isLocked = locks[key] === true;
                    return (
                      <span key={key} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium ${isLocked ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-green-500/10 text-green-600 dark:text-green-400"}`}>
                        {isLocked ? <ShieldOff className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                        {label}
                      </span>
                    );
                  })}

                  {/* Quick add to group */}
                  {groupInfo && groupInfo.groups.length === 0 && groupInfo.availableGroups.length > 0 && (
                    <>
                      <span className="text-muted-foreground/40 mx-1">|</span>
                      <select
                        className="h-7 rounded-full border border-dashed border-violet-500/40 bg-violet-500/5 px-2.5 text-[11px] text-violet-600 dark:text-violet-400 font-medium cursor-pointer hover:bg-violet-500/10 appearance-none pr-6 transition-colors"
                        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b5cf6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
                        value=""
                        onChange={async (e) => {
                          const groupId = e.target.value;
                          if (!groupId) return;
                          setAddingToGroup(true);
                          try {
                            await api.fetch("/clients/add-to-group", {
                              method: "POST",
                              body: JSON.stringify({ userId: userId.trim(), groupId, userName: p ? String(p.name) : undefined }),
                            });
                            const updated = await api.fetch<GroupInfoResult>(`/clients/group-info?userId=${encodeURIComponent(userId.trim())}`);
                            setGroupInfo(updated);
                          } catch (err) { console.error(err); }
                          finally { setAddingToGroup(false); }
                        }}
                        disabled={addingToGroup}
                      >
                        <option value="">{addingToGroup ? "Adicionando..." : "+ Grupo de bloqueio"}</option>
                        {groupInfo.availableGroups.map((g) => (
                          <option key={g.id} value={g.id}>{g.name} ({g._count.members} membros)</option>
                        ))}
                      </select>
                    </>
                  )}
                  {groupInfo && groupInfo.groups.length > 0 && (
                    <>
                      <span className="text-muted-foreground/40 mx-1">|</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400">
                        <Lock className="h-3 w-3" />
                        {groupInfo.groups.length} grupo{groupInfo.groups.length > 1 ? "s" : ""} de bloqueio
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* ═══ Financial KPIs ═══ */}
          {f && (f.totalDeposited > 0 || f.totalWithdrawn > 0) && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { title: "Total Depositado", value: fmtBrl(f.totalDeposited), sub: `${f.totalDeposits} depositos`, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                { title: "Total Sacado", value: fmtBrl(f.totalWithdrawn), sub: `${f.totalWithdrawals} saques`, icon: TrendingDown, color: "text-red-500", bg: "bg-red-500/10" },
                { title: "Net P&L", value: fmtBrl(f.netPnl), sub: f.netPnl >= 0 ? "positivo" : "negativo", icon: Wallet, color: f.netPnl >= 0 ? "text-emerald-500" : "text-red-500", bg: f.netPnl >= 0 ? "bg-emerald-500/10" : "bg-red-500/10" },
                { title: "Apostas Esportivas", value: String(f.totalSportBets), sub: "bets", icon: BarChart3, color: "text-blue-500", bg: "bg-blue-500/10" },
                { title: "Apostas Cassino", value: String(f.totalCasinoBets), sub: f.biggestCasinoWin > 0 ? `Maior: ${fmtBrl(f.biggestCasinoWin)}` : "bets", icon: DollarSign, color: "text-violet-500", bg: "bg-violet-500/10" },
              ].map((c) => (
                <Card key={c.title} className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${c.bg}`}><c.icon className={`h-4 w-4 ${c.color}`} /></div>
                      <div>
                        <p className="text-lg font-bold text-foreground">{c.value}</p>
                        <p className="text-[10px] text-muted-foreground">{c.title}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 pl-12">{c.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ═══ Recent Transactions ═══ */}
          {clientProfile && (clientProfile.recentDeposits.length > 0 || clientProfile.recentWithdrawals.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { title: "Ultimos Depositos", items: clientProfile.recentDeposits, color: "text-emerald-600" },
                { title: "Ultimos Saques", items: clientProfile.recentWithdrawals, color: "text-red-600" },
              ].map((section) => (
                <Card key={section.title} className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-foreground">{section.title}</CardTitle></CardHeader>
                  <CardContent>
                    {section.items.length === 0 ? <p className="text-xs text-muted-foreground py-4 text-center">Sem transacoes</p> : (
                      <div className="space-y-1.5">
                        {section.items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                            <span className={`text-sm font-semibold ${section.color}`}>{fmtBrl(item.value)}</span>
                            <span className="text-[11px] text-muted-foreground">{fmtDate(item.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ═══ Groups Section ═══ */}
          {groupInfo && (
            <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Lock className="h-4 w-4 text-violet-500" />
                    Grupos de Bloqueio
                    {groupInfo.groups.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] rounded-lg">{groupInfo.groups.length}</Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {/* Quick add dropdown - always visible */}
                    {groupInfo.availableGroups.length > 0 && (
                      <select
                        className="h-8 rounded-lg border border-dashed border-violet-500/40 bg-violet-500/5 px-2 text-xs text-violet-600 dark:text-violet-400 font-medium cursor-pointer hover:bg-violet-500/10 transition-colors"
                        value=""
                        onChange={async (e) => {
                          const groupId = e.target.value;
                          if (!groupId) return;
                          setAddingToGroup(true);
                          try {
                            await api.fetch("/clients/add-to-group", {
                              method: "POST",
                              body: JSON.stringify({
                                userId: userId.trim(),
                                groupId,
                                userName: p ? String(p.name) : undefined,
                              }),
                            });
                            const updated = await api.fetch<GroupInfoResult>(`/clients/group-info?userId=${encodeURIComponent(userId.trim())}`);
                            setGroupInfo(updated);
                          } catch (err) { console.error(err); }
                          finally { setAddingToGroup(false); }
                        }}
                        disabled={addingToGroup}
                      >
                        <option value="">{addingToGroup ? "Adicionando..." : "+ Adicionar a grupo"}</option>
                        {groupInfo.availableGroups.map((g) => (
                          <option key={g.id} value={g.id}>{g.name} ({g._count.members} membros)</option>
                        ))}
                      </select>
                    )}
                    <a href="/groups/new" className="flex items-center gap-1 h-8 px-3 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                      <Plus className="h-3 w-3" /> Novo grupo
                    </a>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {groupInfo.groups.length === 0 ? (
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><Users className="h-5 w-5 text-muted-foreground/40" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Este usuario nao participa de nenhum grupo de bloqueio.</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {groupInfo.availableGroups.length > 0
                          ? "Use o botao acima para adiciona-lo a um grupo existente ou crie um novo."
                          : "Crie um novo grupo de bloqueio para adiciona-lo."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupInfo.groups.map((g) => {
                      const peakHour = g.locksByHour.reduce((max, h) => h.count > max.count ? h : max, { hour: 0, count: 0 });
                      const maxHourCount = Math.max(...g.locksByHour.map((h) => h.count), 1);
                      return (
                        <div key={g.groupId} className="rounded-xl border border-border/50 p-4 space-y-3">
                          {/* Group header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                                <Lock className="h-4 w-4 text-violet-500" />
                              </div>
                              <div>
                                <a href={`/groups/${g.groupId}`} className="text-sm font-semibold text-foreground hover:text-primary flex items-center gap-1">
                                  {g.groupName} <ExternalLink className="h-3 w-3" />
                                </a>
                                <p className="text-[10px] text-muted-foreground">{g.memberCount} membros</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-lg font-bold text-foreground">{g.totalLocks}</p>
                                <p className="text-[10px] text-muted-foreground">bloqueios</p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-red-500">{g.userTriggers}</p>
                                <p className="text-[10px] text-muted-foreground">por este usuario</p>
                              </div>
                            </div>
                          </div>

                          {/* Mini stats */}
                          <div className="grid grid-cols-4 gap-2">
                            <div className="rounded-lg bg-muted/30 px-3 py-2 text-center">
                              <p className="text-xs font-bold text-foreground">{g.totalLocks}</p>
                              <p className="text-[9px] text-muted-foreground">Total bloqueios</p>
                            </div>
                            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-center">
                              <p className="text-xs font-bold text-red-600">{g.userTriggers}</p>
                              <p className="text-[9px] text-muted-foreground">Ele disparou</p>
                            </div>
                            <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-center">
                              <p className="text-xs font-bold text-amber-600">{peakHour.count > 0 ? `${peakHour.hour}h` : "-"}</p>
                              <p className="text-[9px] text-muted-foreground">Horario pico</p>
                            </div>
                            <div className="rounded-lg bg-muted/30 px-3 py-2 text-center">
                              <p className="text-xs font-bold text-foreground">{g.lastLockAt ? fmtDate(g.lastLockAt).split(",")[0] : "-"}</p>
                              <p className="text-[9px] text-muted-foreground">Ultimo lock</p>
                            </div>
                          </div>

                          {/* Hour heatmap (mini bar) */}
                          {g.totalLocks > 0 && (
                            <div>
                              <p className="text-[10px] text-muted-foreground mb-1">Distribuicao por hora</p>
                              <div className="flex gap-px h-8 items-end">
                                {g.locksByHour.map((h) => {
                                  const pct = maxHourCount > 0 ? (h.count / maxHourCount) * 100 : 0;
                                  return (
                                    <div key={h.hour} className="flex-1 flex flex-col items-center gap-0.5" title={`${h.hour}h: ${h.count} bloqueios`}>
                                      <div
                                        className={`w-full rounded-sm transition-all ${h.count > 0 ? "bg-violet-500/70" : "bg-muted/40"}`}
                                        style={{ height: `${Math.max(pct, h.count > 0 ? 15 : 4)}%` }}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="flex justify-between mt-0.5">
                                <span className="text-[8px] text-muted-foreground">0h</span>
                                <span className="text-[8px] text-muted-foreground">6h</span>
                                <span className="text-[8px] text-muted-foreground">12h</span>
                                <span className="text-[8px] text-muted-foreground">18h</span>
                                <span className="text-[8px] text-muted-foreground">23h</span>
                              </div>
                            </div>
                          )}

                          {/* Members list (compact) */}
                          <div className="flex flex-wrap gap-1">
                            {g.members.map((m) => (
                              <span
                                key={m.ngxUserId}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
                                  m.isCurrentUser
                                    ? "bg-primary/15 text-primary font-semibold border border-primary/30"
                                    : "bg-muted/50 text-muted-foreground"
                                }`}
                              >
                                <User className="h-2.5 w-2.5" />
                                {m.ngxName || m.ngxUserId.slice(-6)}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ═══ Alert Summary ═══ */}
          {result?.summary && result.summary.totalAlerts > 0 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { title: "Total Alertas", value: result.summary.totalAlerts, icon: Bell, color: "text-blue-500", bg: "bg-blue-500/10" },
                  { title: "Tasks Geradas", value: result.summary.totalTasks, sub: `${result.summary.tasksDone} done / ${result.summary.tasksOpen} abertas`, icon: ListTodo, color: "text-violet-500", bg: "bg-violet-500/10" },
                  { title: "Primeiro Alerta", value: result.summary.firstAlertAt ? fmtDate(result.summary.firstAlertAt) : "-", icon: Clock, color: "text-emerald-500", bg: "bg-emerald-500/10", small: true },
                  { title: "Ultimo Alerta", value: result.summary.lastAlertAt ? fmtDate(result.summary.lastAlertAt) : "-", icon: CalendarDays, color: "text-amber-500", bg: "bg-amber-500/10", small: true },
                ].map((c) => (
                  <Card key={c.title} className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-medium text-muted-foreground">{c.title}</CardTitle>
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.bg}`}><c.icon className={`h-4 w-4 ${c.color}`} /></div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className={`font-bold text-foreground ${(c as any).small ? "text-sm" : "text-3xl"}`}>{c.value}</p>
                      {(c as any).sub && <p className="text-xs text-muted-foreground mt-1">{(c as any).sub}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Summary by type + config */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
                  <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><BarChart3 className="h-4 w-4 text-muted-foreground" /> Alertas por Tipo</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {result.summary.byType.map((item) => (
                      <div key={item.type} className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-2.5 hover:bg-muted/50">
                        <span className="text-sm">{webhookTypeLabels[item.type] || item.type}</span>
                        <Badge variant="secondary" className="rounded-lg">{item.count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
                  <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><BarChart3 className="h-4 w-4 text-muted-foreground" /> Alertas por Configuracao</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {result.summary.byConfig.map((item) => (
                      <div key={item.alertConfigId} className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-2.5 hover:bg-muted/50">
                        <span className="text-sm">{item.name}</span>
                        <Badge variant="secondary" className="rounded-lg">{item.count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* ═══ Tasks (with click-to-open modal) ═══ */}
              {result.tasks.length > 0 && (() => {
                const filteredTasks = result.tasks.filter((t) => {
                  if (taskStatusFilter && t.status !== taskStatusFilter) return false;
                  if (taskDateFrom && new Date(t.createdAt) < new Date(taskDateFrom)) return false;
                  if (taskDateTo && new Date(t.createdAt) > new Date(taskDateTo + "T23:59:59")) return false;
                  return true;
                });
                const hasTaskFilters = taskStatusFilter || taskDateFrom || taskDateTo;
                return (
                <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm"><ListTodo className="h-4 w-4 text-muted-foreground" /> Tasks do Cliente ({filteredTasks.length}{hasTaskFilters ? ` de ${result.tasks.length}` : ""})</CardTitle>
                    </div>
                    {/* Task filters */}
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      <select
                        className="h-8 rounded-lg border border-border/60 bg-transparent px-2 text-xs text-foreground"
                        value={taskStatusFilter}
                        onChange={(e) => setTaskStatusFilter(e.target.value)}
                      >
                        <option value="">Todos status</option>
                        <option value="open">Aberta</option>
                        <option value="in_progress">Em Andamento</option>
                        <option value="done">Concluida</option>
                      </select>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground">De</span>
                        <Input type="date" value={taskDateFrom} onChange={(e) => setTaskDateFrom(e.target.value)} className="h-8 w-36 text-xs rounded-lg" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground">Ate</span>
                        <Input type="date" value={taskDateTo} onChange={(e) => setTaskDateTo(e.target.value)} className="h-8 w-36 text-xs rounded-lg" />
                      </div>
                      {hasTaskFilters && (
                        <Button variant="ghost" size="sm" className="h-8 text-xs rounded-lg gap-1" onClick={() => { setTaskStatusFilter(""); setTaskDateFrom(""); setTaskDateTo(""); }}>
                          <X className="h-3 w-3" /> Limpar
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {filteredTasks.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma task com esses filtros</div>
                    ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/50 bg-muted/30">
                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Titulo</th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Responsavel</th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Concluida por</th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Criada</th>
                          <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><MessageSquare className="h-3.5 w-3.5 mx-auto" /></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {filteredTasks.map((task) => {
                          const st = STATUS_STYLES[task.status] ?? STATUS_STYLES.open;
                          return (
                            <tr key={task.id} className="hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setSelectedTaskId(task.id)}>
                              <td className="px-4 py-3 text-sm font-medium text-foreground max-w-[300px] truncate">{task.title}</td>
                              <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.bg} ${st.text}`}>{st.label}</span></td>
                              <td className="px-4 py-3 text-sm text-foreground">{task.assignedUserName ?? <span className="text-muted-foreground">-</span>}</td>
                              <td className="px-4 py-3 text-sm text-foreground">
                                {task.completedByName ?? <span className="text-muted-foreground">-</span>}
                                {task.completedAt && <span className="text-[10px] text-muted-foreground ml-1">({fmtDate(task.completedAt)})</span>}
                              </td>
                              <td className="px-4 py-3 text-[11px] text-muted-foreground">{fmtDate(task.createdAt)}</td>
                              <td className="px-4 py-3 text-center">
                                {(task._count?.comments ?? 0) > 0 && <Badge variant="secondary" className="text-[10px] rounded-lg">{task._count?.comments}</Badge>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    )}
                  </CardContent>
                </Card>
                );
              })()}

              {/* ═══ Alert History ═══ */}
              <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><Bell className="h-4 w-4 text-muted-foreground" /> Historico de Alertas ({result.alerts.length})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {result.alerts.map((alert) => (
                    <div key={alert.id} className="rounded-xl border border-border/40 bg-background/30 p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{alert.title}</span>
                            <Badge variant="outline" className="rounded-lg text-xs">{webhookTypeLabels[alert.webhookType] || alert.webhookType}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{alert.alertConfig?.name ?? "Config removida"} - {fmtDate(alert.createdAt)}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="rounded-lg gap-1.5 text-xs" onClick={() => setExpandedId(expandedId === alert.id ? null : alert.id)}>
                          {expandedId === alert.id ? <><EyeOff className="h-3.5 w-3.5" /> Fechar</> : <><Eye className="h-3.5 w-3.5" /> Dados</>}
                        </Button>
                      </div>
                      {expandedId === alert.id && (
                        <pre className="mt-3 overflow-auto max-h-48 rounded-xl bg-muted/50 p-4 text-xs font-mono border border-border/30">
                          {JSON.stringify(alert.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}

          {/* No results */}
          {result?.summary && result.summary.totalAlerts === 0 && !p && (
            <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm">
              <CardContent className="flex flex-col items-center gap-3 py-16">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted"><UserX className="h-7 w-7 text-muted-foreground" /></div>
                <div className="text-center">
                  <p className="font-medium">Nenhum resultado</p>
                  <p className="text-sm text-muted-foreground">Nenhum dado para <span className="font-mono">{userId}</span></p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Task Detail Modal */}
      {selectedTaskId && <TaskModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />}
    </div>
  );
}
