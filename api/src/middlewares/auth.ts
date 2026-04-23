import { FastifyRequest, FastifyReply } from "fastify";
import { getResolvedUser } from "../services/permissionCache";

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const payload = await request.jwtVerify<{
      id: string;
      email: string;
      roleId: string;
    }>();

    // Fresh permissions (via TTL cache) — mudanças em role refletem em até 10s
    // ou instantaneamente quando PUT /roles ou /users invalida o cache.
    const user = await getResolvedUser(request.server.prisma, payload.id);

    if (!user || !user.active) {
      return reply.status(401).send({ error: "Usuário inativo ou não encontrado" });
    }

    request.currentUser = {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      permissions: user.permissions,
    };
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
