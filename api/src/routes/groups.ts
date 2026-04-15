import { FastifyInstance } from "fastify";
import { z } from "zod";
import { authorize } from "../middlewares/auth";
import { createLog } from "../middlewares/logger";
import { getClickHouseClient } from "../services/clickhouseClient";
import { getUser, updateUserLocks, FULL_LOCK, UserLocks } from "../services/sbClient";

const timeSlotSchema = z.object({
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(1).max(24),
  lockSeconds: z.number().int().min(1),
});

const createGroupSchema = z.object({
  name: z.string().min(2),
  lockSeconds: z.number().int().min(1),
  notifyPanel: z.boolean().default(false),
  notifyChat: z.boolean().default(false),
  chatWebhookUrl: z.string().url().optional().nullable(),
  triggerTypes: z.array(z.string()).default(["SPORT_BET", "CASINO_BET"]),
  triggerFilters: z.array(z.object({
    field: z.string(),
    operator: z.enum(["EQUAL", "GREATER", "LESS"]),
    value: z.string(),
    logicGate: z.enum(["AND", "OR"]).optional().nullable(),
  })).default([]),
  timeSlots: z.array(timeSlotSchema).default([]),
});

const updateGroupSchema = z.object({
  name: z.string().min(2).optional(),
  lockSeconds: z.number().int().min(1).optional(),
  active: z.boolean().optional(),
  notifyPanel: z.boolean().optional(),
  notifyChat: z.boolean().optional(),
  chatWebhookUrl: z.string().url().optional().nullable(),
  triggerTypes: z.array(z.string()).optional(),
  triggerFilters: z.array(z.object({
    field: z.string(),
    operator: z.enum(["EQUAL", "GREATER", "LESS"]),
    value: z.string(),
    logicGate: z.enum(["AND", "OR"]).optional().nullable(),
  })).optional(),
  timeSlots: z.array(timeSlotSchema).optional(),
});

const addMemberSchema = z.object({
  ngxUserId: z.string().min(1),
});


