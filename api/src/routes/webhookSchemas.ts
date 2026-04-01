import { FastifyInstance } from "fastify";
import { authenticate } from "../middlewares/auth";

interface FieldSchema {
  name: string;
  type: "string" | "number" | "boolean" | "date";
  example: string;
}

const withdrawalFields: FieldSchema[] = [
  { name: "user_id", type: "string", example: "676f60a451a73300284c7b30" },
  { name: "user_name", type: "string", example: "TESTE" },
  { name: "user_username", type: "string", example: "teste@teste.com" },
  { name: "user_credits", type: "number", example: "0" },
  { name: "user_birth_date", type: "date", example: "04/10/2003 00:00:00" },
  { name: "user_cpf", type: "string", example: "00000000000" },
  { name: "user_email", type: "string", example: "teste@teste.com" },
  { name: "user_contact", type: "string", example: "11983795941" },
  { name: "user_contact_country_code", type: "string", example: "55" },
  { name: "user_created_at", type: "date", example: "29/10/2025 16:43:25" },
  { name: "user_locked", type: "boolean", example: "false" },
  { name: "user_affiliated", type: "boolean", example: "false" },
  { name: "user_affiliation", type: "string", example: "" },
  { name: "user_affiliation_manager", type: "string", example: "" },
  { name: "user_locked_bet", type: "boolean", example: "false" },
  { name: "user_locked_bonus_bet", type: "boolean", example: "false" },
  { name: "user_locked_casino_bet", type: "boolean", example: "false" },
  { name: "user_locked_deposit", type: "boolean", example: "false" },
  { name: "user_locked_withdraw", type: "boolean", example: "false" },
  { name: "user_locked_esport_bet", type: "boolean", example: "false" },
  { name: "user_has_kyc", type: "boolean", example: "true" },
  { name: "user_accepted_reg_market", type: "boolean", example: "false" },
  { name: "user_accepted_notifications", type: "boolean", example: "true" },
  { name: "user_kyc_confirmed_at", type: "date", example: "25/11/2025 21:40:31" },
  { name: "withdraw_id", type: "string", example: "692743cd90533f0029ac001e" },
  { name: "withdraw_value", type: "number", example: "1000" },
  { name: "withdraw_created_at", type: "date", example: "26/11/2025 18:25:59" },
  { name: "withdraw_confirmed_at", type: "date", example: "" },
  { name: "withdraw_status", type: "string", example: "PENDING" },
  { name: "withdraw_pix_key", type: "string", example: "00000" },
  { name: "withdraw_pix_type", type: "string", example: "CPF" },
  { name: "withdraw_external_id", type: "string", example: "" },
  { name: "withdraw_guest_player", type: "boolean", example: "false" },
];

const depositFields: FieldSchema[] = [
  { name: "user_id", type: "string", example: "676f60a451a73300284c7b30" },
  { name: "user_name", type: "string", example: "TESTE" },
  { name: "user_username", type: "string", example: "teste@teste.com" },
  { name: "user_credits", type: "number", example: "500" },
  { name: "user_cpf", type: "string", example: "00000000000" },
  { name: "user_email", type: "string", example: "teste@teste.com" },
  { name: "user_contact", type: "string", example: "11983795941" },
  { name: "user_created_at", type: "date", example: "29/10/2025 16:43:25" },
  { name: "user_locked", type: "boolean", example: "false" },
  { name: "user_has_kyc", type: "boolean", example: "true" },
  { name: "deposit_id", type: "string", example: "692743cd90533f0029ac001e" },
  { name: "deposit_value", type: "number", example: "1000" },
  { name: "deposit_created_at", type: "date", example: "26/11/2025 18:25:59" },
  { name: "deposit_status", type: "string", example: "PAID" },
  { name: "deposit_method", type: "string", example: "PIX" },
];

const casinoPrizeFields: FieldSchema[] = [
  { name: "user_id", type: "string", example: "676f60a451a73300284c7b30" },
  { name: "user_name", type: "string", example: "TESTE" },
  { name: "user_username", type: "string", example: "teste@teste.com" },
  { name: "user_credits", type: "number", example: "5000" },
  { name: "user_cpf", type: "string", example: "00000000000" },
  { name: "user_email", type: "string", example: "teste@teste.com" },
  { name: "user_contact", type: "string", example: "11983795941" },
  { name: "user_locked", type: "boolean", example: "false" },
  { name: "user_has_kyc", type: "boolean", example: "true" },
  { name: "bet_id", type: "string", example: "abc123" },
  { name: "game_id", type: "string", example: "TopCard000000001" },
  { name: "game_name", type: "string", example: "Fortune Tiger" },
  { name: "game_type", type: "string", example: "LIVE" },
  { name: "prize_value", type: "number", example: "5000" },
  { name: "bet_created_at", type: "date", example: "01/04/2026 10:51:40" },
  { name: "bet_resolved_at", type: "date", example: "01/04/2026 10:51:44" },
];

