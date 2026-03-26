import { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";

interface LogParams {
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

export async function createLog(
  prisma: FastifyInstance["prisma"],
  request: FastifyRequest,
  params: LogParams
) {
  try {
    await prisma.log.create({
      data: {
        userId: request.currentUser?.id ?? null,
        action: params.action,
        entity: params.entity ?? null,
        entityId: params.entityId ?? null,
        details: (params.details as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        ip: request.ip,
      },
    });
  } catch (err) {
    request.log.error({ err }, "Failed to create log entry");
  }
}
