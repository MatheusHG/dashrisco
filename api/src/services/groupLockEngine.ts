import { PrismaClient, Prisma } from "@prisma/client";
import axios from "axios";
import { eventBus } from "./eventBus";
import { getUser, updateUserLocks, UserLocks, FULL_LOCK } from "./sbClient";

interface TriggerFilter {
  field: string;
  operator: "EQUAL" | "GREATER" | "LESS";
  value: string;
  logicGate?: "AND" | "OR" | null;
}

interface TimeSlot {
  startHour: number; // 0-23
  endHour: number;   // 1-24 (24 = midnight next day)
  lockSeconds: number;
}

/**
 * Resolve o lockSeconds baseado na hora atual e nos timeSlots configurados.
 * Se nenhum slot bater, usa o fallback (lockSeconds do grupo).
 */
function resolveLockSeconds(timeSlots: unknown, fallback: number): number {
  if (!Array.isArray(timeSlots) || timeSlots.length === 0) return fallback;

  const now = new Date();
  const currentHour = now.getHours();

  for (const slot of timeSlots as TimeSlot[]) {
    if (
      typeof slot.startHour === "number" &&
      typeof slot.endHour === "number" &&
      typeof slot.lockSeconds === "number" &&
      currentHour >= slot.startHour &&
      currentHour < slot.endHour
    ) {
      return slot.lockSeconds;
    }
  }

  return fallback;
}

interface ActiveSession {
  groupId: string;
  groupName: string;
  triggerUserId: string;
  triggerUserName: string;
  snapshot: Map<string, UserLocks>;
  timer: NodeJS.Timeout;
  lockedAt: Date;
  unlockAt: Date;
}


/**
 * Motor de bloqueio automático de grupos.
 * Quando um membro de um grupo aposta, bloqueia todos os membros
 * por X segundos e desbloqueia automaticamente.
 */
export class GroupLockEngine {
  private activeSessions = new Map<string, ActiveSession>();

  constructor(private prisma: PrismaClient) {}

  /**
   * Processa um webhook de aposta.
   * Verifica se o user_id está em algum grupo de bloqueio ativo
   * e se as condições de trigger são satisfeitas.
   */
  async processBet(
    webhookType: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const userId = data.user_id as string;
    const userName = (data.user_name as string) || "Desconhecido";
    if (!userId) {
      console.log(`[GroupLock] processBet: user_id ausente no webhook, ignorando.`);
      return;
    }

    console.log(`[GroupLock] processBet: type=${webhookType}, user_id="${userId}", user_name="${userName}"`);

    // Buscar grupos ativos que contêm este usuário
    const memberships = await this.prisma.lockGroupMember.findMany({
      where: {
        ngxUserId: userId,
        group: { active: true },
      },
      include: {
        group: { include: { members: true } },
      },
    });

    if (memberships.length === 0) {
      console.log(`[GroupLock] user_id="${userId}" nao pertence a nenhum grupo ativo.`);
      return;
    }

    console.log(`[GroupLock] user_id="${userId}" encontrado em ${memberships.length} grupo(s): ${memberships.map(m => `"${m.group.name}"`).join(", ")}`);

    for (const membership of memberships) {
      const group = membership.group;

      // 1) Verificar se o tipo de aposta está nos tipos configurados
      const triggerTypes = (group.triggerTypes as unknown as string[]) || [
        "SPORT_BET",
        "CASINO_BET",
      ];
      if (!triggerTypes.includes(webhookType)) {
        console.log(
          `[GroupLock] Grupo "${group.name}": tipo ${webhookType} nao esta nos triggers [${triggerTypes.join(", ")}], ignorando.`
        );
        continue;
      }

      // 2) Verificar filtros/condições
      const triggerFilters = (group.triggerFilters as unknown as TriggerFilter[]) || [];
      console.log(`[GroupLock] Grupo "${group.name}": ${triggerFilters.length} filtros configurados.`);
      if (triggerFilters.length > 0) {
        const filtersResult = this.evaluateFilters(triggerFilters, data);
        if (!filtersResult) {
          console.log(
            `[GroupLock] Grupo "${group.name}": condicoes NAO satisfeitas. Filtros: ${JSON.stringify(triggerFilters.map(f => ({ field: f.field, op: f.operator, val: f.value, dataVal: data[f.field] })))}`
          );
          continue;
        }
        console.log(`[GroupLock] Grupo "${group.name}": condicoes OK`);
      } else {
        console.log(`[GroupLock] Grupo "${group.name}": sem filtros (qualquer aposta ativa o bloqueio)`);
      }

      // Resolve lock duration based on current hour
      const effectiveLockSeconds = resolveLockSeconds(
        (group as any).timeSlots,
        group.lockSeconds
      );

      // 3) Se há sessão ativa, renovar timer (sliding window)
      const existing = this.activeSessions.get(group.id);
      if (existing) {
        clearTimeout(existing.timer);
        existing.timer = setTimeout(
          () => this.unlockGroup(group.id),
          effectiveLockSeconds * 1000
        );
        existing.unlockAt = new Date(Date.now() + effectiveLockSeconds * 1000);
        console.log(
          `[GroupLock] Grupo "${group.name}": timer renovado (trigger: ${userId}). Restore em ${effectiveLockSeconds}s.`
        );
        continue;
      }

      // 4) Nova sessão: bloquear todos os membros
      await this.lockGroup({ ...group, lockSeconds: effectiveLockSeconds }, userId, userName, data);
    }
  }

