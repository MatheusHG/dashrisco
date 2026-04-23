import { PrismaClient, Prisma, AlertConfig, AlertFilter, AlertQueryCondition } from "@prisma/client";
import axios from "axios";
import { eventBus } from "./eventBus";
import type { ClickHouseClient } from "@clickhouse/client";

type AlertConfigFull = AlertConfig & {
  filters: AlertFilter[];
  queryConditions: AlertQueryCondition[];
};

const NGX_EARLY_PAYOUT_TYPES = new Set(["HOME_EP", "AWAY_EP", "DRAW_EP"]);
const RADAR_EARLY_PAYOUT_TYPES = new Set(["EP_1X2"]);

function hasEarlyPayoutEvent(
  data: Record<string, unknown>,
  providers: string[]
): boolean {
  if (providers.length === 0) return false;
  const accepted = new Set<string>();
  if (providers.includes("NGX")) NGX_EARLY_PAYOUT_TYPES.forEach((t) => accepted.add(t));
  if (providers.includes("RADAR")) RADAR_EARLY_PAYOUT_TYPES.forEach((t) => accepted.add(t));

  const events = data.bet_events;
  if (!Array.isArray(events)) return false;
  for (const ev of events) {
    const oddsType = (ev as { odds_type?: unknown } | null)?.odds_type;
    if (typeof oddsType === "string" && accepted.has(oddsType)) {
      return true;
    }
  }
  return false;
}

function parseEarlyPayoutProviders(raw: unknown): string[] {
  if (!Array.isArray(raw)) return ["NGX"];
  const out = raw.filter((p): p is string => typeof p === "string" && (p === "NGX" || p === "RADAR"));
  return out.length > 0 ? out : ["NGX"];
}

/**
 * Motor de alertas dinâmicos.
 * Avalia os dados do webhook contra as configurações de alerta ativas
 * e executa as ações configuradas (painel, chat, tasks).
 * Opcionalmente executa queries no ClickHouse para enriquecer a avaliação.
 */
export class AlertEngine {
  constructor(
    private prisma: PrismaClient,
    private clickhouse?: ClickHouseClient
  ) {}

  /**
   * Processa um webhook recebido contra todas as configurações de alerta ativas.
   */
  async processWebhook(
    webhookType: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const normalizedData = this.normalizeWebhookData(webhookType, data);

    const incomingUserId = String(
      normalizedData.user_id ?? normalizedData.login_user_id ?? ""
    );
    if (incomingUserId === "697a731307486f0027370128") {
      console.log(
        `[AlertEngine][debug user 697a731307486f0027370128] webhookType=${webhookType} payload=${this.safeStringify(data)}`
      );
    }

    const configs = await this.prisma.alertConfig.findMany({
      where: {
        webhookType: webhookType as any,
        active: true,
      },
      include: {
        filters: { orderBy: { order: "asc" } },
        queryConditions: { orderBy: { order: "asc" } },
      },
    });

    for (const config of configs) {
      try {
        // 0) Pagamento Antecipado — só aplicável a SPORT_BET / SPORT_PRIZE
        if (
          config.requireEarlyPayout &&
          (config.webhookType === "SPORT_BET" || config.webhookType === "SPORT_PRIZE") &&
          !hasEarlyPayoutEvent(normalizedData, parseEarlyPayoutProviders(config.earlyPayoutProviders))
        ) {
          continue;
        }

        // 1) Filtros basicos no webhook data
        const filtersOk = this.evaluateFilters(config.filters, normalizedData);
        if (!filtersOk) {
          continue;
        }

        // 2) Query ClickHouse (se habilitada)
        let queryResult: Record<string, string> | null = null;
        if (config.queryEnabled && config.clickhouseQuery && this.clickhouse) {
          const result = await this.evaluateClickHouseQuery(config, normalizedData);
          if (!result.passed) {
            continue;
          }
          queryResult = result.row;
        }

        // 3) Cooldown — intervalo mínimo entre disparos por usuário
        if (config.cooldownMinutes && config.cooldownMinutes > 0) {
          const userId = String(normalizedData.user_id ?? normalizedData.login_user_id ?? "");
          const since = new Date(Date.now() - config.cooldownMinutes * 60000);
          const cooldownWhere: Record<string, unknown> = {
            alertConfigId: config.id,
            createdAt: { gte: since },
          };
          if (userId) {
            cooldownWhere.data = { path: ["user_id"], equals: userId };
          }
          const recent = await this.prisma.panelAlert.findFirst({ where: cooldownWhere });
          if (recent) continue;
        }

        // 4) Executar acoes
        const enrichedData = queryResult
          ? { ...normalizedData, _queryResult: queryResult }
          : normalizedData;
        await this.executeActions(config, enrichedData);
      } catch (err) {
        console.error(`[AlertEngine] Config "${config.name}" (${config.id}) falhou durante o processamento:`, err);
      }
    }
  }

