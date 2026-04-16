import { PrismaClient, Prisma } from "@prisma/client";
import axios from "axios";
import { eventBus } from "./eventBus";
import { getUser, updateUserLocks, UserLocks, FULL_LOCK } from "./sbClient";
import { tokenManager } from "./tokenManager";

// Locks zerados — usado como fallback no desbloqueio quando snapshot está vazio
const UNLOCK_ALL: UserLocks = {
  bet: false,
  bonus_bet: false,
  casino_bet: false,
  deposit: false,
  withdraw: false,
  esport_bet: false,
};

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
    if (!userId) return;

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

    if (memberships.length === 0) return;

    for (const membership of memberships) {
      const group = membership.group;

      // 1) Verificar se o tipo de aposta está nos tipos configurados
      const triggerTypes = (group.triggerTypes as unknown as string[]) || [
        "SPORT_BET",
        "CASINO_BET",
      ];
      if (!triggerTypes.includes(webhookType)) {
        continue;
      }

      // 2) Verificar filtros/condições
      const triggerFilters = (group.triggerFilters as unknown as TriggerFilter[]) || [];
      if (triggerFilters.length > 0) {
        const filtersResult = this.evaluateFilters(triggerFilters, data);
        if (!filtersResult) {
          continue;
        }
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
    const snapshot = new Map<string, UserLocks>();
    const lockedUsers: string[] = [];
    const failedUsers: string[] = [];

    // 1) Gerar UM auth_code TOTP para todos os membros.
    //    Isso evita problemas de replay protection (mesmo código rejeitado na 2ª chamada)
    //    e reduz latência ao processar em paralelo.
    const auth_code = await tokenManager.generateTotpCode(this.prisma);

    // 2) Capturar snapshot e aplicar lock em todos os membros em paralelo
    const lockResults = await Promise.allSettled(
      group.members.map(async (member) => {
        const user = await getUser(this.prisma, member.ngxUserId);
        await updateUserLocks(this.prisma, member.ngxUserId, { ...user.locks, ...FULL_LOCK }, auth_code);
        return { userId: member.ngxUserId, originalLocks: { ...user.locks } };
      })
    );

    lockResults.forEach((result, i) => {
      if (result.status === "fulfilled") {
        snapshot.set(result.value.userId, result.value.originalLocks);
        lockedUsers.push(result.value.userId);
      } else {
        const userId = group.members[i]!.ngxUserId;
        failedUsers.push(userId);
        console.error(`[GroupLock] Erro ao bloquear ${userId}: ${result.reason?.message}`);
      }
    });

    // 3) Abortar se nenhum membro foi bloqueado (evita sessão e unlock espúrios)
    if (lockedUsers.length === 0) {
      console.warn(
        `[GroupLock] Nenhum usuario bloqueado em "${group.name}" — sessao abortada` +
        (failedUsers.length > 0 ? ` (falhas: ${failedUsers.join(", ")})` : "")
      );
      return;
    }

    // 3) Agendar desbloqueio automático
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

  }

  /**
   * Desbloqueia um grupo (chamado pelo timer automático ou manualmente).
   */
  async unlockGroup(groupId: string): Promise<void> {
    const session = this.activeSessions.get(groupId);
    if (!session) return;

    clearTimeout(session.timer);

    const restoredUsers: string[] = [];
    const failedUsers: string[] = [];

    // Restaurar locks originais em paralelo com um único auth_code TOTP.
    // Se snapshot estiver vazio (ex: após restart do servidor), busca membros do DB
    // e usa UNLOCK_ALL como fallback para garantir que os usuários sejam desbloqueados.
    let unlockEntries: Array<[string, UserLocks]>;
    if (session.snapshot.size > 0) {
      unlockEntries = Array.from(session.snapshot.entries());
    } else {
      const members = await this.prisma.lockGroupMember.findMany({
        where: { groupId },
        select: { ngxUserId: true },
      });
      unlockEntries = members.map((m) => [m.ngxUserId, UNLOCK_ALL]);
      console.warn(`[GroupLock] Snapshot vazio para grupo ${groupId} — usando UNLOCK_ALL para ${members.length} membros`);
    }

    const auth_code = await tokenManager.generateTotpCode(this.prisma);

    const unlockResults = await Promise.allSettled(
      unlockEntries.map(async ([userId, originalLocks]) => {
        await updateUserLocks(this.prisma, userId, originalLocks, auth_code);
        return userId;
      })
    );

    unlockResults.forEach((result, i) => {
      if (result.status === "fulfilled") {
        restoredUsers.push(result.value);
      } else {
        const userId = unlockEntries[i]![0];
        failedUsers.push(userId);
        console.error(
          `[GroupLock] Erro ao desbloquear ${userId}: ${result.reason?.message}`
        );
      }
    });

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
  }

  /**
   * Desbloqueia manualmente (chamado pela rota PUT).
   * Cancela o timer e restaura locks.
   */
  async manualUnlock(groupId: string): Promise<void> {
    await this.unlockGroup(groupId);
  }

  /**
   * Registra uma sessão de bloqueio iniciada externamente (ex: rota de lock manual).
   * Assume que os membros já foram bloqueados pelo chamador.
   * Popula activeSessions e agenda o desbloqueio automático.
   */
  startSession(
    groupId: string,
    groupName: string,
    lockSeconds: number,
    triggerUserId: string,
    triggerUserName: string,
    snapshot: Map<string, UserLocks>
  ): void {
    if (this.activeSessions.has(groupId)) return; // já há sessão ativa

    const timer = setTimeout(
      () => this.unlockGroup(groupId),
      lockSeconds * 1000
    );

    this.activeSessions.set(groupId, {
      groupId,
      groupName,
      triggerUserId,
      triggerUserName,
      snapshot,
      timer,
      lockedAt: new Date(),
      unlockAt: new Date(Date.now() + lockSeconds * 1000),
    });
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

  /**
   * Reconcilia estado stale ao iniciar o servidor.
   *
   * Se o servidor reiniciou enquanto um grupo estava "locked", o timer
   * in-memory foi perdido mas o último evento no DB ainda diz "locked".
   * Isso faz a tela mostrar "Bloqueado" indefinidamente.
   *
   * Para cada grupo cujo último evento é "locked" e cujo tempo de
   * bloqueio já expirou (createdAt + lockSeconds < agora), cria um
   * evento "unlocked" de reconciliação para corrigir o estado.
   *
   * Se o bloqueio ainda não expirou, re-registra um timer para o tempo
   * restante (sem snapshot, o desbloqueio só cria o evento no DB).
   */
  async reconcileStaleState(): Promise<void> {
    const groups = await this.prisma.lockGroup.findMany({
      include: {
        events: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const now = Date.now();

    for (const group of groups) {
      const lastEvent = group.events[0];
      if (!lastEvent || lastEvent.action !== "locked") continue;

      const lockedAt = lastEvent.createdAt.getTime();
      const unlockAt = lockedAt + group.lockSeconds * 1000;

      if (now >= unlockAt) {
        // Bloqueio já expirou — reconciliar no DB
        await this.prisma.lockGroupEvent.create({
          data: {
            groupId: group.id,
            action: "unlocked",
            userName: "Sistema (reconciliação ao reiniciar)",
            reason: `Bloqueio de ${group.lockSeconds}s expirou enquanto o servidor estava offline.`,
          },
        });
        console.log(`[GroupLock] Reconciled expired lock for group "${group.name}"`);
      } else {
        // Bloqueio ainda ativo — re-registrar timer para o tempo restante
        const remainingMs = unlockAt - now;
        const timer = setTimeout(
          () => this.unlockGroup(group.id),
          remainingMs
        );
        this.activeSessions.set(group.id, {
          groupId: group.id,
          groupName: group.name,
          triggerUserId: "unknown",
          triggerUserName: "Sistema (restart)",
          snapshot: new Map(), // sem snapshot após restart
          timer,
          lockedAt: new Date(lockedAt),
          unlockAt: new Date(unlockAt),
        });
        console.log(
          `[GroupLock] Re-registered active lock for group "${group.name}", ` +
          `unlocks in ${Math.round(remainingMs / 1000)}s`
        );
      }
    }
  }
}
