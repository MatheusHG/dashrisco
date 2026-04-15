import { createClient } from "@clickhouse/client";
import { Agent as HttpsAgent } from "https";

// Força IPv4 — a VPS usa IPv6 por padrão mas o ClickHouse Cloud só aceita IPv4.
const ipv4Agent = new HttpsAgent({ family: 4 });

export function getClickHouseClient() {
  return createClient({
    url: process.env.CLICKHOUSE_HOST,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB || "majorsports",
    http_agent: ipv4Agent,
    keep_alive: { enabled: true },
  });
}
