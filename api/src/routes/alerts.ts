import { FastifyInstance } from "fastify";
import { z } from "zod";
import { authorize } from "../middlewares/auth";
import { createLog } from "../middlewares/logger";
import { getClickHouseClient } from "../services/clickhouseClient";

const OPERATORS = ["EQUAL", "NOT_EQUAL", "GREATER", "GREATER_EQUAL", "LESS", "LESS_EQUAL"] as const;

const queryConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(OPERATORS),
  value: z.string(),
  logicGate: z.enum(["AND", "OR"]).optional().nullable(),
  order: z.number(),
});

const createAlertSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  mode: z.enum(["ALERT", "WATCH"]).default("ALERT"),
  webhookType: z.enum([
    "CASINO_BET", "CASINO_PRIZE", "CASINO_REFUND", "SPORT_BET", "SPORT_PRIZE",
    "LOGIN", "DEPOSIT_REQUEST", "DEPOSIT", "WITHDRAWAL_REQUEST", "WITHDRAWAL_CONFIRMATION",
    "USER_REGISTRATION",
  ]),
  publishPanel: z.boolean().default(false),
  publishChat: z.boolean().default(false),
  chatWebhookUrl: z.string().url().optional().nullable(),
  createPanelTask: z.boolean().default(false),
  createClickupTask: z.boolean().default(false),
  clickupListId: z.string().optional().nullable(),
  checklist: z.array(z.union([
    z.string(),
    z.object({ type: z.enum(["check", "text"]), label: z.string() }),
  ])).optional().default([]),
  externalWebhookUrl: z.string().url().optional().nullable(),
  selectedFields: z.array(z.string()),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.enum(OPERATORS),
    value: z.string(),
    logicGate: z.enum(["AND", "OR"]).optional().nullable(),
    order: z.number(),
  })),
  // Cooldown (minutos entre disparos por usuário)
  cooldownMinutes: z.number().int().min(0).optional().nullable(),
  // Pagamento Antecipado (só SPORT_BET / SPORT_PRIZE)
  requireEarlyPayout: z.boolean().default(false),
  earlyPayoutProviders: z.array(z.enum(["NGX", "RADAR"])).default(["NGX"]),
  // ClickHouse query
  queryEnabled: z.boolean().default(false),
  clickhouseQuery: z.string().optional().nullable(),
  queryConditions: z.array(queryConditionSchema).optional().default([]),
});

const updateAlertSchema = createAlertSchema.partial();

type ChecklistItem = { type: "check" | "text"; label: string };
function normalizeChecklist(raw: (string | ChecklistItem)[]): ChecklistItem[] {
  return raw.map((item) => (typeof item === "string" ? { type: "check", label: item } : item));
}

