import { PrismaClient, Prisma, AlertConfig, AlertFilter, AlertQueryCondition } from "@prisma/client";
import axios from "axios";
import { eventBus } from "./eventBus";
import type { ClickHouseClient } from "@clickhouse/client";

type AlertConfigFull = AlertConfig & {
  filters: AlertFilter[];
  queryConditions: AlertQueryCondition[];
};

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

    console.log(`[AlertEngine] processWebhook type=${webhookType}, configs encontradas: ${configs.length}, user_id=${data.user_id}`);

    for (const config of configs) {
      // 1) Filtros basicos no webhook data
      const filtersOk = this.evaluateFilters(config.filters, data);
      if (!filtersOk) {
        console.log(`[AlertEngine] Config "${config.name}" (${config.id}): filtros NAO passaram. Filters: ${JSON.stringify(config.filters.map(f => ({ field: f.field, op: f.operator, value: f.value, dataValue: data[f.field] })))}`);
        continue;
      }
      console.log(`[AlertEngine] Config "${config.name}" (${config.id}): filtros OK`);

      // 2) Query ClickHouse (se habilitada)
      let queryResult: Record<string, string> | null = null;
      if (config.queryEnabled && config.clickhouseQuery && this.clickhouse) {
        const result = await this.evaluateClickHouseQuery(config, data);
        if (!result.passed) {
          console.log(`[AlertEngine] Config "${config.name}" (${config.id}): query ClickHouse NAO passou`);
          continue;
        }
        console.log(`[AlertEngine] Config "${config.name}" (${config.id}): query ClickHouse OK`);
        queryResult = result.row;
      }

      // 3) Executar acoes
      console.log(`[AlertEngine] Config "${config.name}" (${config.id}): executando acoes`);
      const enrichedData = queryResult
        ? { ...data, _queryResult: queryResult }
        : data;
      await this.executeActions(config, enrichedData);
    }
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

    const promises: Promise<void>[] = [];

    promises.push(this.createPanelAlert(config, title, message, data));

    if (config.publishChat && config.chatWebhookUrl) {
      promises.push(this.sendToGoogleChat(config.chatWebhookUrl, title, message));
    }

    if (config.createPanelTask) {
      promises.push(this.createPanelTask(config, title, message, data));
    }

    if (config.createClickupTask && config.clickupListId) {
      promises.push(this.createClickupTask(config.clickupListId, title, message));
    }

    await Promise.allSettled(promises);

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
    data: Record<string, unknown>
  ): Promise<void> {
    const alert = await this.prisma.panelAlert.create({
      data: {
        alertConfigId: config.id,
        webhookType: config.webhookType,
        title,
        message,
        data: data as Prisma.InputJsonValue,
      },
      include: {
        alertConfig: { select: { name: true } },
      },
    });

    eventBus.emit("panel-alert", alert);
  }

  private async sendToGoogleChat(
    webhookUrl: string,
    title: string,
    message: string
  ): Promise<void> {
    await axios.post(webhookUrl, { text: `*${title}*\n${message}` });
  }

  private async createPanelTask(
    config: AlertConfig,
    title: string,
    _message: string,
    data: Record<string, unknown>
  ): Promise<void> {
    await this.prisma.panelTask.create({
      data: {
        alertConfigId: config.id,
        title,
        description: `Alerta disparado: ${config.name}`,
        data: data as Prisma.InputJsonValue,
        priority: 2,
      },
    });
  }

  private async createClickupTask(
    listId: string,
    title: string,
    message: string
  ): Promise<void> {
    const token = process.env.CLICKUP_API_TOKEN;
    if (!token) return;

    await axios.post(
      `https://api.clickup.com/api/v2/list/${listId}/task`,
      { name: title, description: message, priority: 2 },
      { headers: { Authorization: token } }
    );
  }
}
