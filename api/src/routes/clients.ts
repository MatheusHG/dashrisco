import { FastifyInstance } from "fastify";
import { authorize } from "../middlewares/auth";
import { createClient } from "@clickhouse/client";
import axios from "axios";

function getSbClient() {
  return axios.create({
    baseURL: process.env.SB_API_BASE_URL,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SB_API_TOKEN}`,
      Referer: process.env.SB_API_REFERER || "",
    },
  });
}

async function getUser(userId: string) {
  const sb = getSbClient();
  const { data } = await sb.get("/user/find", {
    params: { query: "ID", field: userId },
  });
  return data as Record<string, any>;
}

function getClickHouseClient() {
  return createClient({
    url: process.env.CLICKHOUSE_HOST,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB || "majorsports",
  });
}

export async function clientRoutes(app: FastifyInstance) {
  // ══════════════════════════════════════════════
  // Perfil completo do cliente (SB API + ClickHouse)
  // ══════════════════════════════════════════════
  app.get(
    "/profile",
    { preHandler: authorize("panel:read", "alerts:read") },
    async (request, reply) => {
      const query = request.query as { userId?: string };
      if (!query.userId) return reply.status(400).send({ error: "userId obrigatorio" });

      const userId = query.userId;

      // 1) SB API
      let profile: Record<string, unknown> | null = null;
      try {
        const user = await getUser(userId);
        profile = {
          id: user.id,
          name: user.name ?? user.username ?? "Desconhecido",
          username: user.username ?? "",
          email: user.email ?? "",
          cpf: user.cpf ?? "",
          createdAt: user.created_at ?? user.createdAt ?? null,
          balance: Number(user.credits ?? user.balance ?? 0),
          locks: user.locks ?? {},
          locked: user.locked ?? false,
          affiliated: user.affiliated ?? false,
          affiliation: user.affiliation ?? "",
          hasKyc: user.has_kyc ?? false,
        };
      } catch (err: any) {
        request.log.warn({ err: err.message, userId }, "SB API indisponivel");
      }

      // 2) ClickHouse
      let financials = {
        totalDeposits: 0, totalDeposited: 0,
        totalWithdrawals: 0, totalWithdrawn: 0, netPnl: 0,
        totalSportBets: 0, totalCasinoBets: 0,
        biggestCasinoWin: 0, biggestSportWin: 0,
      };
      let recentDeposits: Array<{ value: number; createdAt: string }> = [];
      let recentWithdrawals: Array<{ value: number; createdAt: string }> = [];

      const clickhouse = getClickHouseClient();
      try {
        const summaryQuery = `
          WITH
            deps AS (
              SELECT count() AS cnt, sum(value) AS total
              FROM majorsports.transfers
              WHERE user = '${userId}' AND type = 'DEPOSIT' AND status = 'PAID'
            ),
            wds AS (
              SELECT count() AS cnt, sum(value) AS total
              FROM majorsports.transfers
              WHERE user = '${userId}' AND type = 'WITHDRAW' AND status = 'PAID'
            ),
            sb AS (
              SELECT count() AS cnt
              FROM majorsports.bets WHERE user = '${userId}'
            ),
            cas AS (
              SELECT
                countIf(type = 'DEBIT_BY_CASINO_BET') AS casino_bets,
                maxIf(abs(value), type = 'CREDIT_BY_WINNING_CASINO_BET') AS biggest_casino
              FROM majorsports.transactions_virtual
              WHERE user = '${userId}' AND is_test = 0
            )
          SELECT
            deps.cnt AS total_deposits, deps.total AS total_deposited,
            wds.cnt AS total_withdrawals, wds.total AS total_withdrawn,
            sb.cnt AS total_sport_bets,
            cas.casino_bets AS total_casino_bets, cas.biggest_casino AS biggest_casino_win
          FROM deps, wds, sb, cas
        `;

        const [summaryResult, depsResult, wdsResult] = await Promise.all([
          clickhouse.query({ query: summaryQuery, format: "JSONEachRow" }),
          clickhouse.query({
            query: `SELECT value, created_at FROM majorsports.transfers WHERE user = '${userId}' AND type = 'DEPOSIT' AND status = 'PAID' ORDER BY created_at DESC LIMIT 10`,
            format: "JSONEachRow",
          }),
          clickhouse.query({
            query: `SELECT value, created_at FROM majorsports.transfers WHERE user = '${userId}' AND type = 'WITHDRAW' AND status = 'PAID' ORDER BY created_at DESC LIMIT 10`,
            format: "JSONEachRow",
          }),
        ]);

        const rows = await summaryResult.json<Record<string, string>>();
        const row = rows[0];
        if (row) {
          const deposited = Number(row.total_deposited ?? 0);
          const withdrawn = Number(row.total_withdrawn ?? 0);
          financials = {
            totalDeposits: Number(row.total_deposits ?? 0),
            totalDeposited: deposited,
            totalWithdrawals: Number(row.total_withdrawals ?? 0),
            totalWithdrawn: withdrawn,
            netPnl: deposited - withdrawn,
            totalSportBets: Number(row.total_sport_bets ?? 0),
            totalCasinoBets: Number(row.total_casino_bets ?? 0),
            biggestCasinoWin: Number(row.biggest_casino_win ?? 0),
            biggestSportWin: 0,
          };
        }

        const depRows = await depsResult.json<{ value: string; created_at: string }>();
        recentDeposits = depRows.map((r) => ({ value: Number(r.value), createdAt: r.created_at }));

        const wdRows = await wdsResult.json<{ value: string; created_at: string }>();
        recentWithdrawals = wdRows.map((r) => ({ value: Number(r.value), createdAt: r.created_at }));
      } catch (err: any) {
        request.log.warn({ err: err.message, userId }, "ClickHouse indisponivel");
      } finally {
        await clickhouse.close();
      }

      return { profile, financials, recentDeposits, recentWithdrawals };
    }
  );

  // ══════════════════════════════════════════════
  // Info de grupos de bloqueio do usuario
  // ══════════════════════════════════════════════
  app.get(
    "/group-info",
    { preHandler: authorize("panel:read", "alerts:read") },
    async (request, reply) => {
      const query = request.query as { userId?: string };
      if (!query.userId) return reply.status(400).send({ error: "userId obrigatorio" });

      const userId = query.userId;

      // Grupos que o usuario participa
      const memberships = await app.prisma.lockGroupMember.findMany({
        where: { ngxUserId: userId },
        include: {
          group: {
            include: {
              members: { select: { ngxUserId: true, ngxName: true } },
              _count: { select: { members: true, events: true } },
            },
          },
        },
      });

      // Para cada grupo, buscar stats de eventos
      const groups = [];
      for (const m of memberships) {
        const g = m.group;

        // Eventos do grupo
        const events = await app.prisma.lockGroupEvent.findMany({
          where: { groupId: g.id },
          select: { action: true, createdAt: true, reason: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        });

        const lockEvents = events.filter((e) => e.action === "locked");
        const totalLocks = lockEvents.length;

        // Quantas vezes ESTE usuario disparou o bloqueio (reason contem o user id)
        const userTriggers = lockEvents.filter((e) => e.reason?.includes(userId)).length;

        // Faixa horaria das apostas que bloquearam (extrair hora dos locks)
        const hourMap = new Array(24).fill(0);
        for (const e of lockEvents) {
          hourMap[e.createdAt.getHours()]++;
        }

        // Ultimo bloqueio
        const lastLock = lockEvents[0] ?? null;

        groups.push({
          groupId: g.id,
          groupName: g.name,
          active: g.active,
          lockSeconds: g.lockSeconds,
          timeSlots: g.timeSlots,
          memberCount: g._count.members,
          totalEvents: g._count.events,
          totalLocks,
          userTriggers,
          lastLockAt: lastLock?.createdAt ?? null,
          locksByHour: hourMap.map((count, hour) => ({ hour, count })),
          members: g.members.map((mem) => ({
            ngxUserId: mem.ngxUserId,
            ngxName: mem.ngxName,
            isCurrentUser: mem.ngxUserId === userId,
          })),
        });
      }

      // Todos os grupos disponiveis (para adicionar)
      const allGroups = await app.prisma.lockGroup.findMany({
        where: { active: true },
        select: { id: true, name: true, _count: { select: { members: true } } },
        orderBy: { name: "asc" },
      });

      // Filtrar grupos que o usuario ja participa
      const memberGroupIds = new Set(memberships.map((m) => m.group.id));
      const availableGroups = allGroups.filter((g) => !memberGroupIds.has(g.id));

      return { groups, availableGroups };
    }
  );

  // Adicionar usuario a um grupo existente (quick-add)
  app.post(
    "/add-to-group",
    { preHandler: authorize("groups:manage") },
    async (request, reply) => {
      const body = request.body as { userId: string; groupId: string; userName?: string };
      if (!body.userId || !body.groupId) return reply.status(400).send({ error: "userId e groupId obrigatorios" });

      // Verificar se ja esta no grupo
      const existing = await app.prisma.lockGroupMember.findFirst({
        where: { ngxUserId: body.userId, groupId: body.groupId },
      });
      if (existing) return reply.status(400).send({ error: "Usuario ja esta neste grupo" });

      const member = await app.prisma.lockGroupMember.create({
        data: {
          groupId: body.groupId,
          ngxUserId: body.userId,
          ngxName: body.userName ?? null,
        },
      });

      return reply.status(201).send(member);
    }
  );

  // ══════════════════════════════════════════════
  // Buscar alertas e tasks de um cliente
  // ══════════════════════════════════════════════
  app.get(
    "/search",
    { preHandler: authorize("panel:read", "alerts:read") },
    async (request) => {
      const query = request.query as {
        userId: string;
        startDate?: string;
        endDate?: string;
        allTime?: string;
      };

      if (!query.userId) return { alerts: [], tasks: [], summary: null };

      const where: Record<string, unknown> = {};
      if (query.allTime !== "true" && (query.startDate || query.endDate)) {
        where.createdAt = {};
        if (query.startDate) (where.createdAt as Record<string, unknown>).gte = new Date(query.startDate);
        if (query.endDate) (where.createdAt as Record<string, unknown>).lte = new Date(query.endDate);
      }
      where.data = { path: ["user_id"], equals: query.userId };

      const alerts = await app.prisma.panelAlert.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { alertConfig: { select: { id: true, name: true } } },
      });

      const byType = new Map<string, number>();
      const byConfig = new Map<string, { name: string; count: number }>();
      for (const alert of alerts) {
        byType.set(alert.webhookType, (byType.get(alert.webhookType) || 0) + 1);
        const key = alert.alertConfigId ?? "system";
        const entry = byConfig.get(key) || { name: alert.alertConfig?.name ?? "Sistema", count: 0 };
        entry.count++;
        byConfig.set(key, entry);
      }

      // Tasks com contagem de comentarios
      const taskWhere: Record<string, unknown> = {};
      if (query.allTime !== "true" && (query.startDate || query.endDate)) {
        taskWhere.createdAt = {};
        if (query.startDate) (taskWhere.createdAt as Record<string, unknown>).gte = new Date(query.startDate);
        if (query.endDate) (taskWhere.createdAt as Record<string, unknown>).lte = new Date(query.endDate);
      }
      taskWhere.data = { path: ["user_id"], equals: query.userId };

      const tasks = await app.prisma.panelTask.findMany({
        where: taskWhere,
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { _count: { select: { comments: true } } },
      });

      // Resolver nomes de assignedTo e completedBy
      const userIds = [
        ...new Set(
          tasks
            .flatMap((t) => [t.assignedTo, t.completedBy])
            .filter((id): id is string => !!id)
        ),
      ];
      const users =
        userIds.length > 0
          ? await app.prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, name: true },
            })
          : [];
      const userNameMap = new Map(users.map((u) => [u.id, u.name]));

      const tasksWithNames = tasks.map((t) => ({
        ...t,
        assignedUserName: t.assignedTo ? userNameMap.get(t.assignedTo) ?? null : null,
        completedByName: t.completedBy ? userNameMap.get(t.completedBy) ?? null : null,
      }));

      const firstAlert = alerts.length > 0 ? alerts[alerts.length - 1] : null;
      const lastAlert = alerts.length > 0 ? alerts[0] : null;

      return {
        alerts,
        tasks: tasksWithNames,
        summary: {
          totalAlerts: alerts.length,
          totalTasks: tasks.length,
          tasksOpen: tasks.filter((t) => t.status === "open").length,
          tasksDone: tasks.filter((t) => t.status === "done").length,
          byType: Array.from(byType.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
          byConfig: Array.from(byConfig.entries()).map(([id, data]) => ({ alertConfigId: id, name: data.name, count: data.count })).sort((a, b) => b.count - a.count),
          firstAlertAt: firstAlert?.createdAt ?? null,
          lastAlertAt: lastAlert?.createdAt ?? null,
        },
      };
    }
  );
}
