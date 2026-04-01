"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getFieldLabel } from "@/lib/field-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Trash2, UserPlus, Lock, Unlock, Timer, AlertCircle, Loader2,
  Users, CheckCircle, XCircle, History, ShieldAlert, ShieldCheck,
  Bell, MessageSquare, Save, X, Settings, BarChart3,
  ArrowLeft, Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface LockGroupMember {
  id: string;
  ngxUserId: string;
  ngxUsername: string | null;
  ngxName: string | null;
  addedAt: string;
}

interface TimeSlot {
  startHour: number;
  endHour: number;
  lockSeconds: number;
}

interface LockGroupDetail {
  id: string;
  name: string;
  lockSeconds: number;
  active: boolean;
  notifyPanel: boolean;
  notifyChat: boolean;
  chatWebhookUrl: string | null;
  timeSlots: TimeSlot[];
  members: LockGroupMember[];
}

interface LockGroupEvent {
  id: string;
  action: string;
  userId: string | null;
  userName: string | null;
  reason: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
}

interface LockStatus {
  locked: boolean;
  lockedAt: string | null;
  unlockAt: string | null;
  triggerUserName?: string;
  triggerUserId?: string;
}

interface NgxUser {
  _id: string;
  username: string;
  name: string;
  created_at: string;
  removed: boolean;
  last_login: string;
}