export async function groupRoutes(app: FastifyInstance) {
  // List groups
  app.get(
    "/",
    { preHandler: authorize("groups:manage", "groups:unlock") },
    async () => {
      const groups = await app.prisma.lockGroup.findMany({
        include: {
          _count: { select: { members: true } },
          events: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return groups.map((g) => ({
        ...g,
        lastEvent: g.events[0] ?? null,
        events: undefined,
      }));
    }
  );

  // Get single group with members
  app.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: authorize("groups:manage", "groups:unlock") },
    async (request, reply) => {
      const group = await app.prisma.lockGroup.findUnique({
        where: { id: request.params.id },
        include: {
          members: { orderBy: { addedAt: "desc" } },
        },
      });

      if (!group) return reply.status(404).send({ error: "Grupo não encontrado" });
      return group;
    }
  );

  // Create group
  app.post(
    "/",
    { preHandler: authorize("groups:manage") },
    async (request, reply) => {
      const body = createGroupSchema.parse(request.body);

      const group = await app.prisma.lockGroup.create({
        data: {
          name: body.name,
          lockSeconds: body.lockSeconds,
          notifyPanel: body.notifyPanel,
          notifyChat: body.notifyChat,
          chatWebhookUrl: body.chatWebhookUrl ?? null,
          triggerTypes: body.triggerTypes,
          triggerFilters: body.triggerFilters,
          timeSlots: body.timeSlots,
          createdBy: request.currentUser!.id,
        },
      });

      await createLog(app.prisma, request, {
        action: "group.created",
        entity: "group",
        entityId: group.id,
        details: { name: group.name, lockSeconds: group.lockSeconds },
      });

      return reply.status(201).send(group);
    }
  );

  // Update group
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: authorize("groups:manage") },
    async (request) => {
      const { id } = request.params;
      const body = updateGroupSchema.parse(request.body);

      const group = await app.prisma.lockGroup.update({
        where: { id },
        data: body,
      });

      await createLog(app.prisma, request, {
        action: "group.updated",
        entity: "group",
        entityId: id,
        details: body as Record<string, unknown>,
      });

      return group;
    }
  );

  // Delete group
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: authorize("groups:manage") },
    async (request) => {
      const { id } = request.params;

      await app.prisma.lockGroup.delete({ where: { id } });

      await createLog(app.prisma, request, {
        action: "group.deleted",
        entity: "group",
        entityId: id,
      });

      return { success: true };
    }
  );

  // Validate NGX user via ClickHouse (before adding to group)
  app.get<{ Params: { id: string; ngxUserId: string } }>(
    "/:id/members/validate/:ngxUserId",
    { preHandler: authorize("groups:manage") },
    async (request, reply) => {
      const { ngxUserId } = request.params;

      const clickhouse = getClickHouseClient();
      try {
        const result = await clickhouse.query({
          query: `SELECT _id, username, name, created_at, removed, last_login
                  FROM majorsports.users
                  WHERE _id = {id:String}
                  LIMIT 1`,
          query_params: { id: ngxUserId },
          format: "JSONEachRow",
        });

        const rows = (await result.json()) as Array<{
          _id: string;
          username: string;
          name: string;
          created_at: string;
          removed: boolean;
          last_login: string;
        }>;

        if (rows.length === 0) {
          return reply
            .status(404)
            .send({ error: "Usuário não encontrado no ClickHouse" });
        }

        return rows[0];
      } finally {
        await clickhouse.close();
      }
    }
  );

  // Add member to group
  app.post<{ Params: { id: string } }>(
    "/:id/members",
    { preHandler: authorize("groups:manage") },
    async (request, reply) => {
      const { id } = request.params;
      const body = addMemberSchema.parse(request.body);

      let ngxUsername = "";
      let ngxName = "";

      const clickhouse = getClickHouseClient();
      try {
        const result = await clickhouse.query({
          query: `SELECT _id, username, name
                  FROM majorsports.users
                  WHERE _id = {id:String}
                  LIMIT 1`,
          query_params: { id: body.ngxUserId },
          format: "JSONEachRow",
        });

        const rows = (await result.json()) as Array<{
          _id: string;
          username: string;
          name: string;
        }>;

        if (rows.length === 0) {
          return reply
            .status(404)
            .send({ error: "Usuário não encontrado no ClickHouse" });
        }

        ngxUsername = rows[0]!.username;
        ngxName = rows[0]!.name;
      } finally {
        await clickhouse.close();
      }

      const member = await app.prisma.lockGroupMember.create({
        data: {
          groupId: id,
          ngxUserId: body.ngxUserId,
          ngxUsername,
          ngxName,
        },
      });

      await createLog(app.prisma, request, {
        action: "group.member_added",
        entity: "group",
        entityId: id,
        details: {
          memberId: member.id,
          ngxUserId: body.ngxUserId,
          ngxName,
        },
      });

      return reply.status(201).send(member);
    }
  );

  // Remove member from group
  app.delete<{ Params: { id: string; memberId: string } }>(
    "/:id/members/:memberId",
    { preHandler: authorize("groups:manage") },
    async (request) => {
      const { id, memberId } = request.params;

      const member = await app.prisma.lockGroupMember.delete({
        where: { id: memberId },
      });

      await createLog(app.prisma, request, {
        action: "group.member_removed",
        entity: "group",
        entityId: id,
        details: { memberId, ngxUserId: member.ngxUserId },
      });

      return { success: true };
    }
  );

  // Manual lock all members
  app.post<{ Params: { id: string } }>(
    "/:id/lock",
    { preHandler: authorize("groups:manage", "groups:unlock") },
    async (request) => {
      const { id } = request.params;
      const body = (request.body as { reason?: string }) || {};

      // Get user name
      const currentUser = request.currentUser?.id
        ? await app.prisma.user.findUnique({
            where: { id: request.currentUser.id },
            select: { name: true },
          })
        : null;

      // Get all members of the group
      const group = await app.prisma.lockGroup.findUnique({
        where: { id },
        include: { members: true },
      });

      if (!group) return { success: false, message: "Grupo nao encontrado" };

      const lockedUsers: string[] = [];
      const failedUsers: string[] = [];

      // Lock each member via SB API
      for (const member of group.members) {
        try {
          const user = await getUser(app.prisma, member.ngxUserId);
          await updateUserLocks(app.prisma, member.ngxUserId, {
            ...user.locks,
            ...FULL_LOCK,
          });
          lockedUsers.push(member.ngxUserId);
          request.log.info(`[GroupLock] User ${member.ngxUserId} locked`);
        } catch (err: any) {
          failedUsers.push(member.ngxUserId);
          request.log.error(`[GroupLock] Failed to lock ${member.ngxUserId}: ${err.message}`);
        }
      }

      await app.prisma.lockGroupEvent.create({
        data: {
          groupId: id,
          action: "locked",
          userId: request.currentUser?.id ?? null,
          userName: currentUser?.name ?? null,
          reason: body.reason ?? null,
        },
      });

      await createLog(app.prisma, request, {
        action: "group.locked",
        entity: "group",
        entityId: id,
        details: { lockedUsers, failedUsers } as Record<string, unknown>,
      });

      return {
        success: true,
        message: `Grupo bloqueado: ${lockedUsers.length} usuarios travados`,
        lockedUsers,
        failedUsers,
      };
    }
  );

  // Manual unlock all members
  app.post<{ Params: { id: string } }>(
    "/:id/unlock",
    { preHandler: authorize("groups:manage", "groups:unlock") },
    async (request) => {
      const { id } = request.params;
      const body = (request.body as { reason?: string }) || {};

      const currentUser = request.currentUser?.id
        ? await app.prisma.user.findUnique({
            where: { id: request.currentUser.id },
            select: { name: true },
          })
        : null;

      // Se há sessão automática ativa, cancelar o timer e restaurar locks originais
      if (app.groupLockEngine?.isLocked(id)) {
        await app.groupLockEngine.manualUnlock(id);
      }

      // Get all members of the group
      const group = await app.prisma.lockGroup.findUnique({
        where: { id },
        include: { members: true },
      });

      if (!group) return { success: false, message: "Grupo nao encontrado" };

      const unlockedUsers: string[] = [];
      const failedUsers: string[] = [];

      // Unlock each member via SB API (set all locks to false)
      for (const member of group.members) {
        try {
          const user = await getUser(app.prisma, member.ngxUserId);
          await updateUserLocks(app.prisma, member.ngxUserId, {
            ...user.locks,
            bet: false,
            bonus_bet: false,
            casino_bet: false,
            deposit: false,
            withdraw: false,
            esport_bet: false,
          });
          unlockedUsers.push(member.ngxUserId);
          request.log.info(`[GroupLock] User ${member.ngxUserId} unlocked`);
        } catch (err: any) {
          failedUsers.push(member.ngxUserId);
          request.log.error(`[GroupLock] Failed to unlock ${member.ngxUserId}: ${err.message}`);
        }
      }

      await app.prisma.lockGroupEvent.create({
        data: {
          groupId: id,
          action: "unlocked",
          userId: request.currentUser?.id ?? null,
          userName: currentUser?.name ?? null,
          reason: body.reason ?? null,
        },
      });

      await createLog(app.prisma, request, {
        action: "group.unlocked",
        entity: "group",
        entityId: id,
        details: { unlockedUsers, failedUsers } as Record<string, unknown>,
      });

      return {
        success: true,
        message: `Grupo desbloqueado: ${unlockedUsers.length} usuarios destravados`,
        unlockedUsers,
        failedUsers,
      };
    }
  );

  // Get lock status (is locked + unlock time)
  app.get<{ Params: { id: string } }>(
    "/:id/lock-status",
    { preHandler: authorize("groups:manage", "groups:unlock") },
    async (request) => {
      const { id } = request.params;
      const session = app.groupLockEngine?.getSession(id);

      if (!session) {
        return { locked: false, lockedAt: null, unlockAt: null };
      }

      return {
        locked: true,
        lockedAt: session.lockedAt.toISOString(),
        unlockAt: session.unlockAt.toISOString(),
        triggerUserName: session.triggerUserName,
        triggerUserId: session.triggerUserId,
      };
    }
  );

  // Get lock/unlock history for a group
  app.get<{ Params: { id: string } }>(
    "/:id/events",
    { preHandler: authorize("groups:manage", "groups:unlock") },
    async (request) => {
      const { id } = request.params;
      const query = request.query as { limit?: string };
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));

      return app.prisma.lockGroupEvent.findMany({
        where: { groupId: id },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    }
  );

  // Chart data: locks grouped by hour/day
  app.get<{ Params: { id: string } }>(
    "/:id/events/chart",
    { preHandler: authorize("groups:manage", "groups:unlock") },
    async (request) => {
      const { id } = request.params;
      const query = request.query as {
        startDate?: string;
        endDate?: string;
        groupBy?: string; // "hour" | "day"
      };

      const where: Record<string, unknown> = {
        groupId: id,
        action: "locked",
      };

      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate)
          (where.createdAt as Record<string, unknown>).gte = new Date(query.startDate);
        if (query.endDate) {
          const endDate = new Date(query.endDate);
          endDate.setUTCHours(23, 59, 59, 999);
          (where.createdAt as Record<string, unknown>).lte = endDate;
        }
      }

      const events = await app.prisma.lockGroupEvent.findMany({
        where,
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });

      const groupBy = query.groupBy || "hour";
      const buckets = new Map<string, number>();

      for (const event of events) {
        const d = new Date(event.createdAt);
        let key: string;
        if (groupBy === "day") {
          key = d.toISOString().split("T")[0]!;
        } else {
          // Group by hour
          key = `${d.toISOString().split("T")[0]} ${String(d.getHours()).padStart(2, "0")}:00`;
        }
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }

      return {
        data: Array.from(buckets.entries())
          .map(([time, count]) => ({ time, count }))
          .sort((a, b) => a.time.localeCompare(b.time)),
        total: events.length,
      };
    }
  );
}
