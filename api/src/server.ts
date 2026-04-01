import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "path";
import { PrismaClient } from "@prisma/client";

import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/users";
import { roleRoutes } from "./routes/roles";
import { logRoutes } from "./routes/logs";
import { alertRoutes } from "./routes/alerts";
import { webhookSchemaRoutes } from "./routes/webhookSchemas";
import { groupRoutes } from "./routes/groups";
import { panelRoutes } from "./routes/panel";
import { reportRoutes } from "./routes/reports";
import { clientRoutes } from "./routes/clients";
import { configRoutes } from "./routes/configs";

import { AlertEngine } from "./services/alertEngine";
import { GroupLockEngine } from "./services/groupLockEngine";
import { createClient as createClickHouseClient } from "@clickhouse/client";

const prisma = new PrismaClient();

const app = Fastify({ logger: true });


// ── Type mapping for webhook processing ──────────────────────────────────
const typeToWebhookType: Record<string, string> = {
  SPORT_BET: "SPORT_BET",
  SPORT_PRIZE: "SPORT_PRIZE",
  CASINO_BET: "CASINO_BET",
  CASINO_PRIZE: "CASINO_PRIZE",
  CASINO_REFUND: "CASINO_REFUND",
  WITHDRAWAL_CONFIRMATION: "WITHDRAWAL_CONFIRMATION",
  WITHDRAWAL_REQUEST: "WITHDRAWAL_REQUEST",
  DEPOSIT_REQUEST: "DEPOSIT_REQUEST",
  DEPOSIT_CONFIRMATION: "DEPOSIT",
  USER_LOGIN: "LOGIN",
  USER_REGISTRATION: "USER_REGISTRATION",
};

