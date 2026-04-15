/**
 * tokenManager.ts
 *
 * Gerencia a renovação automática do SB_API_TOKEN via login com TOTP.
 *
 * Fluxo:
 *   1. sbClient recebe 401
 *   2. Chama tokenManager.refreshToken(prisma)
 *   3. TokenManager descriptografa credenciais do vault
 *   4. Gera código TOTP com otplib
 *   5. POST /login → extrai Bearer do header Authorization da resposta
 *   6. Salva novo token em app_configs e invalida cache do sbClient
 *   7. sbClient repete a requisição original com o novo token
 *
 * Proteções:
 *   - Deduplicação: múltiplos 401 simultâneos aguardam a mesma Promise de login
 *   - Circuit breaker: para de tentar após MAX_FAILURES falhas consecutivas
 */

import axios from "axios";
import { Agent as HttpsAgent } from "https";
import { generate as totpGenerate } from "otplib";
import { PrismaClient } from "@prisma/client";
import { decrypt } from "./credentialVault";
import { invalidateSbCache } from "./sbClient";

// Força IPv4 no login — a VPS usa IPv6 por padrão mas a NGX só aceita IPv4.
const ipv4HttpsAgent = new HttpsAgent({ family: 4 });

const LOGIN_URL = process.env.SB_LOGIN_URL || "https://loterias-dashboard.ngx.bet/login";
const MAX_FAILURES = 3;

class TokenManager {
  private _loginInProgress: Promise<string> | null = null;
  private _failureCount = 0;

  /**
   * Renova o token. Chamadas simultâneas recebem a mesma Promise (sem login duplo).
   */
  async refreshToken(prisma: PrismaClient): Promise<string> {
    if (this._loginInProgress) {
      return this._loginInProgress;
    }

    if (this._failureCount >= MAX_FAILURES) {
      throw new Error(
        `TokenManager: circuit breaker aberto após ${MAX_FAILURES} falhas consecutivas de login. ` +
          `Verifique as credenciais ou execute setup-sb-credentials novamente.`
      );
    }

    this._loginInProgress = this._performLogin(prisma)
      .then((token) => {
        this._failureCount = 0;
        return token;
      })
      .catch((err) => {
        this._failureCount++;
        throw err;
      })
      .finally(() => {
        this._loginInProgress = null;
      });

    return this._loginInProgress;
  }

  /** Reseta o circuit breaker manualmente (útil após corrigir credenciais). */
  resetCircuitBreaker() {
    this._failureCount = 0;
  }

  private async _performLogin(prisma: PrismaClient): Promise<string> {
    // 1. Buscar credenciais criptografadas no banco
    const rows = await prisma.appConfig.findMany({
      where: { key: { in: ["SB_ADMIN_USERNAME_ENC", "SB_ADMIN_PASSWORD_ENC", "SB_TOTP_SECRET_ENC"] } },
    });

    const map = new Map(rows.map((r) => [r.key, r.value]));
    const usernameEnc = map.get("SB_ADMIN_USERNAME_ENC");
    const passwordEnc = map.get("SB_ADMIN_PASSWORD_ENC");
    const totpSecretEnc = map.get("SB_TOTP_SECRET_ENC");

    if (!usernameEnc || !passwordEnc || !totpSecretEnc) {
      throw new Error(
        "Credenciais SB não configuradas. Execute: npx ts-node src/scripts/setup-sb-credentials.ts"
      );
    }

    // 2. Descriptografar
    const username = decrypt(usernameEnc);
    const password = decrypt(passwordEnc);
    const totpSecret = decrypt(totpSecretEnc);

    // 3. Gerar código TOTP atual
    const authCode = await totpGenerate({ secret: totpSecret });

    // 4. Fazer login (Referer/Origin identificam a empresa no backend multi-tenant)
    const response = await axios.post(
      LOGIN_URL,
      { username, password, auth_code: authCode, useBonus: null, source: "MOBILE" },
      {
        httpsAgent: ipv4HttpsAgent,
        headers: {
          "Content-Type": "application/json",
          "Referer": "https://dashboard.marjosports.com.br/",
          "Origin": "https://dashboard.marjosports.com.br",
        },
      }
    );

    // 5. Extrair token do header Authorization da resposta
    const token = response.headers["authorization"] as string | undefined;
    if (!token) {
      throw new Error("Login realizado mas header Authorization ausente na resposta");
    }

    // 6. Persistir novo token no banco
    await prisma.appConfig.upsert({
      where: { key: "SB_API_TOKEN" },
      update: { value: token },
      create: { key: "SB_API_TOKEN", value: token, label: "Token de autenticação SB API" },
    });

    // 7. Limpar cache para forçar releitura na próxima chamada
    invalidateSbCache();

    return token;
  }
}

export const tokenManager = new TokenManager();