  private safeStringify(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch (err) {
      return `[unserializable-payload: ${(err as Error).message}]`;
    }
  }

  private normalizeWebhookData(
    webhookType: string,
    data: Record<string, unknown>
  ): Record<string, unknown> {
    const normalized = { ...data };

    if (webhookType === "CASINO_PRIZE" && normalized.casino_prize_value === undefined && normalized.prize_value !== undefined) {
      normalized.casino_prize_value = normalized.prize_value;
    }

    if (webhookType === "CASINO_BET" && normalized.casino_bet_value === undefined && normalized.bet_value !== undefined) {
      normalized.casino_bet_value = normalized.bet_value;
    }

    if ((webhookType === "CASINO_BET" || webhookType === "CASINO_PRIZE") && normalized.casino_game_name === undefined && normalized.game_name !== undefined) {
      normalized.casino_game_name = normalized.game_name;
    }

    if (webhookType === "CASINO_BET" && normalized.casino_bet_id === undefined && normalized.bet_id !== undefined) {
      normalized.casino_bet_id = normalized.bet_id;
    }

    return normalized;
  }

  // ── Filtros basicos (webhook data) ──────────────────────────────

  private evaluateFilters(
    filters: AlertFilter[],
    data: Record<string, unknown>
  ): boolean {
    if (filters.length === 0) return true;

    let result = this.evaluateCondition(filters[0]!, data);

    for (let i = 1; i < filters.length; i++) {
      const filter = filters[i]!;
      const prevFilter = filters[i - 1]!;
      const condResult = this.evaluateCondition(filter, data);

      if (prevFilter.logicGate === "AND") {
        result = result && condResult;
      } else if (prevFilter.logicGate === "OR") {
        result = result || condResult;
      }
    }

    return result;
  }

  private evaluateCondition(
    filter: AlertFilter,
    data: Record<string, unknown>
  ): boolean {
    const fieldValue = data[filter.field];
    if (fieldValue === undefined || fieldValue === null) return false;

    return this.compareValues(String(fieldValue), filter.operator, filter.value);
  }

  // ── ClickHouse query evaluation ─────────────────────────────────

  private async evaluateClickHouseQuery(
    config: AlertConfigFull,
    data: Record<string, unknown>
  ): Promise<{ passed: boolean; row: Record<string, string> | null }> {
    try {
      const query = this.interpolateQuery(config.clickhouseQuery!, data);

      const resultSet = await this.clickhouse!.query({
        query,
        format: "JSONEachRow",
      });
      const rows = await resultSet.json<Record<string, string>>();

      if (rows.length === 0) {
        return { passed: false, row: null };
      }

      const row = rows[0]!;
      const passed = this.evaluateQueryConditions(config.queryConditions, row);
      return { passed, row };
    } catch (err: any) {
      console.error(`[AlertEngine] ClickHouse query failed for config ${config.id}: ${err.message}`);
      return { passed: false, row: null };
    }
  }

