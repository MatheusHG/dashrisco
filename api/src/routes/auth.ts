import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authenticate } from "../middlewares/auth";
import { createLog } from "../middlewares/logger";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  // Login
  app.post("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await app.prisma.user.findUnique({
      where: { email: body.email },
      include: {
        role: {
          include: { permissions: true },
        },
      },
    });

    if (!user || !user.active) {
      return reply.status(401).send({ error: "Credenciais inválidas" });
    }

    const passwordValid = await bcrypt.compare(body.password, user.password);
    if (!passwordValid) {
      return reply.status(401).send({ error: "Credenciais inválidas" });
    }

    const permissions = user.role.permissions.map((p) => p.action);

    const accessToken = app.jwt.sign(
      {
        id: user.id,
        email: user.email,
        roleId: user.roleId,
        permissions,
      },
      { expiresIn: "15m" }
    );

    const refreshToken = app.jwt.sign(
      { id: user.id, type: "refresh" },
      { expiresIn: "7d" }
    );

    await createLog(app.prisma, request, {
      action: "user.login",
      entity: "user",
      entityId: user.id,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
        permissions,
      },
    };
  });

  // Refresh token
  app.post("/refresh", async (request, reply) => {
    const body = refreshSchema.parse(request.body);

    try {
      const payload = app.jwt.verify<{ id: string; type: string }>(
        body.refreshToken
      );

      if (payload.type !== "refresh") {
        return reply.status(401).send({ error: "Token inválido" });
      }

      const user = await app.prisma.user.findUnique({
        where: { id: payload.id },
        include: {
          role: { include: { permissions: true } },
        },
      });

      if (!user || !user.active) {
        return reply.status(401).send({ error: "Usuário não encontrado" });
      }

      const permissions = user.role.permissions.map((p) => p.action);

      const accessToken = app.jwt.sign(
        {
          id: user.id,
          email: user.email,
          roleId: user.roleId,
          permissions,
        },
        { expiresIn: "15m" }
      );

      const refreshToken = app.jwt.sign(
        { id: user.id, type: "refresh" },
        { expiresIn: "7d" }
      );

      return { accessToken, refreshToken };
    } catch {
      return reply.status(401).send({ error: "Refresh token inválido" });
    }
  });

  // Get current user info
  app.get(
    "/me",
    { preHandler: authenticate },
    async (request) => {
      const user = await app.prisma.user.findUnique({
        where: { id: request.currentUser!.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: {
            select: {
              name: true,
              permissions: { select: { action: true } },
            },
          },
        },
      });

      return {
        ...user,
        permissions: user?.role.permissions.map((p) => p.action),
      };
    }
  );
}