// ── Modal Component ──
function Modal({
  open,
  onClose,
  title,
  icon,
  iconBg,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
              {icon}
            </div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4 text-foreground" />
          </Button>
        </div>
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ── Main Page ──
export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [group, setGroup] = useState<LockGroupDetail | null>(null);
  const [events, setEvents] = useState<LockGroupEvent[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  // Chart
  const [chartData, setChartData] = useState<Array<{ time: string; count: number }>>([]);
  const [chartTotal, setChartTotal] = useState(0);
  const [chartStartDate, setChartStartDate] = useState("");
  const [chartEndDate, setChartEndDate] = useState("");
  const [chartGroupBy, setChartGroupBy] = useState<"hour" | "day">("hour");

  // Notifications
  const [notifyPanel, setNotifyPanel] = useState(false);
  const [notifyChat, setNotifyChat] = useState(false);
  const [chatWebhookUrl, setChatWebhookUrl] = useState("");
  const [savingNotify, setSavingNotify] = useState(false);
  const [notifySaved, setNotifySaved] = useState(false);

  // Lock status & countdown
  const [lockStatus, setLockStatus] = useState<LockStatus | null>(null);
  const [countdown, setCountdown] = useState("");
  const [countdownPercent, setCountdownPercent] = useState(0);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Lock confirm modal
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [locking, setLocking] = useState(false);
  const [lockResult, setLockResult] = useState<{ success: boolean; message: string } | null>(null);

  // Add member
  const [newUserId, setNewUserId] = useState("");
  const [validating, setValidating] = useState(false);
  const [validatedUser, setValidatedUser] = useState<NgxUser | null>(null);
  const [addError, setAddError] = useState("");

  const fetchGroup = useCallback(async () => {
    try {
      const [data, eventsData] = await Promise.all([
        api.fetch<LockGroupDetail>(`/groups/${groupId}`),
        api.fetch<LockGroupEvent[]>(`/groups/${groupId}/events?limit=30`),
      ]);
      setGroup(data);
      setEvents(eventsData);
      setNotifyPanel(data.notifyPanel);
      setNotifyChat(data.notifyChat);
      setChatWebhookUrl(data.chatWebhookUrl || "");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const fetchChart = useCallback(async () => {
    try {
      const params = new URLSearchParams({ groupBy: chartGroupBy });
      if (chartStartDate) params.set("startDate", chartStartDate);
      if (chartEndDate) params.set("endDate", chartEndDate);
      const data = await api.fetch<{
        data: Array<{ time: string; count: number }>;
        total: number;
      }>(`/groups/${groupId}/events/chart?${params}`);
      setChartData(data.data);
      setChartTotal(data.total);
    } catch (err) {
      console.error(err);
    }
  }, [groupId, chartStartDate, chartEndDate, chartGroupBy]);

  const fetchLockStatus = useCallback(async () => {
    try {
      const data = await api.fetch<LockStatus>(`/groups/${groupId}/lock-status`);
      setLockStatus(data);
    } catch (err) {
      console.error(err);
    }
  }, [groupId]);

  useEffect(() => {
    fetchGroup();
    fetchLockStatus();
  }, [fetchGroup, fetchLockStatus]);

  useEffect(() => {
    fetchChart();
  }, [fetchChart]);

  // Polling lock status every 5s
  useEffect(() => {
    const interval = setInterval(fetchLockStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchLockStatus]);

  // Countdown timer
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);

    if (!lockStatus?.locked || !lockStatus.unlockAt || !lockStatus.lockedAt) {
      setCountdown("");
      setCountdownPercent(0);
      return;
    }

    const totalDuration = new Date(lockStatus.unlockAt).getTime() - new Date(lockStatus.lockedAt).getTime();

    const tick = () => {
      const remaining = new Date(lockStatus.unlockAt!).getTime() - Date.now();
      if (remaining <= 0) {
        setCountdown("");
        setCountdownPercent(0);
        setLockStatus(null);
        fetchLockStatus();
        fetchGroup();
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
      setCountdownPercent(totalDuration > 0 ? ((totalDuration - remaining) / totalDuration) * 100 : 0);
    };

    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [lockStatus, fetchLockStatus, fetchGroup]);

  const validateUser = async () => {
    if (!newUserId.trim()) return;
    setValidating(true);
    setAddError("");
    setValidatedUser(null);
    try {
      const user = await api.fetch<NgxUser>(
        `/groups/${groupId}/members/validate/${newUserId}`
      );
      setValidatedUser(user);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Usuario nao encontrado");
    } finally {
      setValidating(false);
    }
  };

  const confirmAddMember = async () => {
    if (!validatedUser) return;
    try {
      await api.fetch(`/groups/${groupId}/members`, {
        method: "POST",
        body: JSON.stringify({ ngxUserId: validatedUser._id }),
      });
      setNewUserId("");
      setValidatedUser(null);
      setShowAddMemberModal(false);
      fetchGroup();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Erro ao adicionar");
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      await api.fetch(`/groups/${groupId}/members/${memberId}`, { method: "DELETE" });
      fetchGroup();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLock = async () => {
    setLocking(true);
    setLockResult(null);
    try {
      const result = await api.fetch<{ success: boolean; message: string; lockedUsers: string[]; failedUsers: string[] }>(
        `/groups/${groupId}/lock`,
        { method: "POST" }
      );
      setLockResult({
        success: true,
        message: `${result.lockedUsers.length} usuario${result.lockedUsers.length !== 1 ? "s" : ""} bloqueado${result.lockedUsers.length !== 1 ? "s" : ""} com sucesso.${result.failedUsers.length > 0 ? ` ${result.failedUsers.length} falha(s).` : ""}`,
      });
      fetchGroup();
      fetchLockStatus();
    } catch (err) {
      setLockResult({
        success: false,
        message: err instanceof Error ? err.message : "Erro ao bloquear grupo",
      });
    } finally {
      setLocking(false);
    }
  };

  const saveNotifications = async () => {
    setSavingNotify(true);
    setNotifySaved(false);
    try {
      await api.fetch(`/groups/${groupId}`, {
        method: "PUT",
        body: JSON.stringify({
          notifyPanel,
          notifyChat,
          chatWebhookUrl: notifyChat ? chatWebhookUrl : null,
        }),
      });
      setNotifySaved(true);
      fetchGroup();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNotify(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertCircle className="h-7 w-7 text-destructive" />
        </div>
        <p className="font-medium text-foreground">Grupo nao encontrado</p>
      </div>
    );
  }

  const notifyStatus = group.notifyPanel || group.notifyChat;
  const isLocked = lockStatus?.locked ?? false;
  const lockDurationLabel = group.timeSlots && group.timeSlots.length > 0
    ? `${group.timeSlots.length} faixas`
    : `${Math.floor(group.lockSeconds / 60)}min ${group.lockSeconds % 60 > 0 ? `${group.lockSeconds % 60}s` : ""}`;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/groups")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-card/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground">{group.name}</h1>
              {isLocked ? (
                <Badge variant="destructive" className="rounded-lg text-[10px] gap-1 animate-pulse">
                  <Lock className="h-2.5 w-2.5" /> BLOQUEADO
                </Badge>
              ) : (
                <Badge variant="outline" className="rounded-lg text-[10px] gap-1 text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
                  <Unlock className="h-2.5 w-2.5" /> LIVRE
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Grupo de bloqueio automatico
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5 text-xs h-8"
            onClick={() => setShowNotifyModal(true)}
          >
            <Settings className="h-3.5 w-3.5" />
            Notificacoes
            {notifyStatus && <div className="h-1.5 w-1.5 rounded-full bg-green-500" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5 text-xs h-8"
            onClick={() => setShowAddMemberModal(true)}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Membro
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="rounded-xl gap-1.5 text-xs h-8"
            disabled={isLocked}
            onClick={() => { setShowLockConfirm(true); setLockResult(null); }}
          >
            <Lock className="h-3.5 w-3.5" />
            {isLocked ? "Bloqueado" : "Bloquear"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5 text-xs h-8"
            onClick={() =>
              api.fetch(`/groups/${groupId}/unlock`, { method: "POST" }).then(() => {
                fetchGroup();
                fetchLockStatus();
              })
            }
          >
            <Unlock className="h-3.5 w-3.5" />
            Desbloquear
          </Button>
        </div>
      </div>

      {/* ── Lock Countdown Banner ── */}
      {isLocked && countdown && (
        <Card className="rounded-2xl border-red-200 bg-gradient-to-r from-red-50 to-red-100/50 dark:border-red-900/40 dark:from-red-950/40 dark:to-red-950/20 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-5 px-5 py-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 dark:bg-red-500/20">
                <ShieldAlert className="h-7 w-7 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                  Grupo Bloqueado
                </p>
                <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-0.5">
                  {lockStatus?.triggerUserName
                    ? `Ativado por ${lockStatus.triggerUserName}`
                    : "Bloqueio automatico ativo"}
                  {" \u00b7 "}{group.members.length} membros afetados
                </p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl font-bold tabular-nums tracking-tight text-red-700 dark:text-red-300">
                  {countdown}
                </span>
                <span className="text-[9px] uppercase tracking-widest text-red-500/60 dark:text-red-400/50 font-medium">
                  restante
                </span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-1 w-full bg-red-200/50 dark:bg-red-900/30">
              <div
                className="h-full bg-red-500 dark:bg-red-400 transition-all duration-1000 ease-linear"
                style={{ width: `${countdownPercent}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="rounded-2xl border-border/50 bg-card/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
              <Users className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{group.members.length}</p>
              <p className="text-[11px] text-muted-foreground">Membros</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 bg-card/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
              <Timer className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{lockDurationLabel}</p>
              <p className="text-[11px] text-muted-foreground">Duracao do bloqueio</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 bg-card/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
              <BarChart3 className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{chartTotal}</p>
              <p className="text-[11px] text-muted-foreground">Bloqueios totais</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 bg-card/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${notifyStatus ? "bg-green-500/10" : "bg-muted"}`}>
              <Bell className={`h-5 w-5 ${notifyStatus ? "text-green-500" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {notifyStatus ? "Ativo" : "Off"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {group.notifyPanel && group.notifyChat
                  ? "Painel + Chat"
                  : group.notifyPanel
                  ? "Painel"
                  : group.notifyChat
                  ? "Google Chat"
                  : "Sem notificacao"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Time Slots (24h clock visual) ── */}
      {group.timeSlots && group.timeSlots.length > 0 && (() => {
        const sortedSlots = group.timeSlots.slice().sort((a: TimeSlot, b: TimeSlot) => a.startHour - b.startHour);

        // A slot wraps midnight if startHour >= endHour (e.g. 22:00-08:00)
        const isWrapSlot = (s: TimeSlot) => s.startHour >= s.endHour;

        // Check if a given hour falls inside a slot (handles wrap)
        const hourInSlot = (hour: number, s: TimeSlot) => {
          if (isWrapSlot(s)) return hour >= s.startHour || hour < s.endHour;
          return hour >= s.startHour && hour < s.endHour;
        };

        // Expand a slot into 1 or 2 linear segments [start, end] within 0-24
        const slotSegments = (s: TimeSlot): Array<[number, number]> => {
          if (isWrapSlot(s)) return [[s.startHour, 24], [0, s.endHour]];
          return [[s.startHour, s.endHour]];
        };

        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeDecimal = currentHour + currentMinute / 60;
        const currentTimeStr = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;

        // Find active slot for current hour (handles wrap)
        const activeSlot = sortedSlots.find((s: TimeSlot) => hourInSlot(currentHour, s));
        const activeLockMinutes = activeSlot
          ? `${Math.floor(activeSlot.lockSeconds / 60)}min${activeSlot.lockSeconds % 60 > 0 ? ` ${activeSlot.lockSeconds % 60}s` : ""}`
          : `${Math.floor(group.lockSeconds / 60)}min${group.lockSeconds % 60 > 0 ? ` ${group.lockSeconds % 60}s` : ""} (fallback)`;



        return (
          <Card className="rounded-2xl border-border/50 bg-card/80">
            <CardContent className="p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">Ciclo 24h</p>
                </div>
                <span className="text-[10px] text-muted-foreground bg-muted rounded-lg px-2 py-0.5 font-mono">
                  fallback {group.lockSeconds}s
                </span>
              </div>

              {/* Timeline */}
              <div className="relative mt-6 mb-2">
                {/* Slot bars with labels */}
                <div className="relative h-8 rounded-lg overflow-hidden bg-muted/50">
                  {/* Slot coverage bars with duration text */}
                  {sortedSlots.flatMap((slot: TimeSlot, i: number) =>
                    slotSegments(slot).map(([a, b], j) => {
                      const left = (a / 24) * 100;
                      const width = ((b - a) / 24) * 100;
                      const isActive = activeSlot === slot;
                      const durationLabel = `${Math.floor(slot.lockSeconds / 60)}min${slot.lockSeconds % 60 > 0 ? `${slot.lockSeconds % 60}s` : ""}`;
                      const spanHours = b - a;

                      return (
                        <div
                          key={`${i}-${j}`}
                          className={`absolute inset-y-0 flex items-center justify-center transition-colors ${
                            isActive
                              ? "bg-emerald-500/80 dark:bg-emerald-500/60"
                              : "bg-primary/25 dark:bg-primary/20"
                          }`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          {spanHours >= 2 && (
                            <span className={`text-[10px] font-bold font-mono ${
                              isActive
                                ? "text-white dark:text-white"
                                : "text-primary/70 dark:text-primary/60"
                            }`}>
                              {durationLabel}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Current time indicator */}
                <div
                  className="absolute -top-5 flex flex-col items-center pointer-events-none"
                  style={{ left: `${(currentTimeDecimal / 24) * 100}%`, transform: "translateX(-50%)" }}
                >
                  <span className="text-[9px] font-bold font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 rounded px-1 py-0.5 leading-none">
                    {currentTimeStr}
                  </span>
                  <div className="w-0.5 h-[38px] bg-emerald-500 rounded-full shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
                </div>

                {/* Hour labels */}
                <div className="relative h-4 mt-1">
                  {Array.from({ length: 25 }, (_, h) => h).filter(h => h % 3 === 0).map((h) => (
                    <span
                      key={h}
                      className="absolute text-[9px] text-muted-foreground/50 font-mono -translate-x-1/2"
                      style={{ left: `${(h / 24) * 100}%` }}
                    >
                      {String(h === 24 ? 0 : h).padStart(2, "0")}h
                    </span>
                  ))}
                </div>
              </div>

              {/* Slot legend below */}
              <div className="flex flex-wrap gap-2 mt-6">
                {sortedSlots.map((slot: TimeSlot, i: number) => {
                  const isActive = activeSlot === slot;
                  const startStr = `${String(slot.startHour).padStart(2, "0")}:00`;
                  const endStr = `${String(slot.endHour).padStart(2, "0")}:00`;
                  const durationLabel = `${Math.floor(slot.lockSeconds / 60)}min${slot.lockSeconds % 60 > 0 ? `${slot.lockSeconds % 60}s` : ""}`;

                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-mono ${
                        isActive
                          ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                          : "bg-muted/30 border-border/50 text-muted-foreground"
                      }`}
                    >
                      {isActive && (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        </span>
                      )}
                      <span>{startStr}-{endStr}</span>
                      <span className="font-bold">{durationLabel}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Members ── */}
      <Card className="rounded-2xl border-border/50 bg-card/80 overflow-hidden">
        <CardHeader className="pb-0 px-5 pt-5">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Users className="h-4 w-4 text-violet-500" />
              Membros
              <Badge variant="secondary" className="rounded-lg text-[10px] ml-1">
                {group.members.length}
              </Badge>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl gap-1.5 text-xs h-7 text-primary"
              onClick={() => setShowAddMemberModal(true)}
            >
              <UserPlus className="h-3 w-3" />
              Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          {group.members.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <Users className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum membro</p>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 text-xs mt-1"
                onClick={() => setShowAddMemberModal(true)}
              >
                <UserPlus className="h-3 w-3" /> Adicionar primeiro membro
              </Button>
            </div>
          ) : (
            <div className="border-t border-border/30">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/20">
                    <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">ID NGX</th>
                    <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Username</th>
                    <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Nome</th>
                    <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Adicionado</th>
                    <th className="px-5 py-2.5 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {group.members.map((member) => (
                    <tr key={member.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-5 py-3 text-xs font-mono text-foreground">{member.ngxUserId}</td>
                      <td className="px-5 py-3 text-xs text-foreground">{member.ngxUsername ?? "-"}</td>
                      <td className="px-5 py-3 text-xs text-foreground hidden sm:table-cell">{member.ngxName ?? "-"}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground hidden md:table-cell">
                        {new Date(member.addedAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-5 py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-lg h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeMember(member.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Chart + History (side by side on lg) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Chart: 3/5 width */}
        <Card className="rounded-2xl border-border/50 bg-card/80 lg:col-span-3">
          <CardHeader className="pb-3 px-5 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                Bloqueios por Periodo
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant={chartGroupBy === "hour" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-lg text-[10px] h-7 px-2.5"
                  onClick={() => setChartGroupBy("hour")}
                >
                  Hora
                </Button>
                <Button
                  type="button"
                  variant={chartGroupBy === "day" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-lg text-[10px] h-7 px-2.5"
                  onClick={() => setChartGroupBy("day")}
                >
                  Dia
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {/* Date filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={chartStartDate}
                onChange={(e) => setChartStartDate(e.target.value)}
                className="w-36 h-8 rounded-lg border-border/40 bg-muted/30 text-foreground text-xs"
                placeholder="Inicio"
              />
              <span className="text-xs text-muted-foreground">ate</span>
              <Input
                type="date"
                value={chartEndDate}
                onChange={(e) => setChartEndDate(e.target.value)}
                className="w-36 h-8 rounded-lg border-border/40 bg-muted/30 text-foreground text-xs"
                placeholder="Fim"
              />
              {(chartStartDate || chartEndDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-lg gap-1 text-[10px] h-7 text-muted-foreground"
                  onClick={() => { setChartStartDate(""); setChartEndDate(""); }}
                >
                  <X className="h-3 w-3" /> Limpar
                </Button>
              )}
            </div>

            {/* Chart */}
            {chartData.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <BarChart3 className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">Nenhum bloqueio no periodo</p>
              </div>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 9 }}
                      angle={-30}
                      textAnchor="end"
                      height={45}
                      tickFormatter={(v) => {
                        if (chartGroupBy === "day") {
                          return new Date(v + "T00:00:00").toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                          });
                        }
                        const parts = v.split(" ");
                        const date = new Date(parts[0] + "T00:00:00");
                        return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${parts[1]?.replace(":00", "h")}`;
                      }}
                    />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={30} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "10px",
                        border: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-card)",
                        color: "var(--color-foreground)",
                        fontSize: "12px",
                      }}
                      labelFormatter={(v) => {
                        if (chartGroupBy === "day") return new Date(v + "T00:00:00").toLocaleDateString("pt-BR");
                        return v;
                      }}
                      formatter={(v) => [`${v} bloqueio${Number(v) !== 1 ? "s" : ""}`, "Bloqueios"]}
                    />
                    <Bar dataKey="count" fill="#ef4444" name="Bloqueios" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* History: 2/5 width */}
        <Card className="rounded-2xl border-border/50 bg-card/80 lg:col-span-2">
          <CardHeader className="pb-3 px-5 pt-5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <History className="h-4 w-4 text-amber-500" />
              Historico
              <Badge variant="secondary" className="rounded-lg text-[10px] ml-1">
                {events.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {events.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <History className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">Nenhum evento</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                {events.map((event) => {
                  const isLockEvent = event.action === "locked";
                  const d = event.data;
                  const betValue = (d?.bet_value ?? d?.casino_bet_value) as number | undefined;
                  const betType = d?.type as string | undefined;
                  const userName = (d?.user_name as string) || (d?.user_username as string);
                  const isExpanded = expandedEventId === event.id;

                  return (
                    <div
                      key={event.id}
                      className={`rounded-xl transition-colors ${isLockEvent && d ? "cursor-pointer" : ""} ${isExpanded ? "bg-muted/40" : "hover:bg-muted/30"}`}
                      onClick={() => isLockEvent && d && setExpandedEventId(isExpanded ? null : event.id)}
                    >
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            isLockEvent ? "bg-red-100 dark:bg-red-900/30" : "bg-green-100 dark:bg-green-900/30"
                          }`}
                        >
                          {isLockEvent ? (
                            <ShieldAlert className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                          ) : (
                            <ShieldCheck className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-foreground truncate">
                              {userName || event.userName || "Sistema"}
                            </span>
                            {betValue && (
                              <span className="text-xs font-semibold text-primary shrink-0">
                                R$ {Number(betValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                            )}
                            <Badge
                              variant={isLockEvent ? "destructive" : "outline"}
                              className="rounded text-[8px] px-1 py-0 h-4 shrink-0"
                            >
                              {isLockEvent ? "LOCK" : "UNLOCK"}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(event.createdAt).toLocaleString("pt-BR")}
                            {betType && ` · ${betType === "SPORT_BET" ? "Esportiva" : betType === "CASINO_BET" ? "Cassino" : betType}`}
                          </p>
                        </div>
                      </div>

                      {/* Dados expandidos da aposta */}
                      {isExpanded && d && (
                        <div className="px-3 pb-3">
                          <div className="rounded-lg border border-border bg-muted/20 p-3">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dados da Aposta</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                              {Object.entries(d)
                                .filter(([k]) => k !== "type")
                                .filter(([, v]) => v !== null && v !== undefined && v !== "")
                                .map(([key, value]) => (
                                  <div key={key}>
                                    <p className="text-[9px] text-muted-foreground">{getFieldLabel(key)}</p>
                                    <p className="text-[11px] font-medium text-foreground truncate">
                                      {typeof value === "number" && (key.includes("value") || key.includes("credits") || key.includes("prize"))
                                        ? `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                        : String(value)}
                                    </p>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Modal: Notificacoes ── */}
      <Modal
        open={showNotifyModal}
        onClose={() => { setShowNotifyModal(false); setNotifySaved(false); }}
        title="Notificacoes de Bloqueio"
        icon={<Bell className="h-4 w-4 text-blue-500" />}
        iconBg="bg-blue-500/10"
      >
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Configure onde enviar o aviso quando um jogador do grupo apostar e o bloqueio for ativado.
          </p>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/50 px-4 py-3 transition-all duration-200 hover:bg-muted/50">
            <input
              type="checkbox"
              checked={notifyPanel}
              onChange={(e) => { setNotifyPanel(e.target.checked); setNotifySaved(false); }}
              className="h-4 w-4 rounded accent-primary"
            />
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Painel</p>
                <p className="text-xs text-muted-foreground">Exibir no sino de notificacoes</p>
              </div>
            </div>
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/50 px-4 py-3 transition-all duration-200 hover:bg-muted/50">
            <input
              type="checkbox"
              checked={notifyChat}
              onChange={(e) => { setNotifyChat(e.target.checked); setNotifySaved(false); }}
              className="h-4 w-4 rounded accent-primary"
            />
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Google Chat</p>
                <p className="text-xs text-muted-foreground">Enviar para webhook</p>
              </div>
            </div>
          </label>

          {notifyChat && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">URL do Webhook</Label>
              <Input
                value={chatWebhookUrl}
                onChange={(e) => { setChatWebhookUrl(e.target.value); setNotifySaved(false); }}
                placeholder="https://chat.googleapis.com/v1/spaces/..."
                className="h-10 rounded-xl border-border/60 bg-background/50 text-foreground"
              />
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              className="rounded-xl gap-2 shadow-sm"
              disabled={savingNotify}
              onClick={saveNotifications}
            >
              {savingNotify ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingNotify ? "Salvando..." : "Salvar"}
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setShowNotifyModal(false)}>
              Cancelar
            </Button>
            {notifySaved && (
              <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" /> Salvo!
              </span>
            )}
          </div>
        </div>
      </Modal>

      {/* ── Modal: Adicionar Membro ── */}
      <Modal
        open={showAddMemberModal}
        onClose={() => {
          setShowAddMemberModal(false);
          setNewUserId("");
          setValidatedUser(null);
          setAddError("");
        }}
        title="Adicionar Membro"
        icon={<UserPlus className="h-4 w-4 text-cyan-500" />}
        iconBg="bg-cyan-500/10"
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <Input
              placeholder="ID do usuario NGX"
              value={newUserId}
              onChange={(e) => {
                setNewUserId(e.target.value);
                setValidatedUser(null);
                setAddError("");
              }}
              className="h-11 rounded-xl border-border/60 bg-background/50 text-foreground font-mono"
            />
            <Button
              onClick={validateUser}
              disabled={validating || !newUserId}
              className="rounded-xl shadow-sm"
            >
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validar"}
            </Button>
          </div>

          {addError && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{addError}</p>
            </div>
          )}

          {validatedUser && (
            <div className="rounded-2xl border border-border/50 bg-muted/30 p-5 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <p className="font-medium text-foreground">Confirme os dados:</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "ID", value: validatedUser._id, mono: true },
                  { label: "Username", value: validatedUser.username },
                  { label: "Nome", value: validatedUser.name },
                  { label: "Criado em", value: validatedUser.created_at },
                  { label: "Removido", value: validatedUser.removed ? "Sim" : "Nao" },
                  { label: "Ultimo login", value: validatedUser.last_login },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-background/50 p-3">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <p className={`text-foreground ${item.mono ? "font-mono" : ""}`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-1">
                <Button
                  size="sm"
                  onClick={confirmAddMember}
                  className="rounded-xl gap-1.5 shadow-sm"
                >
                  <CheckCircle className="h-3.5 w-3.5" /> Confirmar e Adicionar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl gap-1.5"
                  onClick={() => { setValidatedUser(null); setNewUserId(""); }}
                >
                  <XCircle className="h-3.5 w-3.5" /> Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Modal: Confirmar Bloqueio ── */}
      <Modal
        open={showLockConfirm}
        onClose={() => { if (!locking) setShowLockConfirm(false); }}
        title={lockResult ? (lockResult.success ? "Grupo Bloqueado" : "Erro ao Bloquear") : "Confirmar Bloqueio"}
        icon={
          lockResult?.success
            ? <CheckCircle className="h-4 w-4 text-green-500" />
            : <ShieldAlert className="h-4 w-4 text-red-500" />
        }
        iconBg={lockResult?.success ? "bg-green-500/10" : "bg-red-500/10"}
      >
        {!lockResult ? (
          <div className="space-y-5">
            <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 p-4">
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                Tem certeza que deseja bloquear este grupo?
              </p>
              <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">
                Todos os <span className="font-semibold">{group.members.length} membros</span> serao bloqueados imediatamente.
                {group.timeSlots && group.timeSlots.length > 0
                  ? " O tempo de bloqueio sera definido pela faixa de horario atual."
                  : ` Duracao: ${Math.floor(group.lockSeconds / 60)}min ${group.lockSeconds % 60 > 0 ? `${group.lockSeconds % 60}s` : ""}.`
                }
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="destructive"
                className="rounded-xl gap-2 shadow-sm flex-1"
                disabled={locking}
                onClick={handleLock}
              >
                {locking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Bloqueando...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Confirmar Bloqueio
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={locking}
                onClick={() => setShowLockConfirm(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className={`rounded-xl border p-4 ${
              lockResult.success
                ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/40"
                : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40"
            }`}>
              <div className="flex items-center gap-2.5">
                {lockResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                )}
                <p className={`text-sm font-medium ${
                  lockResult.success ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
                }`}>
                  {lockResult.message}
                </p>
              </div>
            </div>
            <Button
              className="rounded-xl w-full"
              onClick={() => setShowLockConfirm(false)}
            >
              Fechar
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