  /**
   * Avalia filtros de trigger contra os dados do webhook.
   */
  private evaluateFilters(
    filters: TriggerFilter[],
    data: Record<string, unknown>
  ): boolean {
    if (filters.length === 0) return true;

    let result = this.evaluateCondition(filters[0]!, data);

    for (let i = 1; i < filters.length; i++) {
      const filter = filters[i]!;
      const prevFilter = filters[i - 1]!;
      const condResult = this.evaluateCondition(filter, data);

      if (prevFilter.logicGate === "OR") {
        result = result || condResult;
      } else {
        // AND by default
        result = result && condResult;
      }
    }

    return result;
  }

  private evaluateCondition(
    filter: TriggerFilter,
    data: Record<string, unknown>
  ): boolean {
    const fieldValue = data[filter.field];
    if (fieldValue === undefined || fieldValue === null) return false;

    const numericValue = Number(fieldValue);
    const filterNumeric = Number(filter.value);
    const isNumeric = !isNaN(numericValue) && !isNaN(filterNumeric);

    switch (filter.operator) {
      case "EQUAL":
        return String(fieldValue) === filter.value;
      case "GREATER":
        return isNumeric && numericValue > filterNumeric;
      case "LESS":
        return isNumeric && numericValue < filterNumeric;
      default:
        return false;
    }
  }

