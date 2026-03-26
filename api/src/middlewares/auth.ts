import { FastifyRequest, FastifyReply } from "fastify";

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const payload = await request.jwtVerify<{
      id: string;
      email: string;
      roleId: string;
      permissions: string[];
    }>();
    request.currentUser = payload;
  } catch {
    return reply.status(401).send({ error: "Token inválido ou expirado" });
  }
}

export function authorize(...requiredPermissions: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;

    const userPermissions = request.currentUser?.permissions ?? [];
    const hasPermission = requiredPermissions.some((p) =>
      userPermissions.includes(p)
    );

    if (!hasPermission) {
      return reply.status(403).send({ error: "Permissão insuficiente" });
    }
  };
}
