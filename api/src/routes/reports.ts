import { FastifyInstance } from "fastify";
import { authorize } from "../middlewares/auth";

/** Converte "2026-03-25" em fim do dia (23:59:59.999) */
function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export async function reportRoutes(app: FastifyInstance) {
  // Ranking de usuários que mais concluíram tasks
  app.get(
    "/ranking",
    { preHandler: authorize("panel:read", "logs:read") },
    async (request) => {
      const query = request.query as {
        startDate?: string;
        endDate?: string;
        alertConfigId?: string;
        webhookType?: string;
      };

      const where: Record<string, unknown> = {
        status: "done",
        completedBy: { not: null },
      };

      if (query.alertConfigId) where.alertConfigId = query.alertConfigId;
      if (query.startDate || query.endDate) {
        where.completedAt = {};
        if (query.startDate)
          (where.completedAt as Record<string, unknown>).gte = new Date(query.startDate);
        if (query.endDate)
          (where.completedAt as Record<string, unknown>).lte = endOfDay(query.endDate);
      }

      // Filtrar por tipo via alertConfig -> panelAlert -> webhookType
      // PanelTask não tem webhookType direto, filtramos pelo alertConfigId das configs desse tipo
      if (query.webhookType) {
        const configsOfType = await app.prisma.alertConfig.findMany({
          where: { webhookType: query.webhookType as any },
          select: { id: true },
        });
        where.alertConfigId = { in: configsOfType.map((c) => c.id) };
      }

      const tasks = await app.prisma.panelTask.findMany({
        where,
        select: {
          completedBy: true,
          completedAt: true,
          createdAt: true,
          alertConfigId: true,
        },
      });

      // Agrupar por usuário
      const userMap = new Map<
        string,
        { count: number; totalSlaMs: number; slaTimes: number[] }
      >();
      for (const task of tasks) {
        if (!task.completedBy) continue;
        const entry = userMap.get(task.completedBy) || {
          count: 0,
          totalSlaMs: 0,
          slaTimes: [],
        };
        entry.count++;
        const slaMs =
          (task.completedAt?.getTime() ?? 0) - task.createdAt.getTime();
        entry.totalSlaMs += slaMs;
        entry.slaTimes.push(slaMs);
        userMap.set(task.completedBy, entry);
      }

      // Buscar nomes dos usuários
      const userIds = Array.from(userMap.keys());
      const users = await app.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      });

      const userNameMap = new Map(users.map((u) => [u.id, u.name]));

      const ranking = Array.from(userMap.entries())
        .map(([userId, data]) => ({
          userId,
          userName: userNameMap.get(userId) ?? "Desconhecido",
          tasksCompleted: data.count,
          avgSlaMinutes: Math.round(data.totalSlaMs / data.count / 60000),
          minSlaMinutes: Math.round(Math.min(...data.slaTimes) / 60000),
          maxSlaMinutes: Math.round(Math.max(...data.slaTimes) / 60000),
        }))
        .sort((a, b) => b.tasksCompleted - a.tasksCompleted);

      return ranking;
    }
  );

  // Estatísticas de alertas disparados por tipo/config
  app.get(
    "/alerts-stats",
    { preHandler: authorize("panel:read", "logs:read") },
    async (request) => {
      const query = request.query as {
        startDate?: string;
        endDate?: string;
        webhookType?: string;
      };

      const where: Record<string, unknown> = {};
      if (query.webhookType) where.webhookType = query.webhookType;
      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate)
          (where.createdAt as Record<string, unknown>).gte = new Date(query.startDate);
        if (query.endDate)
          (where.createdAt as Record<string, unknown>).lte = endOfDay(query.endDate);
      }

      // Disparos agrupados por alerta
      const panelAlerts = await app.prisma.panelAlert.findMany({
        where,
        select: {
          alertConfigId: true,
          webhookType: true,
          createdAt: true,
          alertConfig: { select: { name: true } },
        },
      });

      // Por config
      const byConfig = new Map<
        string,
        { name: string; count: number }
      >();
      for (const pa of panelAlerts) {
        const key = pa.alertConfigId ?? "system";
        const entry = byConfig.get(key) || {
          name: pa.alertConfig?.name ?? "Sistema",
          count: 0,
        };
        entry.count++;
        byConfig.set(key, entry);
      }

      // Por tipo de webhook
      const byType = new Map<string, number>();
      for (const pa of panelAlerts) {
        byType.set(pa.webhookType, (byType.get(pa.webhookType) || 0) + 1);
      }

      // Por dia (últimos 30 dias)
      const byDay = new Map<string, number>();
      for (const pa of panelAlerts) {
        const day = pa.createdAt.toISOString().split("T")[0]!;
        byDay.set(day, (byDay.get(day) || 0) + 1);
      }

      return {
        byConfig: Array.from(byConfig.entries())
          .map(([id, data]) => ({
            alertConfigId: id,
            name: data.name,
            count: data.count,
          }))
          .sort((a, b) => b.count - a.count),
        byType: Array.from(byType.entries())
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count),
        byDay: Array.from(byDay.entries())
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        total: panelAlerts.length,
      };
    }
  );

  // Ranking por categoria (webhookType)
  app.get(
    "/ranking-by-type",
    { preHandler: authorize("panel:read", "logs:read") },
    async (request) => {
      const query = request.query as {
        startDate?: string;
        endDate?: string;
      };

      const alertWhere: Record<string, unknown> = {};
      if (query.startDate || query.endDate) {
        alertWhere.createdAt = {};
        if (query.startDate)
          (alertWhere.createdAt as Record<string, unknown>).gte = new Date(query.startDate);
        if (query.endDate)
          (alertWhere.createdAt as Record<string, unknown>).lte = endOfDay(query.endDate);
      }

      const panelAlerts = await app.prisma.panelAlert.findMany({
        where: alertWhere,
        select: {
          webhookType: true,
          alertConfigId: true,
          alertConfig: { select: { name: true } },
        },
      });

      // Tasks concluídas no período
      const taskWhere: Record<string, unknown> = {
        status: "done",
        completedBy: { not: null },
      };
      if (query.startDate || query.endDate) {
        taskWhere.completedAt = {};
        if (query.startDate)
          (taskWhere.completedAt as Record<string, unknown>).gte = new Date(query.startDate);
        if (query.endDate)
          (taskWhere.completedAt as Record<string, unknown>).lte = endOfDay(query.endDate);
      }

      const doneTasks = await app.prisma.panelTask.findMany({
        where: taskWhere,
        select: { alertConfigId: true, completedAt: true, createdAt: true },
      });

      // Mapear alertConfigId -> webhookType
      const configTypeMap = new Map<string, string>();
      for (const pa of panelAlerts) {
        const key = pa.alertConfigId ?? "system";
        if (!configTypeMap.has(key)) {
          configTypeMap.set(key, pa.webhookType);
        }
      }

      // Agrupar alertas por tipo
      const alertsByType = new Map<string, number>();
      for (const pa of panelAlerts) {
        alertsByType.set(pa.webhookType, (alertsByType.get(pa.webhookType) || 0) + 1);
      }

      // Agrupar tasks resolvidas por tipo
      const tasksByType = new Map<string, { count: number; totalSlaMs: number }>();
      for (const task of doneTasks) {
        const type = task.alertConfigId ? configTypeMap.get(task.alertConfigId) : null;
        if (!type) continue;
        const entry = tasksByType.get(type) || { count: 0, totalSlaMs: 0 };
        entry.count++;
        entry.totalSlaMs += (task.completedAt?.getTime() ?? 0) - task.createdAt.getTime();
        tasksByType.set(type, entry);
      }

      // Combinar
      const allTypes = new Set([...alertsByType.keys(), ...tasksByType.keys()]);
      const result = Array.from(allTypes).map((type) => {
        const alerts = alertsByType.get(type) || 0;
        const tasks = tasksByType.get(type) || { count: 0, totalSlaMs: 0 };
        return {
          webhookType: type,
          totalAlerts: alerts,
          totalResolved: tasks.count,
          resolutionRate: alerts > 0 ? Math.round((tasks.count / alerts) * 100) : 0,
          avgSlaMinutes: tasks.count > 0 ? Math.round(tasks.totalSlaMs / tasks.count / 60000) : 0,
        };
      }).sort((a, b) => b.totalAlerts - a.totalAlerts);

      return result;
    }
  );

  // Estatísticas de resolução de tasks
  app.get(
    "/resolution-stats",
    { preHandler: authorize("panel:read", "logs:read") },
    async (request) => {
      const query = request.query as {
        startDate?: string;
        endDate?: string;
        webhookType?: string;
      };

      const where: Record<string, unknown> = {};
      if (query.webhookType) {
        const configsOfType = await app.prisma.alertConfig.findMany({
          where: { webhookType: query.webhookType as any },
          select: { id: true },
        });
        where.alertConfigId = { in: configsOfType.map((c) => c.id) };
      }
      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate)
          (where.createdAt as Record<string, unknown>).gte = new Date(query.startDate);
        if (query.endDate)
          (where.createdAt as Record<string, unknown>).lte = endOfDay(query.endDate);
      }

      const allTasks = await app.prisma.panelTask.findMany({
        where,
        select: {
          status: true,
          createdAt: true,
          completedAt: true,
          completedBy: true,
        },
      });

      const total = allTasks.length;
      const open = allTasks.filter((t) => t.status === "open").length;
      const inProgress = allTasks.filter(
        (t) => t.status === "in_progress"
      ).length;
      const done = allTasks.filter((t) => t.status === "done").length;

      // SLA das concluídas
      const completedTasks = allTasks.filter(
        (t) => t.status === "done" && t.completedAt
      );
      const slaTimes = completedTasks.map(
        (t) => (t.completedAt!.getTime() - t.createdAt.getTime()) / 60000
      );

      const avgSla =
        slaTimes.length > 0
          ? Math.round(slaTimes.reduce((a, b) => a + b, 0) / slaTimes.length)
          : 0;
      const minSla =
        slaTimes.length > 0 ? Math.round(Math.min(...slaTimes)) : 0;
      const maxSla =
        slaTimes.length > 0 ? Math.round(Math.max(...slaTimes)) : 0;

      // SLA por colaborador
      const slaByUser = new Map<
        string,
        { totalMin: number; count: number }
      >();
      for (const t of completedTasks) {
        if (!t.completedBy) continue;
        const entry = slaByUser.get(t.completedBy) || {
          totalMin: 0,
          count: 0,
        };
        entry.totalMin +=
          (t.completedAt!.getTime() - t.createdAt.getTime()) / 60000;
        entry.count++;
        slaByUser.set(t.completedBy, entry);
      }

      const userIds = Array.from(slaByUser.keys());
      const users = await app.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      });
      const userNameMap = new Map(users.map((u) => [u.id, u.name]));

      return {
        total,
        open,
        inProgress,
        done,
        resolutionRate: total > 0 ? Math.round((done / total) * 100) : 0,
        sla: { avgMinutes: avgSla, minMinutes: minSla, maxMinutes: maxSla },
        slaByUser: Array.from(slaByUser.entries())
          .map(([userId, data]) => ({
            userId,
            userName: userNameMap.get(userId) ?? "Desconhecido",
            avgSlaMinutes: Math.round(data.totalMin / data.count),
            tasksCompleted: data.count,
          }))
          .sort((a, b) => a.avgSlaMinutes - b.avgSlaMinutes),
      };
    }
  );

  // Lista de alertas configs para o filtro
  app.get(
    "/alert-configs",
    { preHandler: authorize("panel:read", "logs:read") },
    async () => {
      return app.prisma.alertConfig.findMany({
        select: { id: true, name: true, webhookType: true, active: true },
        orderBy: { name: "asc" },
      });
    }
  );

  // Alertas por hora do dia (0-23)
  app.get(
    "/alerts-by-hour",
    { preHandler: authorize("panel:read", "logs:read") },
    async (request) => {
      const query = request.query as {
        startDate?: string;
        endDate?: string;
        webhookType?: string;
      };

      const where: Record<string, unknown> = {};
      if (query.webhookType) where.webhookType = query.webhookType;
      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate)
          (where.createdAt as Record<string, unknown>).gte = new Date(query.startDate);
        if (query.endDate)
          (where.createdAt as Record<string, unknown>).lte = endOfDay(query.endDate);
      }

      const alerts = await app.prisma.panelAlert.findMany({
        where,
        select: { createdAt: true },
      });

      const byHour = new Array(24).fill(0);
      for (const a of alerts) {
        const hour = a.createdAt.getHours();
        byHour[hour]++;
      }

      return byHour.map((count, hour) => ({ hour, count }));
    }
  );

  // Tendencias: compara periodo atual vs periodo anterior
  app.get(
    "/trends",
    { preHandler: authorize("panel:read", "logs:read") },
    async (request) => {
      const query = request.query as {
        startDate?: string;
        endDate?: string;
        webhookType?: string;
      };

      const now = new Date();
      const start = query.startDate ? new Date(query.startDate) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const end = query.endDate ? endOfDay(query.endDate) : now;
      const durationMs = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - durationMs);
      const prevEnd = new Date(start.getTime());

      const alertWhere: Record<string, unknown> = {};
      if (query.webhookType) alertWhere.webhookType = query.webhookType;

      const [currentAlerts, prevAlerts, currentTasks, prevTasks, currentDoneTasks, prevDoneTasks] = await Promise.all([
        app.prisma.panelAlert.count({ where: { ...alertWhere, createdAt: { gte: start, lte: end } } }),
        app.prisma.panelAlert.count({ where: { ...alertWhere, createdAt: { gte: prevStart, lte: prevEnd } } }),
        app.prisma.panelTask.count({ where: { createdAt: { gte: start, lte: end } } }),
        app.prisma.panelTask.count({ where: { createdAt: { gte: prevStart, lte: prevEnd } } }),
        app.prisma.panelTask.count({ where: { status: "done", completedAt: { gte: start, lte: end } } }),
        app.prisma.panelTask.count({ where: { status: "done", completedAt: { gte: prevStart, lte: prevEnd } } }),
      ]);

      // SLA current vs prev
      const currentCompleted = await app.prisma.panelTask.findMany({
        where: { status: "done", completedAt: { gte: start, lte: end } },
        select: { createdAt: true, completedAt: true },
      });
      const prevCompleted = await app.prisma.panelTask.findMany({
        where: { status: "done", completedAt: { gte: prevStart, lte: prevEnd } },
        select: { createdAt: true, completedAt: true },
      });

      const avgSla = (tasks: typeof currentCompleted) => {
        if (tasks.length === 0) return 0;
        const total = tasks.reduce((sum, t) => sum + ((t.completedAt?.getTime() ?? 0) - t.createdAt.getTime()), 0);
        return Math.round(total / tasks.length / 60000);
      };

      const calcDelta = (current: number, prev: number) => {
        if (prev === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - prev) / prev) * 100);
      };

      return {
        alerts: { current: currentAlerts, previous: prevAlerts, delta: calcDelta(currentAlerts, prevAlerts) },
        tasks: { current: currentTasks, previous: prevTasks, delta: calcDelta(currentTasks, prevTasks) },
        resolved: { current: currentDoneTasks, previous: prevDoneTasks, delta: calcDelta(currentDoneTasks, prevDoneTasks) },
        sla: { current: avgSla(currentCompleted), previous: avgSla(prevCompleted), delta: calcDelta(avgSla(currentCompleted), avgSla(prevCompleted)) },
      };
    }
  );

  // Top usuarios da plataforma que mais dispararam alertas
  app.get(
    "/top-users-alerted",
    { preHandler: authorize("panel:read", "logs:read") },
    async (request) => {
      const query = request.query as {
        startDate?: string;
        endDate?: string;
        webhookType?: string;
        limit?: string;
      };

      const where: Record<string, unknown> = {};
      if (query.webhookType) where.webhookType = query.webhookType;
      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate)
          (where.createdAt as Record<string, unknown>).gte = new Date(query.startDate);
        if (query.endDate)
          (where.createdAt as Record<string, unknown>).lte = endOfDay(query.endDate);
      }

      const alerts = await app.prisma.panelAlert.findMany({
        where,
        select: { data: true },
      });

      const userMap = new Map<string, { userName: string; userUsername: string; count: number }>();
      for (const a of alerts) {
        const data = a.data as Record<string, unknown> | null;
        if (!data) continue;
        const userId = (data.user_id as string) ?? "";
        if (!userId) continue;
        const entry = userMap.get(userId) || {
          userName: (data.user_name as string) ?? "Desconhecido",
          userUsername: (data.user_username as string) ?? "",
          count: 0,
        };
        entry.count++;
        userMap.set(userId, entry);
      }

      const limit = Math.min(Number(query.limit) || 20, 50);
      return Array.from(userMap.entries())
        .map(([userId, data]) => ({ userId, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    }
  );

  // Estatisticas de group lock
  app.get(
    "/group-lock-stats",
    { preHandler: authorize("panel:read", "logs:read") },
    async (request) => {
      const query = request.query as {
        startDate?: string;
        endDate?: string;
      };

      const where: Record<string, unknown> = {};
      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate)
          (where.createdAt as Record<string, unknown>).gte = new Date(query.startDate);
        if (query.endDate)
          (where.createdAt as Record<string, unknown>).lte = endOfDay(query.endDate);
      }

      const events = await app.prisma.lockGroupEvent.findMany({
        where,
        select: {
          groupId: true,
          action: true,
          createdAt: true,
          group: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      const totalLocks = events.filter((e) => e.action === "locked").length;
      const totalUnlocks = events.filter((e) => e.action === "unlocked").length;

      // Avg lock duration
      const lockTimes: number[] = [];
      const lockMap = new Map<string, Date>();
      for (const e of events) {
        if (e.action === "locked") {
          lockMap.set(e.groupId, e.createdAt);
        } else if (e.action === "unlocked") {
          const lockTime = lockMap.get(e.groupId);
          if (lockTime) {
            lockTimes.push((e.createdAt.getTime() - lockTime.getTime()) / 1000);
            lockMap.delete(e.groupId);
          }
        }
      }

      const avgLockSeconds = lockTimes.length > 0 ? Math.round(lockTimes.reduce((a, b) => a + b, 0) / lockTimes.length) : 0;

      // By group
      const byGroup = new Map<string, { name: string; locks: number }>();
      for (const e of events) {
        if (e.action !== "locked") continue;
        const entry = byGroup.get(e.groupId) || { name: e.group?.name ?? "Desconhecido", locks: 0 };
        entry.locks++;
        byGroup.set(e.groupId, entry);
      }

      // Active groups
      const activeGroups = await app.prisma.lockGroup.count({ where: { active: true } });

      return {
        totalLocks,
        totalUnlocks,
        avgLockSeconds,
        activeGroups,
        byGroup: Array.from(byGroup.entries())
          .map(([groupId, data]) => ({ groupId, ...data }))
          .sort((a, b) => b.locks - a.locks),
      };
    }
  );

  // SLA por dia (tendencia ao longo do tempo)
  app.get(
    "/sla-by-day",
    { preHandler: authorize("panel:read", "logs:read") },
    async (request) => {
      const query = request.query as {
        startDate?: string;
        endDate?: string;
        webhookType?: string;
      };

      const where: Record<string, unknown> = {
        status: "done",
        completedAt: { not: null },
      };

      if (query.webhookType) {
        const configsOfType = await app.prisma.alertConfig.findMany({
          where: { webhookType: query.webhookType as any },
          select: { id: true },
        });
        where.alertConfigId = { in: configsOfType.map((c) => c.id) };
      }

      if (query.startDate || query.endDate) {
        where.completedAt = {};
        if (query.startDate)
          (where.completedAt as Record<string, unknown>).gte = new Date(query.startDate);
        if (query.endDate)
          (where.completedAt as Record<string, unknown>).lte = endOfDay(query.endDate);
      }

      const tasks = await app.prisma.panelTask.findMany({
        where,
        select: { createdAt: true, completedAt: true },
      });

      const byDay = new Map<string, { totalMin: number; count: number }>();
      for (const t of tasks) {
        if (!t.completedAt) continue;
        const day = t.completedAt.toISOString().split("T")[0]!;
        const entry = byDay.get(day) || { totalMin: 0, count: 0 };
        entry.totalMin += (t.completedAt.getTime() - t.createdAt.getTime()) / 60000;
        entry.count++;
        byDay.set(day, entry);
      }

      return Array.from(byDay.entries())
        .map(([date, data]) => ({
          date,
          avgSlaMinutes: Math.round(data.totalMin / data.count),
          tasksResolved: data.count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }
  );
}