  /**
   * Bloqueia todos os membros de um grupo.
   */
  private async lockGroup(
    group: {
      id: string;
      name: string;
      lockSeconds: number;
      notifyPanel: boolean;
      notifyChat: boolean;
      chatWebhookUrl: string | null;
      members: Array<{ ngxUserId: string; ngxName: string | null }>;
    },
    triggerUserId: string,
    triggerUserName: string,
    betData: Record<string, unknown>
  ): Promise<void> {
    console.log(
      `[GroupLock] Grupo "${group.name}": bloqueando ${group.members.length} membros (trigger: ${triggerUserId})`
    );

    const snapshot = new Map<string, UserLocks>();
    const lockedUsers: string[] = [];
    const failedUsers: string[] = [];

    // 1) Capturar snapshot e aplicar lock em cada membro
    for (const member of group.members) {
      try {
        const user = await getUser(this.prisma, member.ngxUserId);
        snapshot.set(member.ngxUserId, { ...user.locks });
        await updateUserLocks(this.prisma, member.ngxUserId, {
          ...user.locks,
          ...FULL_LOCK,
        });
        lockedUsers.push(member.ngxUserId);
      } catch (err: any) {
        failedUsers.push(member.ngxUserId);
        console.error(
          `[GroupLock] Erro ao bloquear ${member.ngxUserId}: ${err.message}`
        );
      }
    }

    // 2) Agendar desbloqueio automático
    const timer = setTimeout(
      () => this.unlockGroup(group.id),
      group.lockSeconds * 1000
    );

    this.activeSessions.set(group.id, {
      groupId: group.id,
      groupName: group.name,
      triggerUserId,
      triggerUserName,
      snapshot,
      timer,
      lockedAt: new Date(),
      unlockAt: new Date(Date.now() + group.lockSeconds * 1000),
    });

    // 3) Registrar evento no banco (com dados da aposta)
    await this.prisma.lockGroupEvent.create({
      data: {
        groupId: group.id,
        action: "locked",
        userName: `Sistema (aposta de ${triggerUserName})`,
        reason: `Aposta detectada do usuario ${triggerUserName} (${triggerUserId}). Bloqueio automatico por ${group.lockSeconds}s.`,
        data: betData as Prisma.InputJsonValue,
      },
    });

    // 4) Notificar no Painel
    if (group.notifyPanel) {
      try {
        const betValue = betData.bet_value
          ? `R$ ${Number(betData.bet_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
          : "";

        const panelAlert = await this.prisma.panelAlert.create({
          data: {
            webhookType: (betData.type as string) || "SPORT_BET",
            title: `Grupo "${group.name}" bloqueado`,
            message: `${triggerUserName} apostou ${betValue} e bloqueou o grupo "${group.name}". ${lockedUsers.length} usuarios travados por ${group.lockSeconds}s.`,
            data: betData as Prisma.InputJsonValue,
            source: "group_lock",
          },
          include: { alertConfig: { select: { name: true } } },
        });
        eventBus.emit("panel-alert", panelAlert);
      } catch (err: any) {
        console.error(`[GroupLock] Erro ao criar PanelAlert: ${err.message}`);
      }
    }

    // 5) Notificar no Google Chat
    if (group.notifyChat && group.chatWebhookUrl) {
      try {
        const betValue = betData.bet_value
          ? `R$ ${Number(betData.bet_value).toFixed(2)}`
          : "N/A";

        const membersStr = lockedUsers.join(", ");
        const message =
          `*Grupo "${group.name}" bloqueado automaticamente*\n\n` +
          `*Jogador:* ${triggerUserName} (${triggerUserId})\n` +
          `*Aposta:* ${betValue}\n` +
          `*Membros bloqueados (${lockedUsers.length}):* ${membersStr}\n` +
          `*Desbloqueio automatico em:* ${group.lockSeconds}s\n` +
          (failedUsers.length > 0
            ? `\n*Falhas (${failedUsers.length}):* ${failedUsers.join(", ")}`
            : "");

        await axios.post(group.chatWebhookUrl, { text: message });
      } catch (err: any) {
        console.error(`[GroupLock] Erro ao enviar chat: ${err.message}`);
      }
    }

    console.log(
      `[GroupLock] Grupo "${group.name}": ${lockedUsers.length} bloqueados, ${failedUsers.length} falharam. Desbloqueio em ${group.lockSeconds}s.`
    );
  }

  /**
   * Desbloqueia um grupo (chamado pelo timer automático ou manualmente).
   */
  async unlockGroup(groupId: string): Promise<void> {
    const session = this.activeSessions.get(groupId);
    if (!session) return;

    console.log(
      `[GroupLock] Grupo "${session.groupName}": desbloqueando ${session.snapshot.size} membros`
    );

    clearTimeout(session.timer);

    const restoredUsers: string[] = [];
    const failedUsers: string[] = [];

    // Restaurar locks originais
    for (const [userId, originalLocks] of session.snapshot) {
      try {
        await updateUserLocks(this.prisma, userId, originalLocks);
        restoredUsers.push(userId);
      } catch (err: any) {
        failedUsers.push(userId);
        console.error(
          `[GroupLock] Erro ao desbloquear ${userId}: ${err.message}`
        );
      }
    }

    // Registrar evento
    const elapsedMs = Date.now() - session.lockedAt.getTime();
    const elapsedSec = Math.round(elapsedMs / 1000);

    await this.prisma.lockGroupEvent.create({
      data: {
        groupId,
        action: "unlocked",
        userName: "Sistema (automatico)",
        reason: `Desbloqueio automatico apos ${elapsedSec}s. ${restoredUsers.length} usuarios restaurados.`,
      },
    });

    // Notificar
    const group = await this.prisma.lockGroup.findUnique({
      where: { id: groupId },
    });

    // Painel
    if (group?.notifyPanel) {
      try {
        const panelAlert = await this.prisma.panelAlert.create({
          data: {
            webhookType: "SPORT_BET",
            title: `Grupo "${session.groupName}" desbloqueado`,
            message: `Desbloqueio automatico apos ${elapsedSec}s. ${restoredUsers.length} usuarios restaurados.`,
            data: {
              groupId,
              groupName: session.groupName,
              triggerUserId: session.triggerUserId,
              triggerUserName: session.triggerUserName,
              restoredUsers,
              failedUsers,
              elapsedSec,
            } as any,
            source: "group_lock",
          },
          include: { alertConfig: { select: { name: true } } },
        });
        eventBus.emit("panel-alert", panelAlert);
      } catch (err: any) {
        console.error(`[GroupLock] Erro ao criar PanelAlert unlock: ${err.message}`);
      }
    }

    // Google Chat
    if (group?.notifyChat && group.chatWebhookUrl) {
      try {
        const message =
          `*Grupo "${session.groupName}" desbloqueado*\n\n` +
          `Desbloqueio automatico apos ${elapsedSec}s.\n` +
          `*Usuarios restaurados (${restoredUsers.length}):* ${restoredUsers.join(", ")}` +
          (failedUsers.length > 0
            ? `\n*Falhas (${failedUsers.length}):* ${failedUsers.join(", ")}`
            : "");

        await axios.post(group.chatWebhookUrl, { text: message });
      } catch (err: any) {
        console.error(`[GroupLock] Erro ao enviar chat unlock: ${err.message}`);
      }
    }

    this.activeSessions.delete(groupId);
    console.log(
      `[GroupLock] Grupo "${session.groupName}": sessao encerrada. ${restoredUsers.length} restaurados.`
    );
  }

  /**
   * Desbloqueia manualmente (chamado pela rota PUT).
   * Cancela o timer e restaura locks.
   */
  async manualUnlock(groupId: string): Promise<void> {
    await this.unlockGroup(groupId);
  }

  /**
   * Verifica se um grupo está com sessão ativa de bloqueio.
   */
  isLocked(groupId: string): boolean {
    return this.activeSessions.has(groupId);
  }

  getSession(groupId: string): ActiveSession | undefined {
    return this.activeSessions.get(groupId);
  }
}
