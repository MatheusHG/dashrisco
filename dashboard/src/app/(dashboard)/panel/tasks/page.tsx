"use client";

import { useEffect, useState, useCallback, useRef, type DragEvent } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  GripVertical,
  Clock,
  Filter,
  X,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Inbox,
  ListTodo,
  MessageSquare,
  Send,
  Trash2,
  Pencil,
  Check,
  User,
  History,
  ArrowRight,
  UserPlus,
  UserMinus,
  FileText,
  Type,
  ChevronDown,
  Minus,
} from "lucide-react";

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════
const COLUMNS = [
  { id: "open", label: "Aberta", color: "bg-yellow-500", lightBg: "bg-yellow-50 dark:bg-yellow-950/20", icon: Inbox },
  { id: "in_progress", label: "Em Andamento", color: "bg-blue-500", lightBg: "bg-blue-50 dark:bg-blue-950/20", icon: Clock },
  { id: "done", label: "Concluida", color: "bg-green-500", lightBg: "bg-green-50 dark:bg-green-950/20", icon: ListTodo },
] as const;

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  open: { label: "Aberta", bg: "bg-yellow-500/15", text: "text-yellow-700 dark:text-yellow-400" },
  in_progress: { label: "Em Andamento", bg: "bg-blue-500/15", text: "text-blue-700 dark:text-blue-400" },
  done: { label: "Concluida", bg: "bg-green-500/15", text: "text-green-700 dark:text-green-400" },
};

const PRIORITY_STYLES: Record<number, { label: string; bg: string; text: string; icon: typeof AlertTriangle }> = {
  1: { label: "Urgente", bg: "bg-red-500/15", text: "text-red-600 dark:text-red-400", icon: AlertTriangle },
  2: { label: "Alta", bg: "bg-orange-500/15", text: "text-orange-600 dark:text-orange-400", icon: ArrowUp },
  3: { label: "Normal", bg: "bg-zinc-500/10", text: "text-zinc-600 dark:text-zinc-400", icon: Minus },
  4: { label: "Baixa", bg: "bg-zinc-500/10", text: "text-zinc-500", icon: ArrowDown },
};

interface TaskComment { id: string; userId: string | null; userName: string; message: string; createdAt: string; }
interface PanelTaskItem { id: string; title: string; description: string | null; status: string; priority: number; data: Record<string, unknown> | null; assignedTo: string | null; completedBy: string | null; createdAt: string; updatedAt: string; _count?: { comments: number }; }
interface TaskDetail extends PanelTaskItem { comments: TaskComment[]; assignedUser: { id: string; name: string } | null; completedByUser: { id: string; name: string } | null; allUsers: { id: string; name: string }[]; }
interface HistoryEntry { id: string; action: string; details: Record<string, unknown> | null; createdAt: string; user: { id: string; name: string } | null; }
interface UserOption { id: string; name: string; }

// ═══════════════════════════════════════
// UTILS
// ═══════════════════════════════════════
function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if ((key.includes("value") || key.includes("credits")) && typeof value === "number")
    return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  return String(value);
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

function formatFullDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function priorityConfig(p: number) {
  if (p === 1) return { label: "Urgente", icon: AlertTriangle, class: "text-red-500" };
  if (p === 2) return { label: "Alta", icon: ArrowUp, class: "text-orange-500" };
  return null;
}

function UserAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const s = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  return (
    <div className={`${s} shrink-0 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ═══════════════════════════════════════
// TIMELINE: merges comments + history
// ═══════════════════════════════════════
type TimelineItem =
  | { kind: "comment"; id: string; userName: string; message: string; createdAt: string; commentId: string }
  | { kind: "event"; id: string; action: string; details: Record<string, unknown> | null; userName: string; createdAt: string };

function buildTimeline(comments: TaskComment[], history: HistoryEntry[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const c of comments) {
    items.push({ kind: "comment", id: `c-${c.id}`, userName: c.userName, message: c.message, createdAt: c.createdAt, commentId: c.id });
  }
  for (const h of history) {
    items.push({ kind: "event", id: `h-${h.id}`, action: h.action, details: h.details, userName: h.user?.name ?? "Sistema", createdAt: h.createdAt });
  }
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items;
}

function EventDescription({ action, details }: { action: string; details: Record<string, unknown> | null }) {
  const d = details ?? {};
  switch (action) {
    case "task.status_changed":
      return <span>alterou status de <Badge variant="outline" className="text-[10px] px-1.5 py-0 mx-0.5">{String(d.from)}</Badge> para <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mx-0.5">{String(d.to)}</Badge></span>;
    case "task.assigned":
      return <span>atribuiu para <strong>{String(d.to)}</strong></span>;
    case "task.unassigned":
      return <span>removeu responsavel{d.from ? <> (<strong>{String(d.from)}</strong>)</> : ""}</span>;
    case "task.priority_changed":
      return <span>alterou prioridade: <strong>{String(d.from)}</strong> &rarr; <strong>{String(d.to)}</strong></span>;
    case "task.title_changed": return <span>editou o titulo</span>;
    case "task.description_changed": return <span>editou a descricao</span>;
    case "task.comment_added": return <span>comentou</span>;
    case "alert.triggered": return <span>task criada automaticamente por alerta</span>;
    default: return <span>{action.replace("task.", "")}</span>;
  }
}

function EventIcon({ action }: { action: string }) {
  const base = "h-3 w-3";
  if (action === "task.status_changed") return <ArrowRight className={`${base} text-blue-500`} />;
  if (action === "task.assigned") return <UserPlus className={`${base} text-emerald-500`} />;
  if (action === "task.unassigned") return <UserMinus className={`${base} text-orange-500`} />;
  if (action === "task.priority_changed") return <AlertTriangle className={`${base} text-amber-500`} />;
  if (action === "task.title_changed") return <Type className={`${base} text-violet-500`} />;
  if (action === "task.description_changed") return <FileText className={`${base} text-indigo-500`} />;
  if (action.includes("comment")) return <MessageSquare className={`${base} text-cyan-500`} />;
  return <History className={`${base} text-muted-foreground`} />;
}

// ═══════════════════════════════════════
// TASK DETAIL MODAL
// ═══════════════════════════════════════
function TaskDetailModal({ taskId, onClose, onUpdate }: { taskId: string; onClose: () => void; onUpdate: () => void }) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [showData, setShowData] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchTask = useCallback(async () => {
    try {
      const [data, historyData] = await Promise.all([
        api.fetch<TaskDetail>(`/panel/tasks/${taskId}`),
        api.fetch<HistoryEntry[]>(`/panel/tasks/${taskId}/history`),
      ]);
      setTask(data);
      setHistory(historyData);
      setTitleDraft(data.title);
      setDescDraft(data.description ?? "");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { fetchTask(); }, [fetchTask]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const updateField = async (field: string, value: unknown) => {
    if (!task) return;
    try {
      await api.fetch(`/panel/tasks/${taskId}`, { method: "PUT", body: JSON.stringify({ [field]: value }) });
      await fetchTask();
      onUpdate();
    } catch (err) { console.error(err); }
  };

  const addComment = async () => {
    if (!newComment.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      await api.fetch(`/panel/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ message: newComment.trim() }) });
      setNewComment("");
      await fetchTask();
    } catch (err) { console.error(err); }
    finally { setSendingComment(false); }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await api.fetch(`/panel/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" });
      await fetchTask();
    } catch (err) { console.error(err); }
  };

  const saveTitle = () => {
    if (titleDraft.trim() && titleDraft !== task?.title) updateField("title", titleDraft.trim());
    setEditingTitle(false);
  };

  const saveDesc = () => {
    const val = descDraft.trim() || null;
    if (val !== (task?.description ?? null)) updateField("description", val);
    setEditingDesc(false);
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl p-8 text-sm text-muted-foreground shadow-2xl">Carregando...</div>
    </div>
  );

  if (!task) { onClose(); return null; }

  const timeline = buildTimeline(task.comments, history);
  const statusStyle = STATUS_STYLES[task.status] ?? STATUS_STYLES.open;
  const prioStyle = PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES[3];
  const PrioIcon = prioStyle.icon;
  const dataEntries = task.data ? Object.entries(task.data).filter(([k]) => k !== "type").filter(([, v]) => v !== null && v !== undefined && v !== "") : [];

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[5vh] pb-8 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-[820px] mx-4 animate-in slide-in-from-bottom-4 duration-300">

        {/* ── HEADER ─────────────────────── */}
        <div className="px-8 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Status + Priority chips */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${task.status === "open" ? "bg-yellow-500" : task.status === "in_progress" ? "bg-blue-500" : "bg-green-500"}`} />
                  {statusStyle.label}
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${prioStyle.bg} ${prioStyle.text}`}>
                  <PrioIcon className="h-3 w-3" />
                  {prioStyle.label}
                </span>
              </div>

              {/* Title */}
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setTitleDraft(task.title); setEditingTitle(false); } }}
                    onBlur={saveTitle}
                    autoFocus
                    className="flex-1 text-xl font-bold bg-transparent border-b-2 border-primary outline-none pb-1 text-foreground"
                  />
                </div>
              ) : (
                <h2
                  className="text-xl font-bold text-foreground cursor-text hover:text-primary/90 transition-colors group"
                  onClick={() => setEditingTitle(true)}
                >
                  {task.title}
                  <Pencil className="h-3.5 w-3.5 inline ml-2 opacity-0 group-hover:opacity-60 text-muted-foreground" />
                </h2>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── BODY ───────────────────────── */}
        <div className="grid grid-cols-[1fr_260px] border-t border-border">

          {/* LEFT COLUMN */}
          <div className="p-8 space-y-6 border-r border-border min-h-[400px]">

            {/* Description */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Descricao</p>
              {editingDesc ? (
                <div className="space-y-2">
                  <textarea
                    ref={inputRef}
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    rows={4}
                    autoFocus
                    className="w-full rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm resize-y min-h-[80px] focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                    placeholder="Descreva a analise, observacoes..."
                    onKeyDown={(e) => { if (e.key === "Escape") { setDescDraft(task.description ?? ""); setEditingDesc(false); } }}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveDesc} className="h-7 text-xs">Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setDescDraft(task.description ?? ""); setEditingDesc(false); }} className="h-7 text-xs">Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div
                  className="text-sm text-foreground cursor-text rounded-lg p-3 bg-muted/30 hover:bg-muted/50 transition-colors min-h-[44px] group whitespace-pre-wrap"
                  onClick={() => setEditingDesc(true)}
                >
                  {task.description || <span className="text-muted-foreground">Clique para adicionar descricao...</span>}
                </div>
              )}
            </div>

            {/* Webhook data (collapsible) */}
            {dataEntries.length > 0 && (
              <div>
                <button
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                  onClick={() => setShowData(!showData)}
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showData ? "rotate-180" : ""}`} />
                  Dados do webhook ({dataEntries.length} campos)
                </button>
                {showData && (
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 p-3 rounded-lg bg-muted/30">
                    {dataEntries.map(([key, value]) => (
                      <div key={key}>
                        <p className="text-[10px] text-muted-foreground truncate">{key}</p>
                        <p className="text-xs font-medium truncate text-foreground">{formatValue(key, value)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Activity feed (unified timeline) */}
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

              {/* Comment input at top */}
              <div className="flex gap-3 mb-4">
                <UserAvatar name="U" size="md" />
                <div className="flex-1 relative">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Escrever comentario..."
                    rows={1}
                    className="w-full rounded-lg border border-input bg-muted/30 px-3 py-2.5 pr-10 text-sm resize-none focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(); } }}
                  />
                  <button
                    onClick={addComment}
                    disabled={!newComment.trim() || sendingComment}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-primary hover:bg-primary/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-0">
                {(() => {
                  const filtered = showHistory ? timeline : timeline.filter((i) => i.kind === "comment");
                  return filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">{showHistory ? "Nenhuma atividade ainda" : "Nenhum comentario ainda"}</p>
                ) : (
                  filtered.map((item, idx) => {
                    const isLast = idx === filtered.length - 1;

                    if (item.kind === "comment") {
                      return (
                        <div key={item.id} className="flex gap-3 relative group">
                          {!isLast && <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />}
                          <UserAvatar name={item.userName} size="md" />
                          <div className="flex-1 min-w-0 pb-5">
                            <div className="rounded-lg border border-border bg-muted/20 p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-foreground">{item.userName}</span>
                                <span className="text-[10px] text-muted-foreground">{formatFullDate(item.createdAt)}</span>
                                <button
                                  className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                                  onClick={() => deleteComment(item.commentId)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{item.message}</p>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Event
                    return (
                      <div key={item.id} className="flex gap-3 relative">
                        {!isLast && <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />}
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card z-10">
                          <EventIcon action={item.action} />
                        </div>
                        <div className="flex-1 min-w-0 pb-4 pt-1.5">
                          <div className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">{item.userName}</span>{" "}
                            <EventDescription action={item.action} details={item.details} />
                          </div>
                          <div className="text-[10px] text-muted-foreground/70 mt-0.5">{formatFullDate(item.createdAt)}</div>
                        </div>
                      </div>
                    );
                  })
                );
                })()}
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="p-6 space-y-5">
            {/* Status */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Status</p>
              <div className="relative">
                <select
                  className={`w-full h-9 rounded-lg border-0 px-3 text-xs font-semibold appearance-none cursor-pointer transition-colors ${statusStyle.bg} ${statusStyle.text}`}
                  value={task.status}
                  onChange={(e) => updateField("status", e.target.value)}
                >
                  {COLUMNS.map((col) => (<option key={col.id} value={col.id}>{col.label === "Concluida" ? "Concluida" : col.label}</option>))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none opacity-50" />
              </div>
            </div>

            {/* Priority */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Prioridade</p>
              <div className="relative">
                <select
                  className={`w-full h-9 rounded-lg border-0 px-3 text-xs font-semibold appearance-none cursor-pointer transition-colors ${prioStyle.bg} ${prioStyle.text}`}
                  value={task.priority}
                  onChange={(e) => updateField("priority", Number(e.target.value))}
                >
                  <option value={1}>Urgente</option>
                  <option value={2}>Alta</option>
                  <option value={3}>Normal</option>
                  <option value={4}>Baixa</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none opacity-50" />
              </div>
            </div>

            {/* Assigned to */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Responsavel</p>
              {task.assignedUser ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
                  <UserAvatar name={task.assignedUser.name} />
                  <span className="text-xs font-medium flex-1 truncate">{task.assignedUser.name}</span>
                  <button
                    onClick={() => updateField("assignedTo", null)}
                    className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <select
                    className="w-full h-9 rounded-lg border border-dashed border-border bg-transparent px-3 text-xs text-muted-foreground appearance-none cursor-pointer hover:border-primary/50 transition-colors"
                    value=""
                    onChange={(e) => updateField("assignedTo", e.target.value || null)}
                  >
                    <option value="">Atribuir...</option>
                    {task.allUsers.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
                  </select>
                  <User className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-muted-foreground/50" />
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Completed by */}
            {task.completedByUser && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Concluida por</p>
                <div className="flex items-center gap-2">
                  <UserAvatar name={task.completedByUser.name} />
                  <div>
                    <p className="text-xs font-medium">{task.completedByUser.name}</p>
                    {task.updatedAt && <p className="text-[10px] text-muted-foreground">{formatFullDate(task.updatedAt)}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="space-y-2">
              <div>
                <p className="text-[10px] text-muted-foreground">Criada</p>
                <p className="text-[11px] font-medium">{formatFullDate(task.createdAt)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Atualizada</p>
                <p className="text-[11px] font-medium">{formatFullDate(task.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// MAIN PAGE (KANBAN)
// ═══════════════════════════════════════
export default function PanelTasksPage() {
  const [tasks, setTasks] = useState<PanelTaskItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [completedBy, setCompletedBy] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const hasFilters = startDate || endDate || completedBy;

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (completedBy) params.set("completedBy", completedBy);
      const data = await api.fetch<{ tasks: PanelTaskItem[]; users: UserOption[] }>(`/panel/tasks?${params}`);
      setTasks(data.tasks);
      setUsers(data.users);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [startDate, endDate, completedBy]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const updateTaskStatus = async (id: string, status: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    try { await api.fetch(`/panel/tasks/${id}`, { method: "PUT", body: JSON.stringify({ status }) }); }
    catch { fetchTasks(); }
  };

  const handleDragStart = (e: DragEvent, id: string) => { setDraggingId(id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); };
  const handleDragOver = (e: DragEvent, col: string) => { e.preventDefault(); setDragOverColumn(col); };
  const handleDrop = (e: DragEvent, col: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    setDraggingId(null); setDragOverColumn(null);
    const t = tasks.find((t) => t.id === id);
    if (t && t.status !== col) updateTaskStatus(id, col);
  };

  const getTasksByStatus = (s: string) => tasks.filter((t) => t.status === s);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
            <ListTodo className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Painel de Tasks</h1>
            <p className="text-sm text-muted-foreground">
              {tasks.length} tasks — {getTasksByStatus("open").length} abertas, {getTasksByStatus("in_progress").length} em andamento, {getTasksByStatus("done").length} concluidas
            </p>
          </div>
        </div>
        <Button variant={showFilters ? "default" : "outline"} size="sm" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4" /> Filtros
          {hasFilters && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">!</Badge>}
        </Button>
      </div>

      {showFilters && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-4 pt-4 pb-4">
            <div className="space-y-1"><Label className="text-xs">Inicio</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 h-8 text-sm" /></div>
            <div className="space-y-1"><Label className="text-xs">Fim</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 h-8 text-sm" /></div>
            <div className="space-y-1">
              <Label className="text-xs">Responsavel</Label>
              <select className="flex h-8 rounded-md border border-input bg-transparent px-3 text-sm text-foreground" value={completedBy} onChange={(e) => setCompletedBy(e.target.value)}>
                <option value="">Todos</option>
                {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
              </select>
            </div>
            {hasFilters && <Button variant="ghost" size="sm" onClick={() => { setStartDate(""); setEndDate(""); setCompletedBy(""); }}><X className="h-4 w-4" /> Limpar</Button>}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid grid-cols-3 gap-4 h-[calc(100vh-200px)]">
          {COLUMNS.map((column) => {
            const columnTasks = getTasksByStatus(column.id);
            const isOver = dragOverColumn === column.id;
            const ColIcon = column.icon;
            return (
              <div
                key={column.id}
                className={`flex flex-col rounded-xl border border-border transition-all overflow-hidden ${isOver ? "ring-2 ring-primary/40 border-primary/40 scale-[1.01]" : ""}`}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                <div className={`flex items-center gap-2.5 px-4 py-3 border-b border-border ${column.lightBg}`}>
                  <div className={`flex items-center justify-center h-6 w-6 rounded-md ${column.color}`}>
                    <ColIcon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h2 className="text-sm font-semibold text-foreground">{column.label}</h2>
                  <Badge variant="secondary" className="ml-auto text-xs font-bold">{columnTasks.length}</Badge>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/20">
                  {columnTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 rounded-lg border border-dashed border-border text-muted-foreground">
                      <ColIcon className="h-6 w-6 mb-2 opacity-30" />
                      <p className="text-xs">Arraste tasks aqui</p>
                    </div>
                  ) : columnTasks.map((task) => {
                    const prio = priorityConfig(task.priority);
                    const userName = (task.data?.user_name as string) || (task.data?.user_username as string) || null;
                    const assignedUser = task.assignedTo ? users.find((u) => u.id === task.assignedTo) : null;
                    const commentCount = task._count?.comments ?? 0;
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragEnd={() => { setDraggingId(null); setDragOverColumn(null); }}
                        onClick={() => setSelectedTaskId(task.id)}
                        className={`group cursor-pointer active:cursor-grabbing transition-all ${draggingId === task.id ? "opacity-40 scale-95 rotate-1" : ""}`}
                      >
                        <Card className="border-border hover:border-primary/30 hover:shadow-md transition-all overflow-hidden">
                          {prio && <div className={`h-0.5 ${task.priority === 1 ? "bg-red-500" : "bg-orange-400"}`} />}
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-grab" />
                              <p className="text-sm font-medium leading-snug text-foreground line-clamp-2 flex-1">{task.title}</p>
                              {prio && <prio.icon className={`h-3.5 w-3.5 shrink-0 ${prio.class}`} />}
                            </div>
                            {task.description && <p className="text-xs text-muted-foreground line-clamp-1 pl-6">{task.description}</p>}
                            <div className="flex items-center gap-1.5 pl-6 flex-wrap">
                              {userName && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{userName}</Badge>}
                              {assignedUser && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex items-center gap-0.5">
                                  <User className="h-2.5 w-2.5" />{assignedUser.name}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 pl-6 text-[11px] text-muted-foreground">
                              <Clock className="h-3 w-3" />{formatTime(task.createdAt)}
                              {commentCount > 0 && <><MessageSquare className="h-3 w-3 ml-1" />{commentCount}</>}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedTaskId && <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} onUpdate={fetchTasks} />}
    </div>
  );
}
