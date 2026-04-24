"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { api } from "@/lib/api";
import { getFieldLabel, webhookTypeLabels } from "@/lib/field-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, X, ExternalLink, Play, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { CATEGORY_PERMISSIONS, type AlertCategory } from "@/lib/categories";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
const COLLAPSED_STORAGE_KEY = "notifications_panel_collapsed";
const CATEGORY_STORAGE_KEY = "notifications_panel_category";
const ALERT_FILTER_STORAGE_KEY = "notifications_panel_alert";
const ALL_ALERTS = "__all__";

interface Notification {
  id: string;
  webhookType: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  source: string;
  createdAt: string;
  alertConfig: { name: string } | null;
  taskId?: string | null;
  taskStatus?: string | null;
  assignedToId?: string | null;
  assignedToName?: string | null;
}

interface TaskUpdateEvent {
  _event: "update";
  id: string;
  taskId: string | null;
  taskStatus: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

function AssigneeAvatar({ name }: { name: string }) {
  return (
    <div
      title={`Assumido por ${name}`}
      className="ml-auto shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-semibold ring-1 ring-primary/30"
    >
      {getInitials(name)}
    </div>
  );
}

type CategoryId = "todos" | AlertCategory;

const CATEGORIES: {
  id: CategoryId;
  label: string;
  permission: string | null;
  match: (n: Notification) => boolean;
}[] = [
  { id: "todos", label: "Todos", permission: null, match: () => true },
  {
    id: "sportbook",
    label: "Sportbook",
    permission: CATEGORY_PERMISSIONS.sportbook,
    match: (n) => ["SPORT_BET", "SPORT_PRIZE"].includes(n.webhookType),
  },
  {
    id: "cassino",
    label: "Cassino",
    permission: CATEGORY_PERMISSIONS.cassino,
    match: (n) => ["CASINO_BET", "CASINO_PRIZE", "CASINO_REFUND"].includes(n.webhookType),
  },
  {
    id: "finance",
    label: "Financeiro",
    permission: CATEGORY_PERMISSIONS.finance,
    match: (n) =>
      ["DEPOSIT", "DEPOSIT_REQUEST", "WITHDRAWAL_REQUEST", "WITHDRAWAL_CONFIRMATION"].includes(
        n.webhookType
      ),
  },
  {
    id: "blocks",
    label: "Bloqueios",
    permission: CATEGORY_PERMISSIONS.blocks,
    match: (n) => n.source === "group_lock",
  },
];

export function NotificationBell() {
  const router = useRouter();
  const { user: currentUser, hasPermission } = useAuth();

  const visibleCategories = useMemo(
    () =>
      CATEGORIES.filter(
        (c) => c.permission === null || hasPermission(c.permission)
      ),
    [hasPermission]
  );
  const hasAnyCategory = visibleCategories.some((c) => c.permission !== null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [category, setCategory] = useState<CategoryId>("todos");
  const [alertFilter, setAlertFilter] = useState<string>(ALL_ALERTS);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [popup, setPopup] = useState<Notification | null>(null);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted state
  useEffect(() => {
    try {
      const storedRead = localStorage.getItem("notifications_read_ids");
      if (storedRead) setReadIds(new Set(JSON.parse(storedRead)));
      const storedCollapsed = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      if (storedCollapsed === "1") setCollapsed(true);
      const storedCategory = localStorage.getItem(CATEGORY_STORAGE_KEY) as CategoryId | null;
      if (storedCategory && CATEGORIES.some((c) => c.id === storedCategory)) {
        setCategory(storedCategory);
      }
      const storedAlert = localStorage.getItem(ALERT_FILTER_STORAGE_KEY);
      if (storedAlert) setAlertFilter(storedAlert);
    } catch {}
  }, []);

  const prevCountRef = useRef<number>(0);

  const showPopup = useCallback((notification: Notification) => {
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    setPopup(notification);
    popupTimerRef.current = setTimeout(() => setPopup(null), 6000);
  }, []);

  // Pede permissao de notificacao nativa uma vez
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (window.Notification.permission === "default") {
      window.Notification.requestPermission().catch(() => {});
    }
  }, []);

