import { FastifyInstance } from "fastify";
import { authorize } from "../middlewares/auth";

export async function logRoutes(app: FastifyInstance) {
  // List logs with filters
  app.get(
    "/",
    { preHandler: authorize("logs:read") },
    async (request) => {
      const query = request.query as {
        page?: string;
        limit?: string;
        userId?: string;
        action?: string;
        entity?: string;
        startDate?: string;
        endDate?: string;
      };

      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};

      if (query.userId) where.userId = query.userId;
      if (query.action) where.action = { contains: query.action };
      if (query.entity) where.entity = query.entity;
      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate)
          (where.createdAt as Record<string, unknown>).gte = new Date(
            query.startDate
          );
        if (query.endDate)
          (where.createdAt as Record<string, unknown>).lte = new Date(
            query.endDate
          );
      }

      const [logs, total] = await Promise.all([
        app.prisma.log.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        }),
        app.prisma.log.count({ where }),
      ]);

      return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
  );
}
