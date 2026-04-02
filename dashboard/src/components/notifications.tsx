"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { getFieldLabel, webhookTypeLabels } from "@/lib/field-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, X, ExternalLink, Play, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";


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
}

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [popup, setPopup] = useState<Notification | null>(null);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load read IDs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("notifications_read_ids");
      if (stored) setReadIds(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  const prevCountRef = useRef<number>(0);

  const showPopup = useCallback((notification: Notification) => {
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    setPopup(notification);
    popupTimerRef.current = setTimeout(() => setPopup(null), 6000);
  }, []);

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

  // Initial fetch of existing notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.fetch<Notification[]>("/panel/notifications");
      prevCountRef.current = data.length;
      setNotifications(data);
    } catch {
      // silently fail
    }
  }, []);

  // SSE connection for real-time updates
  useEffect(() => {
    // Fetch initial data
    fetchNotifications();

    let eventSource: EventSource | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    function connectSSE() {
      api.loadTokens();
      const token = api.getAccessToken();
      if (!token) {
        // No token yet, poll as fallback
        fallbackInterval = setInterval(fetchNotifications, 5000);
        return;
      }

      eventSource = new EventSource(
        `${API_URL}/panel/notifications/stream?token=${encodeURIComponent(token)}`
      );

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.connected) return; // Initial connection event

          // Prepend new notification
          setNotifications((prev) => {
            const exists = prev.some((n) => n.id === data.id);
            if (exists) return prev;
            const next = [data, ...prev].slice(0, 50);
            return next;
          });

          // Show popup and play sound
          showPopup(data);
          playNotificationSound();
        } catch {
          // ignore parse errors
        }
      };

      eventSource.onerror = () => {
        // SSE disconnected, close and retry after 5s
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
  }, [fetchNotifications, playNotificationSound, showPopup]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

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

  const toggleOpen = () => {
    setOpen((prev) => !prev);
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
    // Group lock notifications
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

    // Regular alert notifications
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

  return (
    <div className="relative" ref={panelRef}>
      {/* Alert Popup Toast */}
      {popup && (
        <div
          className="fixed top-4 right-4 z-[100] w-96 animate-in slide-in-from-top-2 fade-in duration-300 rounded-xl border border-border bg-card shadow-2xl overflow-hidden cursor-pointer"
          onClick={() => { setOpen(true); setPopup(null); }}
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

      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={toggleOpen}
      >
        <Bell className="h-5 w-5 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 rounded-xl border border-border bg-card shadow-lg z-50">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Notificacoes</h3>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={markAllRead}
                >
                  Marcar como lidas
                </button>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5 text-foreground" />
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma notificacao
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = !readIds.has(n.id);
                const isExpanded = expandedId === n.id;
                return (
                  <div
                    key={n.id}
                    className={`border-b border-border px-4 py-3 transition-colors cursor-pointer hover:bg-muted/50 ${
                      isUnread
                        ? "bg-primary/10 border-l-2 border-l-primary"
                        : "opacity-70"
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
                              onClick={(e) => { e.stopPropagation(); markAsRead(n.id); setOpen(false); router.push(`/panel/tasks/${n.taskId}/analise`); }}
                              className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-500 transition-colors"
                            >
                              <CheckCircle className="h-2.5 w-2.5" /> Concluida
                            </button>
                          )}
                          {n.taskId && n.taskStatus !== "done" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); markAsRead(n.id); setOpen(false); router.push(`/panel/tasks/${n.taskId}/analise`); }}
                              className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-semibold hover:bg-primary/90 transition-colors"
                            >
                              <Play className="h-2.5 w-2.5" /> Analisar
                            </button>
                          )}
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
            <div className="border-t border-border p-2">
              <Link
                href="/panel/alerts"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-primary hover:bg-muted"
              >
                Ver todos os alertas
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
