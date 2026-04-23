import { FastifyInstance } from "fastify";
import { z } from "zod";
import { authorize } from "../middlewares/auth";
import { createLog } from "../middlewares/logger";
import { invalidateRole } from "../services/permissionCache";

const createRoleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  permissionIds: z.array(z.string().uuid()),
});

const updateRoleSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  permissionIds: z.array(z.string().uuid()).optional(),
});

export async function roleRoutes(app: FastifyInstance) {
  // List roles
  app.get(
    "/",
    { preHandler: authorize("roles:manage", "users:manage") },
    async () => {
      return app.prisma.role.findMany({
        include: {
          permissions: { select: { id: true, action: true } },
          _count: { select: { users: true } },
        },
        orderBy: { name: "asc" },
      });
    }
  );

  // List all permissions
  app.get(
    "/permissions",
    { preHandler: authorize("roles:manage") },
    async () => {
      return app.prisma.permission.findMany({
        orderBy: { action: "asc" },
      });
    }
  );

  // Create role
  app.post(
    "/",
    { preHandler: authorize("roles:manage") },
    async (request, reply) => {
      const body = createRoleSchema.parse(request.body);

      const role = await app.prisma.role.create({
        data: {
          name: body.name,
          description: body.description,
          permissions: {
            connect: body.permissionIds.map((id) => ({ id })),
          },
        },
        include: { permissions: { select: { id: true, action: true } } },
      });

      await createLog(app.prisma, request, {
        action: "role.created",
        entity: "role",
        entityId: role.id,
        details: { name: role.name, permissions: body.permissionIds },
      });

      return reply.status(201).send(role);
    }
  );

  // Update role
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: authorize("roles:manage") },
    async (request) => {
      const { id } = request.params;
      const body = updateRoleSchema.parse(request.body);

      const data: Record<string, unknown> = {};
      if (body.name) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.permissionIds) {
        data.permissions = {
          set: body.permissionIds.map((pid) => ({ id: pid })),
        };
      }

      const role = await app.prisma.role.update({
        where: { id },
        data,
        include: { permissions: { select: { id: true, action: true } } },
      });

      invalidateRole(id);

      await createLog(app.prisma, request, {
        action: "role.updated",
        entity: "role",
        entityId: id,
        details: body as Record<string, unknown>,
      });

      return role;
    }
  );

  // Delete role
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: authorize("roles:manage") },
    async (request, reply) => {
      const { id } = request.params;

      const usersWithRole = await app.prisma.user.count({
        where: { roleId: id },
      });

      if (usersWithRole > 0) {
        return reply.status(400).send({
          error: `Não é possível excluir: ${usersWithRole} usuário(s) usam esta role`,
        });
      }

      await app.prisma.role.delete({ where: { id } });

      await createLog(app.prisma, request, {
        action: "role.deleted",
        entity: "role",
        entityId: id,
      });

      return { success: true };
    }
  );
}
