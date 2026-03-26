import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authorize } from "../middlewares/auth";
import { createLog } from "../middlewares/logger";

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  roleId: z.string().uuid(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  roleId: z.string().uuid().optional(),
  active: z.boolean().optional(),
});

const updatePasswordSchema = z.object({
  password: z.string().min(6),
});

export async function userRoutes(app: FastifyInstance) {
  // List users
  app.get(
    "/",
    { preHandler: authorize("users:manage") },
    async (request) => {
      const query = request.query as {
        page?: string;
        limit?: string;
        search?: string;
      };
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
      const skip = (page - 1) * limit;

      const where = query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { email: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {};

      const [users, total] = await Promise.all([
        app.prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            active: true,
            createdAt: true,
            role: { select: { id: true, name: true } },
          },
        }),
        app.prisma.user.count({ where }),
      ]);

      return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
  );

  // Create user
  app.post(
    "/",
    { preHandler: authorize("users:manage") },
    async (request, reply) => {
      const body = createUserSchema.parse(request.body);
      const hashedPassword = await bcrypt.hash(body.password, 10);

      const existing = await app.prisma.user.findUnique({
        where: { email: body.email },
      });
      if (existing) {
        return reply.status(409).send({ error: "Email já cadastrado" });
      }

      const user = await app.prisma.user.create({
        data: {
          name: body.name,
          email: body.email,
          password: hashedPassword,
          roleId: body.roleId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          role: { select: { id: true, name: true } },
        },
      });

      await createLog(app.prisma, request, {
        action: "user.created",
        entity: "user",
        entityId: user.id,
        details: { name: user.name, email: user.email, role: user.role.name },
      });

      return reply.status(201).send(user);
    }
  );

  // Update user
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: authorize("users:manage") },
    async (request, reply) => {
      const { id } = request.params;
      const body = updateUserSchema.parse(request.body);

      const user = await app.prisma.user.update({
        where: { id },
        data: body,
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          role: { select: { id: true, name: true } },
        },
      });

      await createLog(app.prisma, request, {
        action: "user.updated",
        entity: "user",
        entityId: id,
        details: body as Record<string, unknown>,
      });

      return user;
    }
  );

  // Change password
  app.put<{ Params: { id: string } }>(
    "/:id/password",
    { preHandler: authorize("users:manage") },
    async (request, reply) => {
      const { id } = request.params;
      const body = updatePasswordSchema.parse(request.body);
      const hashedPassword = await bcrypt.hash(body.password, 10);

      await app.prisma.user.update({
        where: { id },
        data: { password: hashedPassword },
      });

      await createLog(app.prisma, request, {
        action: "user.password_changed",
        entity: "user",
        entityId: id,
      });

      return { success: true };
    }
  );

  // Deactivate user (soft delete)
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: authorize("users:manage") },
    async (request) => {
      const { id } = request.params;

      await app.prisma.user.update({
        where: { id },
        data: { active: false },
      });

      await createLog(app.prisma, request, {
        action: "user.deactivated",
        entity: "user",
        entityId: id,
      });

      return { success: true };
    }
  );
}
