import { PrismaClient } from "@prisma/client";
import axios, { AxiosInstance } from "axios";
import { tokenManager } from "./tokenManager";

const SB_KEYS = ["SB_API_BASE_URL", "SB_API_TOKEN", "SB_API_REFERER"] as const;

interface SbConfig {
  SB_API_BASE_URL: string;
  SB_API_TOKEN: string;
  SB_API_REFERER: string;
}

let cached: { config: SbConfig; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minuto

async function loadSbConfig(prisma: PrismaClient): Promise<SbConfig> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.config;
  }

  const rows = await prisma.appConfig.findMany({
    where: { key: { in: [...SB_KEYS] } },
  });

  const map = new Map(rows.map((r) => [r.key, r.value]));

  const config: SbConfig = {
    SB_API_BASE_URL: map.get("SB_API_BASE_URL") || "",
    SB_API_TOKEN: map.get("SB_API_TOKEN") || "",
    SB_API_REFERER: map.get("SB_API_REFERER") || "",
  };

  cached = { config, fetchedAt: Date.now() };
  return config;
}

export function invalidateSbCache() {
  cached = null;
}

export async function getSbClient(prisma: PrismaClient): Promise<AxiosInstance> {
  const config = await loadSbConfig(prisma);

  return axios.create({
    baseURL: config.SB_API_BASE_URL,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.SB_API_TOKEN}`,
      Referer: config.SB_API_REFERER,
    },
  });
}

export interface UserLocks {
  bet: boolean;
  bonus_bet: boolean;
  casino_bet: boolean;
  deposit: boolean;
  withdraw: boolean;
  esport_bet: boolean;
  [key: string]: boolean;
}

/**
 * Executa fn com um SbClient e, em caso de 401, renova o token automaticamente
 * via TokenManager e repete a chamada uma vez.
 */
async function sbRequest<T>(
  prisma: PrismaClient,
  fn: (client: AxiosInstance) => Promise<T>
): Promise<T> {
  const client = await getSbClient(prisma);
  try {
    return await fn(client);
  } catch (err: any) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      await tokenManager.refreshToken(prisma);
      const freshClient = await getSbClient(prisma);
      return await fn(freshClient);
    }
    throw err;
  }
}

export async function getUser(prisma: PrismaClient, userId: string) {
  const data = await sbRequest(prisma, (sb) =>
    sb.get("/user/find", { params: { query: "ID", field: userId } }).then((r) => r.data)
  );
  return data as { id: string; locks: UserLocks; [key: string]: any };
}

export async function updateUserLocks(prisma: PrismaClient, userId: string, locks: UserLocks) {
  await sbRequest(prisma, (sb) => sb.put(`/user/${userId}/edit-client`, { locks }));
}

export const FULL_LOCK: UserLocks = {
  bet: true,
  bonus_bet: true,
  casino_bet: true,
  deposit: true,
  withdraw: true,
  esport_bet: true,
};
