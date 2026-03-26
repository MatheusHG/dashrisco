"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Lock, Unlock, Settings, Users, Timer, Loader2, ShieldOff, ShieldAlert, ShieldCheck, Clock } from "lucide-react";
import Link from "next/link";

interface LockGroupEvent {
  id: string;
  action: string;
  userName: string | null;
  createdAt: string;
}

interface LockGroup {
  id: string;
  name: string;
  lockSeconds: number;
  active: boolean;
  createdAt: string;
  _count: { members: number };
  lastEvent: LockGroupEvent | null;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<LockGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.fetch<LockGroup[]>("/groups");
      setGroups(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const lockGroup = async (id: string) => {
    await api.fetch(`/groups/${id}/lock`, { method: "POST" });
    fetchGroups();
  };

  const unlockGroup = async (id: string) => {
    await api.fetch(`/groups/${id}/unlock`, { method: "POST" });
    fetchGroups();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
            <Lock className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Grupos de Bloqueio</h1>
            <p className="text-sm text-muted-foreground">Gerencie grupos e controle de acesso</p>
          </div>
        </div>
        <Link href="/groups/new">
          <Button className="rounded-xl gap-2 shadow-sm transition-all duration-200 hover:shadow-md">
            <Plus className="h-4 w-4" /> Novo Grupo
          </Button>
        </Link>
      </div>

      {/* Groups List */}
      <div className="grid gap-4">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Carregando...</span>
          </div>
        ) : groups.length === 0 ? (
          <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm backdrop-blur-sm">
            <CardContent className="flex flex-col items-center gap-3 py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <ShieldOff className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">Nenhum grupo criado</p>
                <p className="text-sm text-muted-foreground">Crie o primeiro grupo de bloqueio para comecar</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          groups.map((group) => {
            const isLocked = group.lastEvent?.action === "locked";
            const lastEvent = group.lastEvent;

            return (
              <Card
                key={group.id}
                className={`rounded-2xl border-border/50 bg-card/80 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md cursor-pointer ${
                  isLocked ? "border-l-4 border-l-red-500" : ""
                }`}
                onClick={() => window.location.href = `/groups/${group.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                            isLocked
                              ? "bg-red-500/10"
                              : group.active
                              ? "bg-emerald-500/10"
                              : "bg-muted"
                          }`}
                        >
                          {isLocked ? (
                            <ShieldAlert className="h-4 w-4 text-red-500" />
                          ) : (
                            <Lock
                              className={`h-4 w-4 ${
                                group.active
                                  ? "text-emerald-500"
                                  : "text-muted-foreground"
                              }`}
                            />
                          )}
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">
                          {group.name}
                        </h3>
                        <Badge
                          variant={group.active ? "success" : "secondary"}
                          className="rounded-lg"
                        >
                          {group.active ? "Ativo" : "Inativo"}
                        </Badge>
                        {isLocked && (
                          <Badge
                            variant="destructive"
                            className="rounded-lg gap-1 animate-pulse"
                          >
                            <ShieldAlert className="h-3 w-3" />
                            Bloqueado
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 pl-12 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          {group._count.members} membros
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Timer className="h-3.5 w-3.5" />
                          Bloqueio: {group.lockSeconds}s
                        </span>
                      </div>

                      {/* Last event status */}
                      {lastEvent && (
                        <div
                          className={`ml-12 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${
                            isLocked
                              ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                              : "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                          }`}
                        >
                          {isLocked ? (
                            <ShieldAlert className="h-3 w-3" />
                          ) : (
                            <ShieldCheck className="h-3 w-3" />
                          )}
                          <span className="font-medium">
                            {isLocked ? "Bloqueado" : "Desbloqueado"}
                          </span>
                          <span>por {lastEvent.userName ?? "Sistema"}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(lastEvent.createdAt).toLocaleString("pt-BR")}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {isLocked ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl gap-1.5"
                          onClick={() => unlockGroup(group.id)}
                        >
                          <Unlock className="h-3.5 w-3.5" />
                          Desbloquear
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="rounded-xl gap-1.5 shadow-sm transition-all duration-200 hover:shadow-md"
                          onClick={() => lockGroup(group.id)}
                        >
                          <Lock className="h-3.5 w-3.5" />
                          Bloquear
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
