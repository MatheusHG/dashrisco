import { PrismaClient } from "@prisma/client";
import axios, { AxiosInstance } from "axios";

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

export async function getUser(prisma: PrismaClient, userId: string) {
  const sb = await getSbClient(prisma);
  const { data } = await sb.get("/user/find", {
    params: { query: "ID", field: userId },
  });
  return data as { id: string; locks: UserLocks; [key: string]: any };
}

export async function updateUserLocks(prisma: PrismaClient, userId: string, locks: UserLocks) {
  const sb = await getSbClient(prisma);
  await sb.put(`/user/${userId}/edit-client`, { locks });
}

export const FULL_LOCK: UserLocks = {
  bet: true,
  bonus_bet: true,
  casino_bet: true,
  deposit: true,
  withdraw: true,
  esport_bet: true,
};