export async function alertRoutes(app: FastifyInstance) {
  // List alert configs
  app.get(
    "/",
    { preHandler: authorize("alerts:read", "alerts:manage", "alerts:create") },
    async (request) => {
      const query = request.query as { page?: string; limit?: string; webhookType?: string; active?: string; mode?: string };
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      if (query.webhookType) where.webhookType = query.webhookType;
      if (query.active !== undefined) where.active = query.active === "true";
      if (query.mode) where.mode = query.mode;

      const [alerts, total] = await Promise.all([
        app.prisma.alertConfig.findMany({
          where, skip, take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            filters: { orderBy: { order: "asc" } },
            queryConditions: { orderBy: { order: "asc" } },
            _count: { select: { panelAlerts: true } },
          },
        }),
        app.prisma.alertConfig.count({ where }),
      ]);

      return { alerts, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
  );

  // Get single alert config
  app.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: authorize("alerts:read", "alerts:manage") },
    async (request, reply) => {
      const alert = await app.prisma.alertConfig.findUnique({
        where: { id: request.params.id },
        include: {
          filters: { orderBy: { order: "asc" } },
          queryConditions: { orderBy: { order: "asc" } },
          _count: { select: { panelAlerts: true } },
        },
      });
      if (!alert) return reply.status(404).send({ error: "Alerta não encontrado" });
      return alert;
    }
  );

  // Create alert config
  app.post(
    "/",
    { preHandler: authorize("alerts:create", "alerts:manage") },
    async (request, reply) => {
      const body = createAlertSchema.parse(request.body);

      const alert = await app.prisma.alertConfig.create({
        data: {
          name: body.name,
          description: body.description,
          mode: body.mode,
          webhookType: body.webhookType,
          publishPanel: body.publishPanel,
          publishChat: body.publishChat,
          chatWebhookUrl: body.chatWebhookUrl ?? null,
          createPanelTask: body.createPanelTask,
          createClickupTask: body.createClickupTask,
          clickupListId: body.clickupListId ?? null,
          checklist: normalizeChecklist(body.checklist ?? []),
          externalWebhookUrl: body.externalWebhookUrl ?? null,
          selectedFields: body.selectedFields,
          createdBy: request.currentUser!.id,
          cooldownMinutes: body.cooldownMinutes ?? null,
          requireEarlyPayout: body.requireEarlyPayout,
          earlyPayoutProviders: body.earlyPayoutProviders,
          queryEnabled: body.queryEnabled,
          clickhouseQuery: body.clickhouseQuery ?? null,
          filters: {
            create: body.filters.map((f) => ({
              field: f.field, operator: f.operator, value: f.value,
              logicGate: f.logicGate ?? null, order: f.order,
            })),
          },
          queryConditions: {
            create: (body.queryConditions || []).map((c) => ({
              field: c.field, operator: c.operator, value: c.value,
              logicGate: c.logicGate ?? null, order: c.order,
            })),
          },
        },
        include: {
          filters: { orderBy: { order: "asc" } },
          queryConditions: { orderBy: { order: "asc" } },
        },
      });

      await createLog(app.prisma, request, {
        action: "alert.created", entity: "alert", entityId: alert.id,
        details: { name: alert.name, webhookType: alert.webhookType, queryEnabled: alert.queryEnabled },
      });

      return reply.status(201).send(alert);
    }
  );

  // Update alert config
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: authorize("alerts:manage") },
    async (request) => {
      const { id } = request.params;
      const body = updateAlertSchema.parse(request.body);

      // Replace filters if provided
      if (body.filters) {
        await app.prisma.alertFilter.deleteMany({ where: { alertConfigId: id } });
      }

      // Replace query conditions if provided
      if (body.queryConditions) {
        await app.prisma.alertQueryCondition.deleteMany({ where: { alertConfigId: id } });
      }

      const alert = await app.prisma.alertConfig.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.mode !== undefined && { mode: body.mode }),
          ...(body.webhookType !== undefined && { webhookType: body.webhookType }),
          ...(body.publishPanel !== undefined && { publishPanel: body.publishPanel }),
          ...(body.publishChat !== undefined && { publishChat: body.publishChat }),
          ...(body.chatWebhookUrl !== undefined && { chatWebhookUrl: body.chatWebhookUrl ?? null }),
          ...(body.createPanelTask !== undefined && { createPanelTask: body.createPanelTask }),
          ...(body.createClickupTask !== undefined && { createClickupTask: body.createClickupTask }),
          ...(body.clickupListId !== undefined && { clickupListId: body.clickupListId ?? null }),
          ...(body.checklist !== undefined && { checklist: normalizeChecklist(body.checklist) }),
          ...(body.externalWebhookUrl !== undefined && { externalWebhookUrl: body.externalWebhookUrl ?? null }),
          ...(body.selectedFields !== undefined && { selectedFields: body.selectedFields }),
          ...(body.cooldownMinutes !== undefined && { cooldownMinutes: body.cooldownMinutes ?? null }),
          ...(body.requireEarlyPayout !== undefined && { requireEarlyPayout: body.requireEarlyPayout }),
          ...(body.earlyPayoutProviders !== undefined && { earlyPayoutProviders: body.earlyPayoutProviders }),
          ...(body.queryEnabled !== undefined && { queryEnabled: body.queryEnabled }),
          ...(body.clickhouseQuery !== undefined && { clickhouseQuery: body.clickhouseQuery ?? null }),
          ...(body.filters && {
            filters: {
              create: body.filters.map((f) => ({
                field: f.field, operator: f.operator, value: f.value,
                logicGate: f.logicGate ?? null, order: f.order,
              })),
            },
          }),
          ...(body.queryConditions && {
            queryConditions: {
              create: body.queryConditions.map((c) => ({
                field: c.field, operator: c.operator, value: c.value,
                logicGate: c.logicGate ?? null, order: c.order,
              })),
            },
          }),
        },
        include: {
          filters: { orderBy: { order: "asc" } },
          queryConditions: { orderBy: { order: "asc" } },
        },
      });

      await createLog(app.prisma, request, {
        action: "alert.updated", entity: "alert", entityId: id,
        details: body as Record<string, unknown>,
      });

      return alert;
    }
  );

  // Toggle active
  app.patch<{ Params: { id: string } }>(
    "/:id/toggle",
    { preHandler: authorize("alerts:manage") },
    async (request) => {
      const { id } = request.params;
      const current = await app.prisma.alertConfig.findUnique({ where: { id } });
      const alert = await app.prisma.alertConfig.update({
        where: { id },
        data: { active: !current?.active },
      });
      await createLog(app.prisma, request, {
        action: alert.active ? "alert.activated" : "alert.deactivated",
        entity: "alert", entityId: id,
      });
      return alert;
    }
  );

  // Delete alert config
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: authorize("alerts:manage") },
    async (request, reply) => {
      const { id } = request.params;

      // Delete related panel alerts first (set alertConfigId to null)
      await app.prisma.panelAlert.updateMany({
        where: { alertConfigId: id },
        data: { alertConfigId: null },
      });

      await app.prisma.alertConfig.delete({ where: { id } });

      await createLog(app.prisma, request, {
        action: "alert.deleted",
        entity: "alert",
        entityId: id,
      });

      return { success: true };
    }
  );

  // Alert history
  app.get<{ Params: { id: string } }>(
    "/:id/history",
    { preHandler: authorize("alerts:read", "alerts:manage") },
    async (request) => {
      const query = request.query as { page?: string; limit?: string };
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
      const skip = (page - 1) * limit;

      const [alerts, total] = await Promise.all([
        app.prisma.panelAlert.findMany({
          where: { alertConfigId: request.params.id },
          skip, take: limit,
          orderBy: { createdAt: "desc" },
        }),
        app.prisma.panelAlert.count({ where: { alertConfigId: request.params.id } }),
      ]);

      return { alerts, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
  );

  // ══════════════════════════════════════════════
  // Test ClickHouse query (dry-run)
  // ══════════════════════════════════════════════
  app.post(
    "/test-query",
    { preHandler: authorize("alerts:create", "alerts:manage") },
    async (request, reply) => {
      const body = z.object({
        query: z.string().min(1),
        sampleData: z.record(z.unknown()).optional(),
      }).parse(request.body);

      // Interpolate placeholders
      let finalQuery = body.query;
      if (body.sampleData) {
        finalQuery = finalQuery.replace(/\{\{(\w+)\}\}/g, (_, key) => {
          const value = (body.sampleData as Record<string, unknown>)[key];
          return value !== undefined && value !== null
            ? String(value).replace(/'/g, "\\'")
            : "";
        });
      }

      // Only allow SELECT
      const trimmed = finalQuery.trim().toUpperCase();
      if (!trimmed.startsWith("SELECT")) {
        return reply.status(400).send({ error: "Apenas queries SELECT sao permitidas" });
      }

      // Add LIMIT safety
      if (!trimmed.includes("LIMIT")) {
        finalQuery = finalQuery.trimEnd().replace(/;$/, "") + " LIMIT 10";
      }

      const clickhouse = getClickHouseClient();
      try {
        const resultSet = await clickhouse.query({ query: finalQuery, format: "JSONEachRow" });
        const rows = await resultSet.json();
        return {
          success: true,
          rows,
          columns: rows.length > 0 ? Object.keys(rows[0] as object) : [],
          interpolatedQuery: finalQuery,
        };
      } catch (err: any) {
        return reply.status(400).send({ success: false, error: err.message || "Erro ao executar query" });
      } finally {
        await clickhouse.close();
      }
    }
  );
}