  private interpolateQuery(
    template: string,
    data: Record<string, unknown>
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = data[key];
      if (value === undefined || value === null) return "";
      return String(value).replace(/'/g, "\\'");
    });
  }

  private evaluateQueryConditions(
    conditions: AlertQueryCondition[],
    row: Record<string, string>
  ): boolean {
    if (conditions.length === 0) return true;

    let result = this.evaluateQueryCondition(conditions[0]!, row);

    for (let i = 1; i < conditions.length; i++) {
      const condition = conditions[i]!;
      const prevCondition = conditions[i - 1]!;
      const condResult = this.evaluateQueryCondition(condition, row);

      if (prevCondition.logicGate === "AND") {
        result = result && condResult;
      } else if (prevCondition.logicGate === "OR") {
        result = result || condResult;
      }
    }

    return result;
  }

  private evaluateQueryCondition(
    condition: AlertQueryCondition,
    row: Record<string, string>
  ): boolean {
    const fieldValue = row[condition.field];
    if (fieldValue === undefined) return false;

    return this.compareValues(fieldValue, condition.operator, condition.value);
  }

  // ── Comparador unificado ────────────────────────────────────────

  private compareValues(
    fieldValue: string,
    operator: string,
    targetValue: string
  ): boolean {
    const numericValue = Number(fieldValue);
    const targetNumeric = Number(targetValue);
    const isNumeric = !isNaN(numericValue) && !isNaN(targetNumeric);

    switch (operator) {
      case "EQUAL":
        return String(fieldValue) === targetValue;
      case "NOT_EQUAL":
        return String(fieldValue) !== targetValue;
      case "GREATER":
        return isNumeric && numericValue > targetNumeric;
      case "GREATER_EQUAL":
        return isNumeric && numericValue >= targetNumeric;
      case "LESS":
        return isNumeric && numericValue < targetNumeric;
      case "LESS_EQUAL":
        return isNumeric && numericValue <= targetNumeric;
      default:
        return false;
    }
  }

  // ── Acoes ──────────────────────────────────────────────────────

  private async executeActions(
    config: AlertConfigFull,
    data: Record<string, unknown>
  ): Promise<void> {
    const selectedData = this.extractSelectedFields(
      config.selectedFields as string[],
      data
    );

    const title = `Alerta: ${config.name}`;
    const message = this.formatMessage(config, selectedData, data._queryResult as Record<string, string> | undefined);

    const isWatch = config.mode === "WATCH";

    // 1) Criar alerta no banco (sempre)
    const alert = await this.createPanelAlert(config, title, message, data, isWatch);

    // 2) Criar task vinculada ao alerta (se configurado e nao WATCH)
    let taskId: string | null = null;
    if (!isWatch && config.createPanelTask) {
      taskId = await this.createPanelTask(config, title, message, data, alert.id);
    }

    // 3) Emitir SSE com taskId (para o botao "Iniciar Analise")
    if (!isWatch) {
      eventBus.emit("panel-alert", { ...alert, taskId });
    }

    // 4) Acoes paralelas (chat, clickup, webhook externo)
    const promises: Promise<void>[] = [];
    if (!isWatch) {
      if (config.publishChat && config.chatWebhookUrl) {
        promises.push(this.sendToGoogleChat(config.chatWebhookUrl, title, message));
      }
      if (config.createClickupTask && config.clickupListId) {
        promises.push(this.createClickupTask(config.clickupListId, title, message));
      }
      if (config.externalWebhookUrl) {
        promises.push(this.sendToExternalWebhook(config.externalWebhookUrl, config, title, message, data));
      }
    }
    if (promises.length > 0) {
      const results = await Promise.allSettled(promises);
      const rejected = results.filter((result) => result.status === "rejected");
      if (rejected.length > 0) {
        console.error(`[AlertEngine] Config "${config.name}" (${config.id}): ${rejected.length} acao(oes) paralela(s) falharam`);
      }
    }

    await this.prisma.log.create({
      data: {
        action: "alert.triggered",
        entity: "alert",
        entityId: config.id,
        details: {
          webhookType: config.webhookType,
          publishPanel: config.publishPanel,
          publishChat: config.publishChat,
          createPanelTask: config.createPanelTask,
          createClickupTask: config.createClickupTask,
          queryEnabled: config.queryEnabled,
        } as Prisma.InputJsonValue,
      },
    });
  }

  private extractSelectedFields(
    fields: string[],
    data: Record<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const field of fields) {
      if (data[field] !== undefined) {
        result[field] = data[field];
      }
    }
    return result;
  }

  private formatMessage(
    config: AlertConfigFull,
    data: Record<string, unknown>,
    queryResult?: Record<string, string>
  ): string {
    const lines = [`*${config.name}*`, ""];
    for (const [key, value] of Object.entries(data)) {
      if (key === "_queryResult") continue;
      lines.push(`${key}: ${value}`);
    }
    if (queryResult) {
      lines.push("", "*Dados da consulta:*");
      for (const [key, value] of Object.entries(queryResult)) {
        lines.push(`${key}: ${value}`);
      }
    }
    return lines.join("\n");
  }

  private async createPanelAlert(
    config: AlertConfig,
    title: string,
    message: string,
    data: Record<string, unknown>,
    isWatch: boolean = false
  ) {
    const alert = await this.prisma.panelAlert.create({
      data: {
        alertConfigId: config.id,
        webhookType: config.webhookType,
        title,
        message,
        data: data as Prisma.InputJsonValue,
        mode: isWatch ? "WATCH" : "ALERT",
      },
      include: {
        alertConfig: { select: { name: true } },
      },
    });
    return alert;
  }

  private async sendToGoogleChat(
    webhookUrl: string,
    title: string,
    message: string
  ): Promise<void> {
    try {
      await axios.post(webhookUrl, { text: `*${title}*\n${message}` });
    } catch (err: any) {
      console.error(`[AlertEngine] Google Chat failed for ${webhookUrl}: ${err.message}`, err.response?.data ?? "");
      throw err;
    }
  }

  private async sendToExternalWebhook(
    webhookUrl: string,
    config: AlertConfig,
    title: string,
    message: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      await axios.post(webhookUrl, {
        alert: title,
        config: { id: config.id, name: config.name, webhookType: config.webhookType },
        message,
        data,
        timestamp: new Date().toISOString(),
      }, { timeout: 10000 });
    } catch (err: any) {
      console.error(`[AlertEngine] External webhook failed for ${config.id}: ${err.message}`, err.response?.data ?? "");
      throw err;
    }
  }

  private async createPanelTask(
    config: AlertConfig,
    title: string,
    _message: string,
    data: Record<string, unknown>,
    panelAlertId: string
  ): Promise<string> {
    type RawItem = string | { type?: string; label: string };
    const checklistRaw = (config.checklist as RawItem[]) || [];
    const checklist = checklistRaw.map((item) => {
      const label = typeof item === "string" ? item : item.label;
      const type = typeof item === "string" ? "check" : (item.type ?? "check");
      return { label, type, checked: type === "text" };
    });

    const task = await this.prisma.panelTask.create({
      data: {
        alertConfigId: config.id,
        panelAlertId,
        title,
        description: `Alerta disparado: ${config.name}`,
        data: data as Prisma.InputJsonValue,
        priority: 2,
        checklist,
      },
    });
    return task.id;
  }

  private async createClickupTask(
    listId: string,
    title: string,
    message: string
  ): Promise<void> {
    const token = process.env.CLICKUP_API_TOKEN;
    if (!token) return;

    try {
      await axios.post(
        `https://api.clickup.com/api/v2/list/${listId}/task`,
        { name: title, description: message, priority: 2 },
        { headers: { Authorization: token } }
      );
    } catch (err: any) {
      console.error(`[AlertEngine] ClickUp failed for list ${listId}: ${err.message}`, err.response?.data ?? "");
      throw err;
    }
  }
}
