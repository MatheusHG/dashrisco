import { FastifyInstance } from "fastify";
import { z } from "zod";
import { authorize } from "../middlewares/auth";
import { createLog } from "../middlewares/logger";
import { invalidateSbCache } from "../services/sbClient";

const upsertSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  label: z.string().optional(),
});

const bulkUpsertSchema = z.array(upsertSchema);

export async function configRoutes(app: FastifyInstance) {
  // List all configs
  app.get(
    "/",
    { preHandler: authorize("settings:manage") },
    async () => {
      return app.prisma.appConfig.findMany({
        orderBy: { key: "asc" },
      });
    }
  );

  // Get single config
  app.get<{ Params: { key: string } }>(
    "/:key",
    { preHandler: authorize("settings:manage") },
    async (request, reply) => {
      const config = await app.prisma.appConfig.findUnique({
        where: { key: request.params.key },
      });
      if (!config) return reply.status(404).send({ error: "Config não encontrada" });
      return config;
    }
  );

  // Upsert single config
  app.put<{ Params: { key: string } }>(
    "/:key",
    { preHandler: authorize("settings:manage") },
    async (request) => {
      const body = upsertSchema.parse(request.body);

      const config = await app.prisma.appConfig.upsert({
        where: { key: body.key },
        update: { value: body.value, label: body.label },
        create: { key: body.key, value: body.value, label: body.label },
      });

      invalidateSbCache();

      await createLog(app.prisma, request, {
        action: "config.updated",
        entity: "config",
        entityId: body.key,
        details: { key: body.key },
      });

      return config;
    }
  );

  // Bulk upsert
  app.put(
    "/",
    { preHandler: authorize("settings:manage") },
    async (request) => {
      const items = bulkUpsertSchema.parse(request.body);

      const results = await app.prisma.$transaction(
        items.map((item) =>
          app.prisma.appConfig.upsert({
            where: { key: item.key },
            update: { value: item.value, label: item.label },
            create: { key: item.key, value: item.value, label: item.label },
          })
        )
      );

      invalidateSbCache();

      await createLog(app.prisma, request, {
        action: "config.bulk_updated",
        entity: "config",
        details: { keys: items.map((i) => i.key) },
      });

      return results;
    }
  );

  // Delete config
  app.delete<{ Params: { key: string } }>(
    "/:key",
    { preHandler: authorize("settings:manage") },
    async (request) => {
      const { key } = request.params;

      await app.prisma.appConfig.delete({ where: { key } });
      invalidateSbCache();

      await createLog(app.prisma, request, {
        action: "config.deleted",
        entity: "config",
        entityId: key,
      });

      return { success: true };
    }
  );
}
