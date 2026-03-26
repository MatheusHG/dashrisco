"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollText, Filter, Loader2, ChevronLeft, ChevronRight, FileText, Eye, EyeOff } from "lucide-react";

interface LogEntry {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (actionFilter) params.set("action", actionFilter);

      const data = await api.fetch<{
        logs: LogEntry[];
        totalPages: number;
      }>(`/logs?${params}`);
      setLogs(data.logs);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
          <ScrollText className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Logs do Sistema</h1>
          <p className="text-sm text-muted-foreground">Registro de atividades e eventos</p>
        </div>
      </div>

      {/* Filter */}
      <div className="relative max-w-sm">
        <Filter className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filtrar por acao (ex: user.login)"
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="h-11 rounded-xl border-border/60 bg-card/80 pl-10 backdrop-blur-sm transition-all duration-200 focus:bg-background focus:shadow-sm"
        />
      </div>

      {/* Table */}
      <Card className="rounded-2xl border-border/50 bg-card/80 shadow-sm backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data/Hora</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Usuario</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acao</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Entidade</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">IP</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Carregando...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Nenhum log encontrado</p>
                        <p className="text-sm text-muted-foreground">Ajuste os filtros ou aguarde novas atividades</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log, i) => (
                  <Fragment key={log.id}>
                    <tr className={`transition-colors duration-150 hover:bg-muted/40 ${i % 2 === 0 ? "" : "bg-muted/15"}`}>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {new Date(log.createdAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {log.user?.name ?? (
                          <span className="text-muted-foreground italic">Sistema</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="rounded-lg font-mono text-xs">{log.action}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {log.entity ?? "-"}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-muted-foreground">
                        {log.ip ?? "-"}
                      </td>
                      <td className="px-6 py-4">
                        {log.details && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg gap-1.5 text-xs"
                            onClick={() =>
                              setExpandedId(
                                expandedId === log.id ? null : log.id
                              )
                            }
                          >
                            {expandedId === log.id ? (
                              <><EyeOff className="h-3.5 w-3.5" /> Fechar</>
                            ) : (
                              <><Eye className="h-3.5 w-3.5" /> Ver</>
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                    {expandedId === log.id && log.details && (
                      <tr key={`${log.id}-details`}>
                        <td colSpan={6} className="bg-muted/30 px-6 py-4">
                          <pre className="overflow-auto max-h-48 rounded-xl bg-muted/50 p-4 text-xs text-foreground font-mono border border-border/30">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/80 px-4 py-2">
            <span className="text-sm font-medium text-foreground">{page}</span>
            <span className="text-sm text-muted-foreground">de</span>
            <span className="text-sm font-medium text-foreground">{totalPages}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Proximo
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
