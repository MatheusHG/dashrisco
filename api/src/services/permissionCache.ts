import { PrismaClient } from "@prisma/client";

type Entry = {
  active: boolean;
  roleId: string;
  email: string;
  permissions: string[];
  expiresAt: number;
};

const TTL_MS = 10_000;
const cache = new Map<string, Entry>();

export type ResolvedUser = {
  id: string;
  email: string;
  roleId: string;
  active: boolean;
  permissions: string[];
};

export async function getResolvedUser(
  prisma: PrismaClient,
  userId: string
): Promise<ResolvedUser | null> {
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > now) {
    return {
      id: userId,
      email: cached.email,
      roleId: cached.roleId,
      active: cached.active,
      permissions: cached.permissions,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      active: true,
      roleId: true,
      role: { select: { permissions: { select: { action: true } } } },
    },
  });

  if (!user) {
    cache.delete(userId);
    return null;
  }

  const permissions = user.role.permissions.map((p) => p.action);
  cache.set(userId, {
    active: user.active,
    roleId: user.roleId,
    email: user.email,
    permissions,
    expiresAt: now + TTL_MS,
  });

  return {
    id: user.id,
    email: user.email,
    roleId: user.roleId,
    active: user.active,
    permissions,
  };
}

export function invalidateUser(userId: string): void {
  cache.delete(userId);
}

export function invalidateRole(roleId: string): void {
  for (const [userId, entry] of cache) {
    if (entry.roleId === roleId) cache.delete(userId);
  }
}