const casinoBetFields: FieldSchema[] = [
  { name: "user_id", type: "string", example: "676f60a451a73300284c7b30" },
  { name: "user_name", type: "string", example: "TESTE" },
  { name: "user_username", type: "string", example: "teste@teste.com" },
  { name: "user_credits", type: "number", example: "5000" },
  { name: "casino_bet_id", type: "string", example: "abc123" },
  { name: "casino_game_name", type: "string", example: "Fortune Tiger" },
  { name: "casino_provider", type: "string", example: "PG Soft" },
  { name: "casino_bet_value", type: "number", example: "100" },
  { name: "casino_created_at", type: "date", example: "26/11/2025 18:25:59" },
];

const sportPrizeFields: FieldSchema[] = [
  { name: "user_id", type: "string", example: "676f60a451a73300284c7b30" },
  { name: "user_name", type: "string", example: "TESTE" },
  { name: "user_username", type: "string", example: "teste@teste.com" },
  { name: "user_credits", type: "number", example: "5000" },
  { name: "user_cpf", type: "string", example: "00000000000" },
  { name: "user_locked", type: "boolean", example: "false" },
  { name: "bet_id", type: "string", example: "abc123" },
  { name: "bet_value", type: "number", example: "50" },
  { name: "bet_return_value", type: "number", example: "5000" },
  { name: "bet_odds", type: "number", example: "100" },
  { name: "bet_events_count", type: "number", example: "5" },
  { name: "bet_created_at", type: "date", example: "26/11/2025 18:25:59" },
];

const sportBetFields: FieldSchema[] = [
  { name: "user_id", type: "string", example: "676f60a451a73300284c7b30" },
  { name: "user_name", type: "string", example: "TESTE" },
  { name: "user_username", type: "string", example: "teste@teste.com" },
  { name: "user_credits", type: "number", example: "5000" },
  { name: "bet_id", type: "string", example: "abc123" },
  { name: "bet_value", type: "number", example: "100" },
  { name: "bet_return_value", type: "number", example: "5000" },
  { name: "bet_odds", type: "number", example: "50" },
  { name: "bet_events_count", type: "number", example: "3" },
  { name: "bet_created_at", type: "date", example: "26/11/2025 18:25:59" },
];

const loginFields: FieldSchema[] = [
  { name: "user_id", type: "string", example: "676f60a451a73300284c7b30" },
  { name: "user_name", type: "string", example: "TESTE" },
  { name: "user_username", type: "string", example: "teste@teste.com" },
  { name: "user_email", type: "string", example: "teste@teste.com" },
  { name: "user_cpf", type: "string", example: "00000000000" },
  { name: "user_contact", type: "string", example: "11983795941" },
  { name: "user_created_at", type: "date", example: "29/10/2025 16:43:25" },
  { name: "user_locked", type: "boolean", example: "false" },
  { name: "login_ip", type: "string", example: "192.168.1.1" },
  { name: "login_at", type: "date", example: "26/11/2025 18:25:59" },
];

const schemas: Record<string, { label: string; fields: FieldSchema[] }> = {
  WITHDRAWAL_CONFIRMATION: { label: "Saque", fields: withdrawalFields },
  DEPOSIT: { label: "Depósito", fields: depositFields },
  CASINO_PRIZE: { label: "Prêmios Cassino", fields: casinoPrizeFields },
  CASINO_BET: { label: "Apostas Cassino", fields: casinoBetFields },
  SPORT_PRIZE: { label: "Prêmios Sportbook", fields: sportPrizeFields },
  SPORT_BET: { label: "Apostas Sportbook", fields: sportBetFields },
  LOGIN: { label: "Login", fields: loginFields },
};

export async function webhookSchemaRoutes(app: FastifyInstance) {
  // /webhooks/process still works for backwards compat (e.g. if analytics worker calls it)
  app.post("/process", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const typeToWebhookType: Record<string, string> = {
      SPORT_BET: "SPORT_BET",
      SPORT_PRIZE: "SPORT_PRIZE",
      CASINO_PRIZE: "CASINO_PRIZE",
      CASINO_BET: "CASINO_BET",
      WITHDRAWAL_CONFIRMATION: "WITHDRAWAL_CONFIRMATION",
      WITHDRAWAL_REQUEST: "WITHDRAWAL_CONFIRMATION",
      DEPOSIT_CONFIRMATION: "DEPOSIT",
      LOGIN: "LOGIN",
    };
    const webhookType = typeToWebhookType[body.type as string];

    if (!webhookType) {
      return reply.status(200).send({ ok: true, matched: 0 });
    }

    try {
      await app.alertEngine.processWebhook(webhookType, body);
    } catch (err) {
      request.log.error({ err }, "Erro no AlertEngine");
    }

    try {
      await app.groupLockEngine.processBet(webhookType, body);
    } catch (err) {
      request.log.error({ err }, "Erro no GroupLockEngine");
    }

    return { ok: true };
  });

  // Get all webhook types and their fields
  app.get("/schemas", { preHandler: authenticate }, async () => {
    return schemas;
  });

  // Get fields for a specific webhook type
  app.get<{ Params: { type: string } }>(
    "/schemas/:type",
    { preHandler: authenticate },
    async (request, reply) => {
      const schema = schemas[request.params.type];
      if (!schema) {
        return reply.status(404).send({ error: "Tipo de webhook não encontrado" });
      }
      return schema;
    }
  );
}
