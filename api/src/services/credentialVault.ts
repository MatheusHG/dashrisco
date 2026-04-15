/**
 * credentialVault.ts
 *
 * Criptografa/descriptografa strings sensíveis (senhas, TOTP secrets) usando
 * AES-256-GCM com uma chave master que fica APENAS na variável de ambiente —
 * nunca commitada no repositório nem armazenada no banco.
 *
 * Variável obrigatória na VPS:
 *   SB_CREDENTIALS_KEY  — 64 chars hex (32 bytes), gerada uma vez com:
 *     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Formato do ciphertext armazenado no app_configs:
 *   <iv_hex>:<authTag_hex>:<ciphertext_hex>
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const KEY_ENV = "SB_CREDENTIALS_KEY";

function getMasterKey(): Buffer {
  const hex = process.env[KEY_ENV];
  if (!hex || hex.length !== 64) {
    throw new Error(
      `${KEY_ENV} deve ser uma string hex de 64 caracteres (32 bytes). ` +
        `Gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(12); // 96-bit IV recomendado para GCM
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decrypt(stored: string): string {
  const key = getMasterKey();
  const parts = stored.split(":");
  if (parts.length !== 3) throw new Error("Formato de ciphertext inválido no vault");
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
