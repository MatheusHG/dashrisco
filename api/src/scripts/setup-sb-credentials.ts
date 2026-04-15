/**
 * setup-sb-credentials.ts
 *
 * Script de configuração única — roda UMA VEZ na VPS para criptografar e
 * armazenar as credenciais da conta SB API no banco de dados.
 *
 * Pré-requisito:
 *   SB_CREDENTIALS_KEY deve estar definida no ambiente antes de rodar.
 *   Gere a chave com:
 *     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   E adicione ao systemd/PM2 ecosystem da VPS (NUNCA no .env commitado).
 *
 * Como rodar na VPS:
 *   SB_CREDENTIALS_KEY=<sua_chave> npx ts-node src/scripts/setup-sb-credentials.ts
 */

import * as readline from "readline";
import * as path from "path";

// Carregar .env se existir
try {
  require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
} catch {}

import { PrismaClient } from "@prisma/client";
import { encrypt } from "../services/credentialVault";

const prisma = new PrismaClient();

function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (hidden) {
      // Oculta a entrada no terminal (para senha)
      process.stdout.write(question);
      process.stdin.setRawMode?.(true);
      let input = "";
      process.stdin.resume();
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", function handler(char) {
        const c = char.toString();
        if (c === "\n" || c === "\r" || c === "\u0003") {
          process.stdin.setRawMode?.(false);
          process.stdin.removeListener("data", handler);
          process.stdout.write("\n");
          rl.close();
          resolve(input);
        } else if (c === "\u007f") {
          input = input.slice(0, -1);
        } else {
          input += c;
          process.stdout.write("*");
        }
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

async function main() {
  console.log("\n=== Setup de Credenciais SB API ===");
  console.log("As credenciais serão criptografadas (AES-256-GCM) e salvas no banco.\n");

  // Verificar que a chave de criptografia está definida
  if (!process.env.SB_CREDENTIALS_KEY || process.env.SB_CREDENTIALS_KEY.length !== 64) {
    console.error("ERRO: SB_CREDENTIALS_KEY não definida ou inválida.");
    console.error(
      'Gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
    process.exit(1);
  }

  const username = await prompt("Username da conta admin (ex: tecnologia.wpp): ");
  const password = await prompt("Senha: ", true);
  const totpSecret = await prompt("TOTP Secret (string base32 do QR code): ");

  if (!username || !password || !totpSecret) {
    console.error("\nERRO: Todos os campos são obrigatórios.");
    process.exit(1);
  }

  console.log("\nCriptografando e salvando...");

  const entries = [
    { key: "SB_ADMIN_USERNAME_ENC", value: encrypt(username), label: "Username admin SB (enc)" },
    { key: "SB_ADMIN_PASSWORD_ENC", value: encrypt(password), label: "Senha admin SB (enc)" },
    { key: "SB_TOTP_SECRET_ENC", value: encrypt(totpSecret), label: "TOTP secret SB (enc)" },
  ];

  for (const entry of entries) {
    await prisma.appConfig.upsert({
      where: { key: entry.key },
      update: { value: entry.value, label: entry.label },
      create: { key: entry.key, value: entry.value, label: entry.label },
    });
    console.log(`  ✓ ${entry.key}`);
  }

  console.log("\nCredenciais configuradas com sucesso!");
  console.log("O sistema agora pode renovar o token automaticamente quando expirar.\n");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("\nErro:", err.message);
  process.exit(1);
});
