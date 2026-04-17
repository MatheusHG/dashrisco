"use client";

import { useEffect, useState, useCallback, useRef, type DragEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getFieldLabel, WEBHOOK_TYPES } from "@/lib/field-labels";
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
  Paperclip,
  Upload,
  Image,
  File,
  Loader2,
  Bold,
  Italic,
  Underline,
  CheckSquare,
  Square,
  Play,
  CheckCircle,
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

interface TaskComment { id: string; userId: string | null; userName: string; message: string; imageUrl: string | null; createdAt: string; }
interface TaskAttachment { id: string; fileName: string; fileType: string; fileSize: number; filePath: string; createdAt: string; }
interface ChecklistItem { label: string; checked: boolean; type?: string; }
interface PanelTaskItem { id: string; title: string; description: string | null; status: string; priority: number; data: Record<string, unknown> | null; checklist?: ChecklistItem[]; assignedTo: string | null; completedBy: string | null; createdAt: string; updatedAt: string; _count?: { comments: number }; }
interface TaskDetail extends PanelTaskItem { comments: TaskComment[]; attachments: TaskAttachment[]; assignedUser: { id: string; name: string } | null; completedByUser: { id: string; name: string } | null; allUsers: { id: string; name: string }[]; }
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

/** Parseia **negrito**, *italico* e __sublinhado__ para JSX */
function parseFormatted(text: string): React.ReactNode[] {
  // Ordem: negrito primeiro, depois italico, depois sublinhado
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__)/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[2]) parts.push(<strong key={key++}>{match[2]}</strong>);
    else if (match[3]) parts.push(<em key={key++}>{match[3]}</em>);
    else if (match[4]) parts.push(<u key={key++}>{match[4]}</u>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
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
  | { kind: "comment"; id: string; userName: string; message: string; imageUrl: string | null; createdAt: string; commentId: string }
  | { kind: "event"; id: string; action: string; details: Record<string, unknown> | null; userName: string; createdAt: string };

function buildTimeline(comments: TaskComment[], history: HistoryEntry[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const c of comments) {
    items.push({ kind: "comment", id: `c-${c.id}`, userName: c.userName, message: c.message, imageUrl: c.imageUrl, createdAt: c.createdAt, commentId: c.id });
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
  const [commentImages, setCommentImages] = useState<globalThis.File[]>([]);
  const [commentImagePreviews, setCommentImagePreviews] = useState<string[]>([]);
  const [sendingComment, setSendingComment] = useState(false);
  const commentFileRef = useRef<HTMLInputElement>(null);
  const commentTextRef = useRef<HTMLTextAreaElement>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [showData, setShowData] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>("");
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
    if ((!newComment.trim() && commentImages.length === 0) || sendingComment) return;
    setSendingComment(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
      if (commentImages.length > 0) {
        const formData = new FormData();
        formData.append("message", newComment.trim());
        commentImages.forEach((img) => formData.append("images", img));
        await fetch(`${apiUrl}/panel/tasks/${taskId}/comments`, {
          method: "POST",
          headers: { Authorization: `Bearer ${api.getAccessToken()}` },
          body: formData,
        });
      } else {
        await api.fetch(`/panel/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ message: newComment.trim() }) });
      }
      setNewComment("");
      setCommentImages([]);
      setCommentImagePreviews([]);
      await fetchTask();
    } catch (err) { console.error(err); }
    finally { setSendingComment(false); }
  };

  const handleCommentImage = (file: globalThis.File) => {
    if (!file.type.startsWith("image/")) return;
    setCommentImages((prev) => [...prev, file]);
    const reader = new FileReader();
    reader.onload = () => setCommentImagePreviews((prev) => [...prev, reader.result as string]);
    reader.readAsDataURL(file);
  };

  const removeCommentImage = (index: number) => {
    setCommentImages((prev) => prev.filter((_, i) => i !== index));
    setCommentImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleCheckItem = async (index: number, checked: boolean) => {
    if (!task) return;
    // Optimistic update
    const updated = [...(task.checklist ?? [])];
    updated[index] = { ...updated[index]!, checked };
    setTask({ ...task, checklist: updated });
    try {
      await api.fetch(`/panel/tasks/${taskId}/checklist`, { method: "PATCH", body: JSON.stringify({ index, checked }) });
      await fetchTask();
      onUpdate();
    } catch (err) { console.error(err); fetchTask(); }
  };

  const wrapSelection = (prefix: string, suffix: string) => {
    const el = commentTextRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = newComment;
    const selected = text.slice(start, end);
    const before = text.slice(0, start);
    const after = text.slice(end);
    if (selected) {
      setNewComment(before + prefix + selected + suffix + after);
      setTimeout(() => { el.focus(); el.setSelectionRange(start + prefix.length, end + prefix.length); }, 0);
    } else {
      setNewComment(before + prefix + suffix + after);
      setTimeout(() => { el.focus(); el.setSelectionRange(start + prefix.length, start + prefix.length); }, 0);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await api.fetch(`/panel/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" });
      await fetchTask();
    } catch (err) { console.error(err); }
  };

  const uploadAttachment = async (file: globalThis.File) => {
    setUploadFileName(file.name);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append("file", file);
    try {
      // Upload (0-85%)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/panel/tasks/${taskId}/attachments`);
        xhr.setRequestHeader("Authorization", `Bearer ${api.getAccessToken()}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 85));
        };
        xhr.onload = () => {
          setUploadProgress(92);
          if (xhr.status >= 200 && xhr.status < 300) resolve(); else reject(new Error(`HTTP ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(formData);
      });
      // Refresh (92-100%)
      setUploadProgress(96);
      await fetchTask();
      setUploadProgress(100);
    } catch (err) { console.error(err); }
    finally { setUploadProgress(null); setUploadFileName(""); }
  };

  const deleteAttachment = async (attachmentId: string) => {
    setDeletingAttachmentId(attachmentId);
    try {
      await api.fetch(`/panel/tasks/${taskId}/attachments/${attachmentId}`, { method: "DELETE" });
      await fetchTask();
    } catch (err) { console.error(err); }
    finally { setDeletingAttachmentId(null); }
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

  if (!task) return null;

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
            {(task.checklist ?? []).length > 0 && (
              <Link href={`/panel/tasks/${taskId}/analise`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                <Play className="h-3 w-3" /> Modo Interativo
              </Link>
            )}
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

            {/* Checklist */}
            {(task.checklist ?? []).length > 0 && (() => {
              const checkItems = (task.checklist ?? []).filter(c => c.type !== "text");
              const doneCount = checkItems.filter(c => c.checked).length;
              const totalCount = checkItems.length;
              const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 100;
              return (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <CheckSquare className="h-3.5 w-3.5" />
                      Verificacoes ({doneCount}/{totalCount})
                    </p>
                    <span className="text-[10px] text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-3">
                    <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="space-y-1">
                    {(task.checklist ?? []).map((item, i) => (
                      item.type === "text" ? (
                        <div key={i} className="px-3 py-1.5">
                          <span className="text-xs font-semibold text-foreground">{item.label}</span>
                        </div>
                      ) : (
                        <label key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors hover:bg-muted/40 ${item.checked ? "opacity-60" : ""}`}>
                          <button type="button" onClick={() => toggleCheckItem(i, !item.checked)} className="shrink-0">
                            {item.checked ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                          </button>
                          <span className={`text-sm ${item.checked ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.label}</span>
                        </label>
                      )
                    ))}
                  </div>
                </div>
              );
            })()}

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
                        <p className="text-[10px] text-muted-foreground truncate">{getFieldLabel(key)}</p>
                        {key === "user_id" ? (
                          <a
                            href={`https://dashboard.marjosports.com.br/back-office/online-client/search?query=ID&field=${String(value)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-blue-500 hover:underline truncate block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {String(value)}
                          </a>
                        ) : (
                          <p className="text-xs font-medium truncate text-foreground">{formatValue(key, value)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Attachments section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  Anexos {(task.attachments ?? []).length > 0 && `(${(task.attachments ?? []).length})`}
                </p>
                <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${uploadProgress !== null ? "text-muted-foreground pointer-events-none" : "text-primary cursor-pointer hover:bg-primary/10"}`}>
                  {uploadProgress !== null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploadProgress !== null ? "Enviando..." : "Enviar"}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAttachment(f); e.target.value = ""; }}
                  />
                </label>
              </div>

              {uploadProgress !== null && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                    <p className="text-xs text-foreground truncate flex-1">{uploadFileName}</p>
                    <span className="text-xs font-semibold text-primary shrink-0">{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {(task.attachments ?? []).length === 0 && uploadProgress === null ? (
                <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-lg border border-dashed border-border cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Arraste ou clique para enviar imagens e documentos</p>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAttachment(f); e.target.value = ""; }}
                  />
                </label>
              ) : (
                <div className="space-y-3">
                  {/* Image previews grid */}
                  {(() => {
                    const images = (task.attachments ?? []).filter((a) => a.fileType.startsWith("image/"));
                    const files = (task.attachments ?? []).filter((a) => !a.fileType.startsWith("image/"));
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
                    return (
                      <>
                        {images.length > 0 && (
                          <div className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                            {images.map((att) => (
                              <div key={att.id} className="relative group rounded-lg overflow-hidden border border-border bg-muted/30">
                                <img
                                  src={`${apiUrl}/uploads/${att.filePath}`}
                                  alt={att.fileName}
                                  className="w-full h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => setPreviewImage(`${apiUrl}/uploads/${att.filePath}`)}
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                                  <p className="text-[10px] text-white truncate">{att.fileName}</p>
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteAttachment(att.id); }}
                                  disabled={deletingAttachmentId === att.id}
                                  className={`absolute top-1.5 right-1.5 p-1 rounded-md bg-black/50 text-white hover:bg-destructive transition-all ${deletingAttachmentId === att.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                                >
                                  {deletingAttachmentId === att.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {files.length > 0 && (
                          <div className="space-y-1.5">
                            {files.map((att) => (
                              <div key={att.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/20 group hover:bg-muted/40 transition-colors">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                                  <File className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate text-foreground">{att.fileName}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {att.fileSize < 1024 ? `${att.fileSize} B` : att.fileSize < 1048576 ? `${Math.round(att.fileSize / 1024)} KB` : `${(att.fileSize / 1048576).toFixed(1)} MB`}
                                    {" — "}{new Date(att.createdAt).toLocaleDateString("pt-BR")}
                                  </p>
                                </div>
                                <a
                                  href={`${apiUrl}/uploads/${att.filePath}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                  title="Baixar"
                                >
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </a>
                                <button
                                  onClick={() => deleteAttachment(att.id)}
                                  disabled={deletingAttachmentId === att.id}
                                  className={`p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all ${deletingAttachmentId === att.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                                >
                                  {deletingAttachmentId === att.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

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
                <div className="flex-1">
                  <div className="rounded-lg border border-input bg-muted/30 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
                    {/* Formatting toolbar */}
                    <div className="flex items-center gap-0.5 px-2 pt-1.5 border-b border-border/50 pb-1">
                      <button type="button" onClick={() => wrapSelection("**", "**")} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Negrito (Ctrl+B)"><Bold className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => wrapSelection("*", "*")} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Italico (Ctrl+I)"><Italic className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => wrapSelection("__", "__")} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Sublinhado (Ctrl+U)"><Underline className="h-3.5 w-3.5" /></button>
                    </div>
                    <textarea
                      ref={commentTextRef}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={commentImages.length > 0 ? "Adicionar legenda (opcional)..." : "Escrever comentario ou colar imagem (Ctrl+V)..."}
                      rows={2}
                      className="w-full bg-transparent px-3 py-2 text-sm resize-none outline-none min-h-[52px]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(); }
                        if (e.ctrlKey || e.metaKey) {
                          if (e.key === "b") { e.preventDefault(); wrapSelection("**", "**"); }
                          if (e.key === "i") { e.preventDefault(); wrapSelection("*", "*"); }
                          if (e.key === "u") { e.preventDefault(); wrapSelection("__", "__"); }
                        }
                      }}
                      onPaste={(e) => {
                        const items = e.clipboardData?.items;
                        if (!items) return;
                        for (const item of Array.from(items)) {
                          if (item.type.startsWith("image/")) {
                            e.preventDefault();
                            const file = item.getAsFile();
                            if (file) handleCommentImage(file);
                          }
                        }
                      }}
                    />
                    {/* Image previews */}
                    {commentImagePreviews.length > 0 && (
                      <div className="px-3 pb-2 flex flex-wrap gap-2">
                        {commentImagePreviews.map((preview, idx) => (
                          <div key={idx} className="relative inline-block rounded-lg overflow-hidden border border-border">
                            <img src={preview} alt={`Preview ${idx + 1}`} className="max-h-32 max-w-[120px] object-contain" />
                            <button
                              onClick={() => removeCommentImage(idx)}
                              className="absolute top-1 right-1 p-0.5 rounded-md bg-black/60 text-white hover:bg-destructive transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Actions bar */}
                    <div className="flex items-center justify-between px-2 pb-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => commentFileRef.current?.click()}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Anexar imagem"
                        >
                          <Image className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"; input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) uploadAttachment(f); }; input.click(); }}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Anexar arquivo"
                        >
                          <Paperclip className="h-4 w-4" />
                        </button>
                        <input
                          ref={commentFileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => { Array.from(e.target.files || []).forEach(handleCommentImage); e.target.value = ""; }}
                          multiple
                        />
                      </div>
                      <button
                        onClick={addComment}
                        disabled={(!newComment.trim() && commentImages.length === 0) || sendingComment}
                        className="p-1.5 rounded-md text-primary hover:bg-primary/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                      >
                        {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
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
                              {item.message && <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{parseFormatted(item.message)}</p>}
                              {item.imageUrl && (() => {
                                const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
                                const urls: string[] = item.imageUrl.startsWith("[")
                                  ? JSON.parse(item.imageUrl).map((p: string) => `${apiUrl}/uploads/${p}`)
                                  : [`${apiUrl}/uploads/${item.imageUrl}`];
                                return (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {urls.map((url, ui) => (
                                      <img key={ui} src={url} alt={`Imagem ${ui + 1}`}
                                        className="max-h-48 rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={(e) => { e.stopPropagation(); setPreviewImage(url); }}
                                      />
                                    ))}
                                  </div>
                                );
                              })()}
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

      {/* Image lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={() => setPreviewImage(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// MAIN PAGE (KANBAN)
// ═══════════════════════════════════════
export default function PanelTasksPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const isAdmin = hasPermission("users:manage");

  const [tasks, setTasks] = useState<PanelTaskItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [webhookType, setWebhookType] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const hasFilters = startDate || endDate || assignedTo || webhookType;

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (assignedTo) params.set("assignedTo", assignedTo);
      if (webhookType) params.set("webhookType", webhookType);
      const data = await api.fetch<{ tasks: PanelTaskItem[]; users: UserOption[] }>(`/panel/tasks?${params}`);
      setTasks(data.tasks);
      setUsers(data.users);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [startDate, endDate, assignedTo, webhookType]);

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
              <Label className="text-xs">Tipo</Label>
              <select className="flex h-8 rounded-md border border-input bg-transparent px-3 text-sm text-foreground" value={webhookType} onChange={(e) => setWebhookType(e.target.value)}>
                <option value="">Todos</option>
                {WEBHOOK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Responsavel</Label>
              <select className="flex h-8 rounded-md border border-input bg-transparent px-3 text-sm text-foreground" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="">Todos</option>
                {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
              </select>
            </div>
            {hasFilters && <Button variant="ghost" size="sm" onClick={() => { setStartDate(""); setEndDate(""); setAssignedTo(""); setWebhookType(""); }}><X className="h-4 w-4" /> Limpar</Button>}
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
