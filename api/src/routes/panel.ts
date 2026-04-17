import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { authorize, authenticate } from "../middlewares/auth";
import { createLog } from "../middlewares/logger";
import { eventBus } from "../services/eventBus";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const updateTaskSchema = z.object({
  status: z.enum(["open", "in_progress", "done"]).optional(),
  priority: z.number().int().min(1).max(4).optional(),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
});

// SSE clients pool
const sseClients = new Set<{ res: any; alive: boolean }>();

// Broadcast new alerts to all SSE clients
eventBus.on("panel-alert", (alert: any) => {
  const data = `data: ${JSON.stringify(alert)}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(data);
    } catch {
      client.alive = false;
    }
  }
});

export async function panelRoutes(app: FastifyInstance) {
  // ==================
  // SSE STREAM (real-time notifications)
  // ==================
  app.get("/notifications/stream", async (request: FastifyRequest, reply: FastifyReply) => {
    // Authenticate via query param (EventSource doesn't support headers)
    const token = (request.query as any).token;
    if (token) {
      try {
        await app.jwt.verify(token);
      } catch {
        return reply.status(401).send({ error: "Invalid token" });
      }
    } else {
      // Try header auth
      try {
        await authenticate(request, reply);
        if (reply.sent) return;
      } catch {
        return reply.status(401).send({ error: "Unauthorized" });
      }
    }

    const raw = reply.raw;
    raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Send initial connected event
    raw.write("data: {\"connected\":true}\n\n");

    const client = { res: raw, alive: true };
    sseClients.add(client);

    // Heartbeat every 30s
    const heartbeat = setInterval(() => {
      try {
        raw.write(":heartbeat\n\n");
      } catch {
        client.alive = false;
      }
    }, 30000);

    // Cleanup on close
    request.raw.on("close", () => {
      clearInterval(heartbeat);
      sseClients.delete(client);
    });

    // Don't let Fastify close the response
    await reply.hijack();
  });

  // ==================
  // PANEL ALERTS
  // ==================

  // Recent notifications (for the bell icon)
  app.get(
    "/notifications",
    { preHandler: authorize("panel:read", "alerts:read") },
    async (request) => {
      const query = request.query as { since?: string };

      const dateFilter = query.since
        ? { createdAt: { gt: new Date(query.since) } }
        : {};

      // Alerts with publishPanel=true and mode=ALERT, OR system alerts (group_lock)
      // WATCH mode alerts are excluded from notifications
      const alerts = await app.prisma.panelAlert.findMany({
        where: {
          ...dateFilter,
          OR: [
            { alertConfig: { publishPanel: true }, mode: "ALERT" },
            { source: "group_lock" },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          alertConfig: { select: { name: true } },
          task: { select: { id: true, status: true } },
        },
      });

      return alerts.map((a) => ({ ...a, taskId: a.task?.id ?? null, taskStatus: a.task?.status ?? null, task: undefined }));
    }
  );

  // List panel alerts
  app.get(
    "/alerts",
    { preHandler: authorize("panel:read", "alerts:read") },
    async (request) => {
      const query = request.query as {
        page?: string;
        limit?: string;
        webhookType?: string;
        alertConfigId?: string;
        startDate?: string;
        endDate?: string;
        mode?: string;
        queue?: string; // "pending" = só alertas que precisam analisar
      };

      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      if (query.webhookType) where.webhookType = query.webhookType;
      if (query.alertConfigId) where.alertConfigId = query.alertConfigId;
      if (query.mode) where.mode = query.mode;
      // Fila de trabalho: só alertas sem task concluída/em andamento
      if (query.queue === "pending") {
        where.OR = [
          { task: null },
          { task: { status: "open" } },
        ];
      } else if (query.queue === "done") {
        where.task = { status: "done" };
      } else if (query.queue === "in_progress") {
        where.task = { status: "in_progress" };
      }
      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate)
          (where.createdAt as Record<string, unknown>).gte = new Date(
            query.startDate + "T00:00:00.000-03:00"
          );
        if (query.endDate)
          (where.createdAt as Record<string, unknown>).lte = new Date(
            query.endDate + "T23:59:59.999-03:00"
          );
      }

      const [rawAlerts, total] = await Promise.all([
        app.prisma.panelAlert.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            alertConfig: { select: { id: true, name: true } },
            task: { select: { id: true, status: true } },
          },
        }),
        app.prisma.panelAlert.count({ where }),
      ]);

      const alerts = rawAlerts.map((a) => ({ ...a, taskId: a.task?.id ?? null, taskStatus: a.task?.status ?? null, task: undefined }));

      return { alerts, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
  );

  // ==================
  // PANEL TASKS
  // ==================

  // List panel tasks
  app.get(
    "/tasks",
    { preHandler: authorize("panel:read") },
    async (request) => {
      const query = request.query as {
        page?: string;
        limit?: string;
        status?: string;
        completedBy?: string;
        assignedTo?: string;
        webhookType?: string;
        alertConfigId?: string;
        startDate?: string;
        endDate?: string;
      };

      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(200, Math.max(1, Number(query.limit) || 20));
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      if (query.status) where.status = query.status;
      if (query.completedBy) where.completedBy = query.completedBy;
      if (query.assignedTo) where.assignedTo = query.assignedTo;
      if (query.alertConfigId) where.alertConfigId = query.alertConfigId;
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
          (where.createdAt as Record<string, unknown>).gte = new Date(query.startDate + "T00:00:00.000-03:00");
        if (query.endDate)
          (where.createdAt as Record<string, unknown>).lte = new Date(query.endDate + "T23:59:59.999-03:00");
      }

      const [tasks, total, users] = await Promise.all([
        app.prisma.panelTask.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            _count: { select: { comments: true } },
          },
        }),
        app.prisma.panelTask.count({ where }),
        app.prisma.user.findMany({
          where: { active: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
      ]);

      return {
        tasks,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        users,
      };
    }
  );

  // Update task status
  app.put<{ Params: { id: string } }>(
    "/tasks/:id",
    { preHandler: authorize("panel:read") },
    async (request) => {
      const { id } = request.params;
      const body = updateTaskSchema.parse(request.body);

      // Fetch current task to detect changes
      const current = await app.prisma.panelTask.findUnique({ where: { id } });
      if (!current) return request.server.prisma; // will 404

      const updateData: {
        status?: string;
        priority?: number;
        title?: string;
        description?: string | null;
        assignedTo?: string | null;
        completedBy?: string | null;
        completedAt?: Date | null;
      } = {};

      if (body.status !== undefined) updateData.status = body.status;
      if (body.priority !== undefined) updateData.priority = body.priority;
      if (body.title !== undefined) updateData.title = body.title;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.assignedTo !== undefined) updateData.assignedTo = body.assignedTo;

      // Auto-assign: se moveu a task e não tem responsável, atribui a quem moveu
      if (body.status !== undefined && !current.assignedTo && body.assignedTo === undefined) {
        updateData.assignedTo = request.currentUser?.id ?? null;
      }

      // Quando marcar como "done", registrar quem completou e quando
      // Preserva o primeiro completedAt para SLA (reaberturas não afetam)
      if (body.status === "done") {
        updateData.completedBy = request.currentUser?.id ?? null;
        if (!current.completedAt) {
          updateData.completedAt = new Date();
        }
      }
      // Se reabrir, limpa apenas completedBy (mantém completedAt original para SLA)
      if (body.status && body.status !== "done") {
        updateData.completedBy = null;
      }

      const task = await app.prisma.panelTask.update({
        where: { id },
        data: updateData,
      });

      // Resolve user name for assignedTo
      const resolveUserName = async (userId: string | null | undefined) => {
        if (!userId) return null;
        const u = await app.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        return u?.name ?? null;
      };

      // Granular activity logs
      const statusLabels: Record<string, string> = { open: "Aberta", in_progress: "Em Andamento", done: "Concluida" };
      const priorityLabels: Record<number, string> = { 1: "Urgente", 2: "Alta", 3: "Normal", 4: "Baixa" };

      if (body.status !== undefined && body.status !== current.status) {
        await createLog(app.prisma, request, {
          action: "task.status_changed",
          entity: "task",
          entityId: id,
          details: { from: statusLabels[current.status] ?? current.status, to: statusLabels[body.status] ?? body.status },
        });
      }

      if (body.priority !== undefined && body.priority !== current.priority) {
        await createLog(app.prisma, request, {
          action: "task.priority_changed",
          entity: "task",
          entityId: id,
          details: { from: priorityLabels[current.priority] ?? current.priority, to: priorityLabels[body.priority] ?? body.priority },
        });
      }

      if (body.assignedTo !== undefined && body.assignedTo !== current.assignedTo) {
        const assignedName = await resolveUserName(body.assignedTo);
        const previousName = await resolveUserName(current.assignedTo);
        await createLog(app.prisma, request, {
          action: body.assignedTo ? "task.assigned" : "task.unassigned",
          entity: "task",
          entityId: id,
          details: {
            from: previousName,
            to: assignedName,
            assignedToId: body.assignedTo,
          },
        });
      }

      if (body.title !== undefined && body.title !== current.title) {
        await createLog(app.prisma, request, {
          action: "task.title_changed",
          entity: "task",
          entityId: id,
          details: { from: current.title, to: body.title },
        });
      }

      if (body.description !== undefined && body.description !== current.description) {
        await createLog(app.prisma, request, {
          action: "task.description_changed",
          entity: "task",
          entityId: id,
          details: {},
        });
      }

      return task;
    }
  );

  // ==================
  // TASK DETAIL (with comments)
  // ==================

  app.get<{ Params: { id: string } }>(
    "/tasks/:id",
    { preHandler: authorize("panel:read") },
    async (request, reply) => {
      const task = await app.prisma.panelTask.findUnique({
        where: { id: request.params.id },
        include: {
          comments: {
            orderBy: { createdAt: "asc" },
          },
          attachments: {
            orderBy: { createdAt: "desc" },
          },
        },
      });
      if (!task) return reply.status(404).send({ error: "Task nao encontrada" });

      // Resolve user names for assignedTo and completedBy
      const userIds = [task.assignedTo, task.completedBy].filter(
        (id): id is string => !!id
      );
      const relatedUsers =
        userIds.length > 0
          ? await app.prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, name: true },
            })
          : [];

      // All active users for the assignment dropdown
      const allUsers = await app.prisma.user.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });

      return {
        ...task,
        assignedUser: relatedUsers.find((u) => u.id === task.assignedTo) ?? null,
        completedByUser: relatedUsers.find((u) => u.id === task.completedBy) ?? null,
        allUsers,
      };
    }
  );

  // ==================
  // TASK HISTORY (activity log)
  // ==================

  app.get<{ Params: { id: string } }>(
    "/tasks/:id/history",
    { preHandler: authorize("panel:read") },
    async (request) => {
      const { id } = request.params;

      const logs = await app.prisma.log.findMany({
        where: {
          entity: "task",
          entityId: id,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { id: true, name: true } },
        },
      });

      return logs;
    }
  );

  // ==================
  // ANALYSIS WIZARD
  // ==================

  // Start analysis - auto-assign + set in_progress
  app.post<{ Params: { id: string } }>(
    "/tasks/:id/start-analysis",
    { preHandler: authorize("panel:read") },
    async (request, reply) => {
      const { id } = request.params;
      const task = await app.prisma.panelTask.findUnique({ where: { id } });
      if (!task) return reply.status(404).send({ error: "Task nao encontrada" });

      // Se já tem dono e é outro usuário
      if (task.assignedTo && task.assignedTo !== request.currentUser?.id) {
        const owner = await app.prisma.user.findUnique({ where: { id: task.assignedTo }, select: { name: true } });
        return reply.status(409).send({ error: `${owner?.name || "Outro analista"} ja iniciou esta analise` });
      }

      const updated = await app.prisma.panelTask.update({
        where: { id },
        data: {
          assignedTo: request.currentUser?.id ?? null,
          status: task.status === "open" ? "in_progress" : task.status,
        },
        include: {
          comments: { orderBy: { createdAt: "asc" } },
          attachments: { orderBy: { createdAt: "desc" } },
        },
      });

      await createLog(app.prisma, request, {
        action: "task.analysis_started",
        entity: "task",
        entityId: id,
      });

      return updated;
    }
  );

  // Complete analysis - validate checklist + save parecer + done
  app.post<{ Params: { id: string } }>(
    "/tasks/:id/complete-analysis",
    { preHandler: authorize("panel:read") },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as { parecer: string };

      if (!body.parecer?.trim()) {
        return reply.status(400).send({ error: "Parecer final obrigatorio" });
      }

      const task = await app.prisma.panelTask.findUnique({ where: { id } });
      if (!task) return reply.status(404).send({ error: "Task nao encontrada" });

      const checklist = (task.checklist as Array<{ label: string; checked: boolean }>) || [];
      const allChecked = checklist.length === 0 || checklist.every((item) => item.checked);

      if (!allChecked) {
        return reply.status(400).send({ error: "Todas as verificacoes devem ser concluidas" });
      }

      const updated = await app.prisma.panelTask.update({
        where: { id },
        data: {
          parecer: body.parecer.trim(),
          status: "done",
          completedBy: request.currentUser?.id ?? null,
          completedAt: task.completedAt ?? new Date(),
        },
      });

      await createLog(app.prisma, request, {
        action: "task.analysis_completed",
        entity: "task",
        entityId: id,
        details: { parecer: body.parecer.trim().slice(0, 200) },
      });

      return updated;
    }
  );

  // ==================
  // TASK CHECKLIST
  // ==================

  app.patch<{ Params: { id: string } }>(
    "/tasks/:id/checklist",
    { preHandler: authorize("panel:read") },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as { index: number; checked: boolean };

      const task = await app.prisma.panelTask.findUnique({ where: { id } });
      if (!task) return reply.status(404).send({ error: "Task nao encontrada" });

      const checklist = (task.checklist as Array<{ label: string; checked: boolean }>) || [];
      if (body.index < 0 || body.index >= checklist.length) {
        return reply.status(400).send({ error: "Indice invalido" });
      }

      checklist[body.index] = { ...checklist[body.index]!, checked: body.checked };

      const allChecked = checklist.length > 0 && checklist.every((item) => item.checked);

      const updateData: Record<string, unknown> = { checklist };

      // Auto-complete: se todos os itens estão marcados, conclui a task
      if (allChecked && task.status !== "done") {
        updateData.status = "done";
        updateData.completedBy = request.currentUser?.id ?? null;
        if (!task.completedAt) {
          updateData.completedAt = new Date();
        }
      }

      // Se desmarcou algum e a task estava done, reabre
      if (!allChecked && task.status === "done") {
        updateData.status = "in_progress";
        updateData.completedBy = null;
      }

      const updated = await app.prisma.panelTask.update({
        where: { id },
        data: updateData,
      });

      return updated;
    }
  );

  // ==================
  // TASK COMMENTS
  // ==================

  app.post<{ Params: { id: string } }>(
    "/tasks/:id/comments",
    { preHandler: authorize("panel:read") },
    async (request, reply) => {
      const { id } = request.params;

      let message = "";
      const imagePaths: string[] = [];

      // Check if multipart (image upload) or JSON
      const contentType = request.headers["content-type"] || "";
      if (contentType.includes("multipart/form-data")) {
        const parts = request.parts();
        for await (const part of parts) {
          if (part.type === "field" && part.fieldname === "message") {
            message = (part.value as string) || "";
          } else if (part.type === "file" && (part.fieldname === "image" || part.fieldname === "images")) {
            const uploadsDir = path.join(__dirname, "..", "..", "uploads", "comments");
            fs.mkdirSync(uploadsDir, { recursive: true });
            const ext = path.extname(part.filename || ".png");
            const storedName = `${randomUUID()}${ext}`;
            const filePath = path.join(uploadsDir, storedName);
            const buffer = await part.toBuffer();
            fs.writeFileSync(filePath, buffer);
            imagePaths.push(`comments/${storedName}`);
          }
        }
      } else {
        const body = request.body as { message?: string };
        message = body.message?.trim() || "";
      }

      // Serialize: single image as plain string (backward compat), multiple as JSON array
      const imageUrl: string | null = imagePaths.length === 0
        ? null
        : imagePaths.length === 1
          ? imagePaths[0]!
          : JSON.stringify(imagePaths);

      if (!message && !imageUrl) {
        return reply.status(400).send({ error: "Mensagem ou imagem obrigatoria" });
      }

      const user = request.currentUser?.id
        ? await app.prisma.user.findUnique({
            where: { id: request.currentUser.id },
            select: { name: true },
          })
        : null;

      const comment = await app.prisma.taskComment.create({
        data: {
          taskId: id,
          userId: request.currentUser?.id ?? null,
          userName: user?.name ?? "Desconhecido",
          message: message || "",
          imageUrl,
        },
      });

      await createLog(app.prisma, request, {
        action: "task.comment_added",
        entity: "task",
        entityId: id,
        details: { commentId: comment.id, message: comment.message, hasImage: !!imageUrl },
      });

      return reply.status(201).send(comment);
    }
  );

  app.delete<{ Params: { id: string; commentId: string } }>(
    "/tasks/:id/comments/:commentId",
    { preHandler: authorize("panel:read") },
    async (request) => {
      const { commentId } = request.params;
      await app.prisma.taskComment.delete({ where: { id: commentId } });
      return { success: true };
    }
  );

  // ==================
  // TASK ATTACHMENTS
  // ==================

  const ALLOWED_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "text/csv",
  ];

  // Upload attachment
  app.post<{ Params: { id: string } }>(
    "/tasks/:id/attachments",
    { preHandler: authorize("panel:read") },
    async (request, reply) => {
      const { id } = request.params;
      const file = await request.file();
      if (!file) return reply.status(400).send({ error: "Nenhum arquivo enviado" });

      if (!ALLOWED_TYPES.includes(file.mimetype)) {
        return reply.status(400).send({ error: "Tipo de arquivo nao permitido" });
      }

      const uploadsDir = path.join(__dirname, "..", "..", "uploads", "tasks");
      fs.mkdirSync(uploadsDir, { recursive: true });

      const ext = path.extname(file.filename);
      const storedName = `${randomUUID()}${ext}`;
      const filePath = path.join(uploadsDir, storedName);

      const buffer = await file.toBuffer();
      fs.writeFileSync(filePath, buffer);

      const attachment = await app.prisma.taskAttachment.create({
        data: {
          taskId: id,
          fileName: file.filename,
          fileType: file.mimetype,
          fileSize: buffer.length,
          filePath: `tasks/${storedName}`,
          uploadedBy: request.currentUser?.id ?? null,
        },
      });

      return reply.status(201).send(attachment);
    }
  );

  // List attachments
  app.get<{ Params: { id: string } }>(
    "/tasks/:id/attachments",
    { preHandler: authorize("panel:read") },
    async (request) => {
      const attachments = await app.prisma.taskAttachment.findMany({
        where: { taskId: request.params.id },
        orderBy: { createdAt: "desc" },
      });
      return attachments;
    }
  );

  // Delete attachment
  app.delete<{ Params: { id: string; attachmentId: string } }>(
    "/tasks/:id/attachments/:attachmentId",
    { preHandler: authorize("panel:read") },
    async (request, reply) => {
      const { attachmentId } = request.params;
      const attachment = await app.prisma.taskAttachment.findUnique({ where: { id: attachmentId } });
      if (!attachment) return reply.status(404).send({ error: "Anexo nao encontrado" });

      // Delete file from disk
      const fullPath = path.join(__dirname, "..", "..", "uploads", attachment.filePath);
      try { fs.unlinkSync(fullPath); } catch {}

      await app.prisma.taskAttachment.delete({ where: { id: attachmentId } });
      return { success: true };
    }
  );
}