  const buildPlainMessage = useCallback((n: Notification): string => {
    if (n.source === "group_lock") {
      const groupName =
        (n.data.groupName as string) || n.title.match(/"(.+?)"/)?.[1] || "Grupo";
      const isUnlock = n.title.toLowerCase().includes("desbloqueado");
      const triggerName = (n.data.triggerUserName as string) || (n.data.user_name as string) || "";
      const betValue = n.data.bet_value
        ? ` R$ ${Number(n.data.bet_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
        : "";
      if (isUnlock) {
        const elapsed = n.data.elapsedSec ? ` apos ${n.data.elapsedSec}s` : "";
        return `${groupName} desbloqueado${elapsed}.`;
      }
      return `${groupName} bloqueado - ${triggerName} apostou${betValue}.`;
    }
    const userName =
      (n.data.user_name as string) ||
      (n.data.user_username as string) ||
      "Usuario";
    const action = webhookTypeLabels[n.webhookType] || "disparou alerta";
    const fmt = (v: unknown) =>
      `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    const val = (() => {
      const d = n.data;
      switch (n.webhookType) {
        case "WITHDRAWAL_REQUEST":
        case "WITHDRAWAL_CONFIRMATION":
          return d.withdraw_value;
        case "DEPOSIT_REQUEST":
        case "DEPOSIT":
          return d.deposit_value;
        case "SPORT_BET":
        case "CASINO_BET":
          return d.bet_value;
        case "SPORT_PRIZE":
          return d.bet_return_value;
        case "CASINO_PRIZE":
          return d.prize_value;
        case "CASINO_REFUND":
          return d.refunded_value;
        default:
          return undefined;
      }
    })();
    const detail = val !== undefined && val !== null && val !== "" ? ` de ${fmt(val)}` : "";
    return `${userName} ${action}${detail}.`;
  }, []);

  const showNativeNotification = useCallback(
    (notification: Notification) => {
      if (typeof window === "undefined") return;
      if (!("Notification" in window)) return;
      if (window.Notification.permission !== "granted") return;
      try {
        const title = notification.alertConfig?.name ?? "Alerta";
        const body = buildPlainMessage(notification);
        const n = new window.Notification(title, {
          body,
          icon: "/favicon.ico",
          tag: notification.id,
        });
        n.onclick = () => {
          window.focus();
          if (notification.taskId) {
            router.push(`/panel/tasks/${notification.taskId}/analise`);
          }
          n.close();
        };
      } catch {
        // ignore
      }
    },
    [buildPlainMessage, router]
  );

  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
      osc.onended = () => ctx.close();
    } catch {
      // Audio not available
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.fetch<Notification[]>("/panel/notifications");
      prevCountRef.current = data.length;
      setNotifications(data);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    let eventSource: EventSource | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    function connectSSE() {
      api.loadTokens();
      const token = api.getAccessToken();
      if (!token) {
        fallbackInterval = setInterval(fetchNotifications, 5000);
        return;
      }

      eventSource = new EventSource(
        `${API_URL}/panel/notifications/stream?token=${encodeURIComponent(token)}`
      );

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.connected) return;

          // Task update event (someone claimed or completed a task)
          if (data._event === "update") {
            const u = data as TaskUpdateEvent;
            setNotifications((prev) =>
              prev.map((n) =>
                n.id === u.id
                  ? {
                      ...n,
                      taskId: u.taskId,
                      taskStatus: u.taskStatus,
                      assignedToId: u.assignedToId,
                      assignedToName: u.assignedToName,
                    }
                  : n
              )
            );
            return;
          }

          setNotifications((prev) => {
            const exists = prev.some((n) => n.id === data.id);
            if (exists) return prev;
            const next = [data, ...prev].slice(0, 50);
            return next;
          });

          showPopup(data);
          playNotificationSound();
          if (typeof document !== "undefined" && document.hidden) {
            showNativeNotification(data);
          }
        } catch {
          // ignore parse errors
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        setTimeout(connectSSE, 5000);
      };
    }

    connectSSE();

    return () => {
      eventSource?.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [fetchNotifications, playNotificationSound, showPopup, showNativeNotification]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const alertOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notifications) {
      const name = n.alertConfig?.name;
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([name, count]) => ({ name, count }));
  }, [notifications]);

  const effectiveCategory = useMemo<CategoryId>(() => {
    if (visibleCategories.some((c) => c.id === category)) return category;
    return "todos";
  }, [visibleCategories, category]);

  const filtered = useMemo(() => {
    const match =
      visibleCategories.find((c) => c.id === effectiveCategory)?.match ?? (() => true);
    return notifications.filter((n) => {
      if (!match(n)) return false;
      if (alertFilter !== ALL_ALERTS && n.alertConfig?.name !== alertFilter) return false;
      return true;
    });
  }, [notifications, effectiveCategory, alertFilter, visibleCategories]);

  const countsByCategory = useMemo(() => {
    const out: Record<CategoryId, number> = {
      todos: 0,
      sportbook: 0,
      cassino: 0,
      finance: 0,
      blocks: 0,
    };
    for (const n of notifications) {
      if (readIds.has(n.id)) continue;
      for (const c of CATEGORIES) {
        if (c.match(n)) out[c.id] += 1;
      }
    }
    return out;
  }, [notifications, readIds]);

  const saveReadIds = (ids: Set<string>) => {
    setReadIds(ids);
    const arr = Array.from(ids).slice(-200);
    localStorage.setItem("notifications_read_ids", JSON.stringify(arr));
  };

  const markAsRead = (id: string) => {
    if (readIds.has(id)) return;
    const next = new Set(readIds);
    next.add(id);
    saveReadIds(next);
  };

  const markAllRead = () => {
    const next = new Set(readIds);
    notifications.forEach((n) => next.add(n.id));
    saveReadIds(next);
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  const selectCategory = (id: CategoryId) => {
    setCategory(id);
    localStorage.setItem(CATEGORY_STORAGE_KEY, id);
  };

  const selectAlertFilter = (name: string) => {
    setAlertFilter(name);
    localStorage.setItem(ALERT_FILTER_STORAGE_KEY, name);
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  };

  const formatMessage = (n: Notification) => {
    if (n.source === "group_lock") {
      const groupName =
        (n.data.groupName as string) || n.title.match(/"(.+?)"/)?.[1] || "Grupo";
      const isUnlock = n.title.toLowerCase().includes("desbloqueado");
      const triggerName = (n.data.triggerUserName as string) || (n.data.user_name as string) || "";
      const betValue = n.data.bet_value
        ? ` R$ ${Number(n.data.bet_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
        : "";

      if (isUnlock) {
        const elapsed = n.data.elapsedSec ? ` apos ${n.data.elapsedSec}s` : "";
        return (
          <>
            <span className="font-semibold text-green-600 dark:text-green-400">{groupName}</span>{" "}
            desbloqueado{elapsed}.
          </>
        );
      }

      return (
        <>
          <span className="font-semibold text-red-600 dark:text-red-400">{groupName}</span>{" "}
          bloqueado — <span className="font-semibold">{triggerName}</span> apostou
          {betValue}.
        </>
      );
    }

    const userName =
      (n.data.user_name as string) ||
      (n.data.user_username as string) ||
      "Usuario";
    const action = webhookTypeLabels[n.webhookType] || "disparou alerta";

    const fmt = (v: unknown) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    const val = (() => {
      const d = n.data;
      switch (n.webhookType) {
        case "WITHDRAWAL_REQUEST": case "WITHDRAWAL_CONFIRMATION": return d.withdraw_value;
        case "DEPOSIT_REQUEST": case "DEPOSIT": return d.deposit_value;
        case "SPORT_BET": case "CASINO_BET": return d.bet_value;
        case "SPORT_PRIZE": return d.bet_return_value;
        case "CASINO_PRIZE": return d.prize_value;
        case "CASINO_REFUND": return d.refunded_value;
        default: return undefined;
      }
    })();
    const detail = val !== undefined && val !== null && val !== "" ? ` de ${fmt(val)}` : "";

    return (
      <>
        <span className="font-semibold">{userName}</span> {action}
        {detail}.
      </>
    );
  };

  if (!hasAnyCategory) return null;

  return (
    <>
      {/* Alert Popup Toast */}
      {popup && (
        <div
          className="fixed top-4 right-4 z-[100] w-96 animate-in slide-in-from-top-2 fade-in duration-300 rounded-xl border border-border/60 dark:border-white/10 bg-card shadow-2xl dark:shadow-black/60 overflow-hidden cursor-pointer"
          onClick={() => {
            setCollapsed(false);
            localStorage.setItem(COLLAPSED_STORAGE_KEY, "0");
            setPopup(null);
          }}
        >
          <div className="h-1 bg-primary" />
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{popup.alertConfig?.name ?? "Alerta"}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{formatMessage(popup)}</p>
                {popup.taskId ? (
                  popup.taskStatus === "done" ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setPopup(null); router.push(`/panel/tasks/${popup.taskId}/analise`); }}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors"
                    >
                      <CheckCircle className="h-3 w-3" /> Visualizar Analise
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setPopup(null); router.push(`/panel/tasks/${popup.taskId}/analise`); }}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                    >
                      <Play className="h-3 w-3" /> Iniciar Analise
                    </button>
                  )
                ) : (
                  <p className="text-[10px] text-muted-foreground mt-1">Agora</p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setPopup(null); }}
                className="shrink-0 p-1 rounded-md hover:bg-muted text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Feed Panel */}
      <div
        className={`fixed bottom-4 right-4 z-40 rounded-xl border border-border/60 dark:border-white/10 bg-card shadow-2xl dark:shadow-black/60 overflow-hidden flex flex-col ${
          collapsed ? "w-72" : "w-[400px]"
        }`}
      >
        {/* Header */}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex items-center justify-between px-4 py-3 border-b border-border/60 dark:border-white/5 hover:bg-muted/40 dark:hover:bg-white/[0.03] transition-colors text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-sm font-semibold text-foreground truncate">Feed em tempo real</span>
            {unreadCount > 0 && (
              <span className="shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground shadow-sm ring-2 ring-card">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!collapsed && notifications.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded cursor-pointer"
                onClick={(e) => { e.stopPropagation(); markAllRead(); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); markAllRead(); } }}
              >
                Marcar lidas
              </span>
            )}
            {collapsed ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {!collapsed && (
          <>
            {/* Category Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-border/60 dark:border-white/5 px-2 py-2 no-scrollbar">
              {visibleCategories.map((c) => {
                const active = effectiveCategory === c.id;
                const count = countsByCategory[c.id];
                return (
                  <button
                    key={c.id}
                    onClick={() => selectCategory(c.id)}
                    className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {c.label}
                    {count > 0 && (
                      <span
                        className={`text-[10px] rounded-full px-1.5 min-w-[18px] text-center ${
                          active
                            ? "bg-background/20 text-background"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Alert filter (chips) */}
            {alertOptions.length >= 2 && (
              <div className="flex items-center gap-1 overflow-x-auto border-b border-border/60 dark:border-white/5 px-2 py-1.5 no-scrollbar">
                <button
                  onClick={() => selectAlertFilter(ALL_ALERTS)}
                  className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                    alertFilter === ALL_ALERTS
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Todos
                </button>
                {alertOptions.map((a) => {
                  const active = alertFilter === a.name;
                  return (
                    <button
                      key={a.name}
                      onClick={() => selectAlertFilter(a.name)}
                      className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                        active
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {a.name}
                      <span className="text-[10px] text-muted-foreground">({a.count})</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma notificacao
                </div>
              ) : (
                filtered.map((n) => {
                  const isUnread = !readIds.has(n.id);
                  const isExpanded = expandedId === n.id;
                  return (
                    <div
                      key={n.id}
                      className={`border-b border-border/60 dark:border-white/5 px-4 py-3 transition-colors cursor-pointer hover:bg-muted/50 dark:hover:bg-white/[0.03] last:border-b-0 ${
                        isUnread
                          ? "bg-primary/10 dark:bg-primary/[0.07] border-l-2 border-l-primary/80"
                          : "opacity-80"
                      }`}
                      onClick={() => {
                        markAsRead(n.id);
                        setExpandedId(isExpanded ? null : n.id);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {isUnread ? (
                          <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary animate-pulse" />
                        ) : (
                          <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/30" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm leading-snug ${
                              isUnread
                                ? "font-semibold text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {formatMessage(n)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] text-muted-foreground">
                              {formatTime(n.createdAt)}
                            </span>
                            <Badge
                              variant={isUnread ? "secondary" : "outline"}
                              className="text-[10px] px-1.5 py-0"
                            >
                              {n.alertConfig?.name ?? "Alerta"}
                            </Badge>
                            {isUnread && (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0">
                                Nova
                              </Badge>
                            )}
                            {n.taskId && n.taskStatus === "done" && (
                              <button
                                onClick={(e) => { e.stopPropagation(); markAsRead(n.id); router.push(`/panel/tasks/${n.taskId}/analise`); }}
                                className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-500 transition-colors"
                              >
                                <CheckCircle className="h-2.5 w-2.5" /> Concluida
                              </button>
                            )}
                            {n.taskId && n.taskStatus !== "done" && (() => {
                              const ownedByMe = n.assignedToId && currentUser && n.assignedToId === currentUser.id;
                              const ownedByOther = n.assignedToId && currentUser && n.assignedToId !== currentUser.id;
                              if (ownedByOther && n.assignedToName) {
                                return <AssigneeAvatar name={n.assignedToName} />;
                              }
                              return (
                                <button
                                  onClick={(e) => { e.stopPropagation(); markAsRead(n.id); router.push(`/panel/tasks/${n.taskId}/analise`); }}
                                  className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-semibold hover:bg-primary/90 transition-colors"
                                >
                                  <Play className="h-2.5 w-2.5" /> {ownedByMe ? "Continuar" : "Analisar"}
                                </button>
                              );
                            })()}
                            {!n.taskId && (
                              <span className="text-[11px] text-primary ml-auto">
                                {isExpanded ? "Fechar" : "Ver detalhes"}
                              </span>
                            )}
                          </div>

                          {isExpanded && (
                            <div className="mt-2 space-y-2">
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                                {Object.entries(n.data)
                                  .filter(([, v]) => v !== "" && v !== null && v !== undefined)
                                  .slice(0, 12)
                                  .map(([key, value]) => (
                                    <div key={key} className="flex flex-col">
                                      <span className="text-muted-foreground">{getFieldLabel(key)}</span>
                                      <span className="font-medium text-foreground truncate">
                                        {String(value)}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                              {Object.keys(n.data).length > 12 && (
                                <p className="text-[10px] text-muted-foreground">
                                  +{Object.keys(n.data).length - 12} campos
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(n.createdAt).toLocaleString("pt-BR")}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-border/60 dark:border-white/5 p-2">
                <Link
                  href="/panel/alerts"
                  className="flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-primary hover:bg-muted dark:hover:bg-white/[0.03]"
                >
                  Ver todos os alertas
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export function NotificationPanel() {
  return <NotificationBell />;
}