// ── START ─────────────────────────────────────────────────────────────────
async function start() {
  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || "change-me-in-production",
    sign: { expiresIn: "15m" },
  });

  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

  const uploadsDir = path.join(__dirname, "..", "uploads");
  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: "/uploads/",
    decorateReply: false,
  });

  // Raw body parser (for Legitimuz signature verification)
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req, body, done) => {
      try {
        (req as any).rawBody = body as Buffer;
        const json = JSON.parse((body as Buffer).toString("utf8"));
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  // Decorate fastify with prisma
  app.decorate("prisma", prisma);

  // ClickHouse client for alert queries
  const clickhouseClient = createClickHouseClient({
    url: process.env.CLICKHOUSE_HOST,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB || "majorsports",
  });

  // Alert engines
  const alertEngine = new AlertEngine(prisma, clickhouseClient);
  const groupLockEngine = new GroupLockEngine(prisma);
  app.decorate("groupLockEngine", groupLockEngine);
  app.decorate("alertEngine", alertEngine);

  // ── Dashboard/API routes ─────────────────────────────────────────────
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(userRoutes, { prefix: "/users" });
  await app.register(roleRoutes, { prefix: "/roles" });
  await app.register(logRoutes, { prefix: "/logs" });
  await app.register(alertRoutes, { prefix: "/alerts" });
  await app.register(webhookSchemaRoutes, { prefix: "/webhooks" });
  await app.register(groupRoutes, { prefix: "/groups" });
  await app.register(panelRoutes, { prefix: "/panel" });
  await app.register(reportRoutes, { prefix: "/reports" });
  await app.register(clientRoutes, { prefix: "/clients" });
  await app.register(configRoutes, { prefix: "/configs" });

  // Health check
  app.get("/health", async () => ({ status: "ok" }));

  // Dashboard stats (enriched)
  app.get("/dashboard/stats", async (request, reply) => {
    try {
      await (await import("./middlewares/auth")).authenticate(request, reply);
      if (reply.sent) return;
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const query = request.query as { startDate?: string; endDate?: string };

    const now = new Date();
    // Se tem filtro de data, usa; senão usa o padrão (última semana)
    const hasDateFilter = query.startDate || query.endDate;
    const rangeStart = query.startDate ? new Date(query.startDate) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const rangeEnd = query.endDate ? (() => { const d = new Date(query.endDate!); d.setUTCHours(23, 59, 59, 999); return d; })() : now;
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevWeek = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const dateFilter = { createdAt: { gte: rangeStart, lte: rangeEnd } };

    const [
      alertsActive, alertsTriggered24h, groupsActive, usersCount, tasksOpen, tasksDone,
      alertsThisWeek, alertsPrevWeek, tasksInProgress,
    ] = await Promise.all([
      prisma.alertConfig.count({ where: { active: true } }),
      prisma.panelAlert.count({ where: hasDateFilter ? dateFilter : { createdAt: { gte: yesterday } } }),
      prisma.lockGroup.count({ where: { active: true } }),
      prisma.user.count({ where: { active: true } }),
      prisma.panelTask.count({ where: hasDateFilter ? { status: "open", ...dateFilter } : { status: "open" } }),
      prisma.panelTask.count({ where: hasDateFilter ? { status: "done", ...dateFilter } : { status: "done" } }),
      prisma.panelAlert.count({ where: hasDateFilter ? dateFilter : { createdAt: { gte: weekAgo } } }),
      prisma.panelAlert.count({ where: hasDateFilter ? { createdAt: { gte: new Date(rangeStart.getTime() - (rangeEnd.getTime() - rangeStart.getTime())), lt: rangeStart } } : { createdAt: { gte: prevWeek, lt: weekAgo } } }),
      prisma.panelTask.count({ where: hasDateFilter ? { status: "in_progress", ...dateFilter } : { status: "in_progress" } }),
    ]);

    // Alerts by day
    const alertsByDay: Array<{ date: string; count: number }> = [];
    const alertsRange = await prisma.panelAlert.findMany({
      where: hasDateFilter ? dateFilter : { createdAt: { gte: weekAgo } },
      select: { createdAt: true },
    });
    const dayMap = new Map<string, number>();
    for (const a of alertsRange) {
      const day = a.createdAt.toISOString().split("T")[0]!;
      dayMap.set(day, (dayMap.get(day) || 0) + 1);
    }
    const daysInRange = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / 86400000));
    for (let i = daysInRange - 1; i >= 0; i--) {
      const d = new Date(rangeEnd.getTime() - i * 86400000);
      const key = d.toISOString().split("T")[0]!;
      alertsByDay.push({ date: key, count: dayMap.get(key) || 0 });
    }

    // Alerts by type
    const alertsByType: Array<{ type: string; count: number }> = [];
    const typeMap = new Map<string, number>();
    for (const a of await prisma.panelAlert.findMany({
      where: hasDateFilter ? dateFilter : { createdAt: { gte: weekAgo } },
      select: { webhookType: true },
    })) {
      typeMap.set(a.webhookType, (typeMap.get(a.webhookType) || 0) + 1);
    }
    for (const [type, count] of typeMap) alertsByType.push({ type, count });
    alertsByType.sort((a, b) => b.count - a.count);

    // Recent alerts (last 10)
    const recentAlerts = await prisma.panelAlert.findMany({
      where: hasDateFilter ? dateFilter : {},
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, webhookType: true, title: true, createdAt: true,
        data: true,
        alertConfig: { select: { name: true } },
      },
    });

    // Recent tasks (last 5 open/in_progress)
    const recentTasks = await prisma.panelTask.findMany({
      where: hasDateFilter ? { status: { in: ["open", "in_progress"] }, ...dateFilter } : { status: { in: ["open", "in_progress"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, priority: true, createdAt: true, assignedTo: true },
    });

    // Resolve assigned user names
    const assignedIds = [...new Set(recentTasks.map((t) => t.assignedTo).filter((id): id is string => !!id))];
    const assignedUsers = assignedIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: assignedIds } }, select: { id: true, name: true } })
      : [];
    const nameMap = new Map(assignedUsers.map((u) => [u.id, u.name]));

    // Top alert configs (most triggered this week)
    const topConfigs = await prisma.panelAlert.groupBy({
      by: ["alertConfigId"],
      where: { ...(hasDateFilter ? dateFilter : { createdAt: { gte: weekAgo } }), alertConfigId: { not: null } },
      _count: true,
      orderBy: { _count: { alertConfigId: "desc" } },
      take: 5,
    });
    const configIds = topConfigs.map((c) => c.alertConfigId).filter((id): id is string => !!id);
    const configs = configIds.length > 0
      ? await prisma.alertConfig.findMany({ where: { id: { in: configIds } }, select: { id: true, name: true } })
      : [];
    const configNameMap = new Map(configs.map((c) => [c.id, c.name]));

    // Active alert configs grouped by webhookType (with names)
    const activeConfigs = await prisma.alertConfig.findMany({
      where: { active: true },
      select: { id: true, name: true, webhookType: true },
      orderBy: { name: "asc" },
    });
    const activeByTypeMap = new Map<string, Array<{ id: string; name: string }>>();
    for (const c of activeConfigs) {
      const list = activeByTypeMap.get(c.webhookType) || [];
      list.push({ id: c.id, name: c.name });
      activeByTypeMap.set(c.webhookType, list);
    }
    const alertsActiveByType = Array.from(activeByTypeMap.entries())
      .map(([type, configs]) => ({ type, count: configs.length, configs }))
      .sort((a, b) => b.count - a.count);

    return {
      alertsActive,
      alertsTriggered24h,
      groupsActive,
      usersCount,
      tasksOpen,
      tasksDone,
      tasksInProgress,
      alertsThisWeek,
      alertsDelta: alertsPrevWeek > 0 ? Math.round(((alertsThisWeek - alertsPrevWeek) / alertsPrevWeek) * 100) : 0,
      alertsByDay,
      alertsByType,
      alertsActiveByType,
      recentAlerts: recentAlerts.map((a) => ({
        ...a,
        userName: (a.data as Record<string, unknown>)?.user_name ?? null,
      })),
      recentTasks: recentTasks.map((t) => ({
        ...t,
        assignedUserName: t.assignedTo ? nameMap.get(t.assignedTo) ?? null : null,
      })),
      topConfigs: topConfigs.map((c) => ({
        alertConfigId: c.alertConfigId,
        name: configNameMap.get(c.alertConfigId!) ?? "Sistema",
        count: c._count,
      })),
    };
  });

  // ── Webhook routes (antigo gateway) ──────────────────────────────────

  // Resolve o tipo de webhook considerando status do saque
  function resolveWebhookType(body: any): string | undefined {
    const eventType = body?.type;
    let webhookType = typeToWebhookType[eventType];
    // Diferenciar saque solicitado vs aprovado pelo status
    if (eventType === "WITHDRAWAL_CONFIRMATION" || eventType === "WITHDRAWAL_REQUEST") {
      const status = body?.withdraw_status;
      webhookType = status === "PENDING" ? "WITHDRAWAL_REQUEST" : "WITHDRAWAL_CONFIRMATION";
    }
    return webhookType;
  }

  // Endpoint genérico: roteia pelo campo "type" no body
  app.post("/webhook/ngx", async (req, reply) => {
    const body = req.body as any;
    const eventType = body?.type;

    console.log(`[WEBHOOK /webhook/ngx] type=${eventType} user=${body?.user_name || body?.login_username || "?"} body=`, JSON.stringify(body).slice(0, 500));

    // Alertas dinâmicos (AlertEngine + GroupLockEngine)
    const webhookType = resolveWebhookType(body);
    console.log(`[WEBHOOK /webhook/ngx] resolved: ${eventType} -> ${webhookType || "IGNORADO"}`);
    if (webhookType) {
      try {
        await alertEngine.processWebhook(webhookType, body);
      } catch (err) {
        req.log.error({ err }, "Erro no AlertEngine");
      }
      try {
        await groupLockEngine.processBet(webhookType, body);
      } catch (err) {
        req.log.error({ err }, "Erro no GroupLockEngine");
      }
    }

    return reply.status(202).send({ ok: true });
  });

  // Endpoint com ID na URL
  app.post<{ Params: { id?: string } }>("/webhook/ngx/:id", async (req, reply) => {
    const { id } = req.params;
    console.log(`[WEBHOOK /webhook/ngx/${id}] body=`, JSON.stringify(req.body).slice(0, 500));

    const payload = req as any;
    const items = Array.isArray(payload) ? payload : [payload];

    for (const item of items) {
      const event = item?.body;
      if (!event) continue;

      const eventType = event?.type;
      console.log(`[WEBHOOK /webhook/ngx/${id}] item type=${eventType} user=${event?.user_name || event?.login_username || "?"}`);

      // Alertas dinâmicos
      const webhookType = resolveWebhookType(event);
      console.log(`[WEBHOOK /webhook/ngx/${id}] resolved: ${eventType} -> ${webhookType || "IGNORADO"}`);
      if (webhookType) {
        try {
          await alertEngine.processWebhook(webhookType, event);
        } catch (err) {
          req.log.error({ err }, "Erro no AlertEngine");
        }
        try {
          await groupLockEngine.processBet(webhookType, event);
        } catch (err) {
          req.log.error({ err }, "Erro no GroupLockEngine");
        }
      }
    }

    return reply.status(202).send({ ok: true });
  });

  const port = Number(process.env.API_PORT) || 3002;
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`API running on port ${port} (webhook + dashboard)`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    groupLockEngine: import("./services/groupLockEngine").GroupLockEngine;
    alertEngine: import("./services/alertEngine").AlertEngine;
  }
  interface FastifyRequest {
    currentUser?: {
      id: string;
      email: string;
      roleId: string;
      permissions: string[];
    };
  }
}
