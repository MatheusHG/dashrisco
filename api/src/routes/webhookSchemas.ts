import { FastifyInstance } from "fastify";
import { authenticate } from "../middlewares/auth";

interface FieldSchema {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "json";
  example: string;
}

// ── Campos comuns do usuario (presentes em quase todos os eventos) ──
const userFields: FieldSchema[] = [
  { name: "user_id", type: "string", example: "676f60a451a73300284c7b30" },
  { name: "user_name", type: "string", example: "TESTE" },
  { name: "user_username", type: "string", example: "teste@teste.com" },
  { name: "user_credits", type: "number", example: "500" },
  { name: "user_bonus_credits", type: "number", example: "0" },
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
];

// ── Withdrawal (Request e Confirmation) ──
const withdrawalFields: FieldSchema[] = [
  ...userFields,
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

// ── Deposit (Request e Confirmation) ──
const depositFields: FieldSchema[] = [
  ...userFields,
  { name: "deposit_id", type: "string", example: "692743cd90533f0029ac001e" },
  { name: "deposit_value", type: "number", example: "1000" },
  { name: "deposit_created_at", type: "date", example: "26/11/2025 18:25:59" },
  { name: "deposit_confirmed_at", type: "date", example: "" },
  { name: "deposit_status", type: "string", example: "PAID" },
  { name: "deposit_qr_code", type: "string", example: "" },
  { name: "deposit_qr_code_image", type: "string", example: "" },
  { name: "deposit_external_id", type: "string", example: "" },
  { name: "deposit_guest_player", type: "boolean", example: "false" },
  { name: "instant_deposit_value", type: "number", example: "0" },
];

// ── Sport Bet ──
const sportBetFields: FieldSchema[] = [
  ...userFields,
  { name: "bet_id", type: "string", example: "abc123" },
  { name: "bet_code", type: "number", example: "12345" },
  { name: "bet_created_at", type: "date", example: "26/11/2025 18:25:59" },
  { name: "bet_estimated_processing", type: "date", example: "26/11/2025 20:00:00" },
  { name: "bet_bonus", type: "boolean", example: "false" },
  { name: "bet_value", type: "number", example: "100" },
  { name: "bet_return_value", type: "number", example: "5000" },
  { name: "bet_events_count", type: "number", example: "3" },
  { name: "bet_is_live", type: "boolean", example: "false" },
  { name: "is_test", type: "boolean", example: "false" },
];

// ── Sport Prize ──
const sportPrizeFields: FieldSchema[] = [
  ...userFields,
  { name: "bet_id", type: "string", example: "abc123" },
  { name: "bet_code", type: "number", example: "12345" },
  { name: "bet_created_at", type: "date", example: "26/11/2025 18:25:59" },
  { name: "bet_bonus", type: "boolean", example: "false" },
  { name: "bet_value", type: "number", example: "50" },
  { name: "bet_return_value", type: "number", example: "5000" },
  { name: "bet_estimated_processing", type: "date", example: "" },
  { name: "bet_is_live", type: "boolean", example: "false" },
  { name: "is_test", type: "boolean", example: "false" },
];

// ── Casino Bet ──
const casinoBetFields: FieldSchema[] = [
  ...userFields,
  { name: "bet_id", type: "string", example: "abc123" },
  { name: "bet_value", type: "number", example: "100" },
  { name: "game_id", type: "string", example: "TopCard000000001" },
  { name: "game_name", type: "string", example: "Fortune Tiger" },
  { name: "game_round_id", type: "string", example: "" },
  { name: "bet_created_at", type: "date", example: "26/11/2025 18:25:59" },
  { name: "is_test", type: "boolean", example: "false" },
];

// ── Casino Prize ──
const casinoPrizeFields: FieldSchema[] = [
  ...userFields,
  { name: "prize_id", type: "string", example: "" },
  { name: "prize_value", type: "number", example: "5000" },
  { name: "game_id", type: "string", example: "TopCard000000001" },
  { name: "game_name", type: "string", example: "Fortune Tiger" },
  { name: "game_type", type: "string", example: "LIVE" },
  { name: "game_round_id", type: "string", example: "" },
  { name: "game_custom_types", type: "json", example: "[\"Evolution\"]" },
  { name: "bet_id", type: "string", example: "abc123" },
  { name: "bet_created_at", type: "date", example: "01/04/2026 10:51:40" },
  { name: "bet_resolved_at", type: "date", example: "01/04/2026 10:51:44" },
  { name: "is_test", type: "boolean", example: "false" },
];

// ── Casino Refund ──
const casinoRefundFields: FieldSchema[] = [
  ...userFields,
  { name: "refunded_transaction_id", type: "string", example: "" },
  { name: "refunded_value", type: "number", example: "100" },
  { name: "game_id", type: "string", example: "TopCard000000001" },
  { name: "game_name", type: "string", example: "Fortune Tiger" },
  { name: "game_round_id", type: "string", example: "" },
  { name: "bet_id", type: "string", example: "abc123" },
  { name: "bet_created_at", type: "date", example: "26/11/2025 18:25:59" },
  { name: "is_test", type: "boolean", example: "false" },
];

// ── Login ──
const loginFields: FieldSchema[] = [
  { name: "login_user_id", type: "string", example: "676f60a451a73300284c7b30" },
  { name: "login_username", type: "string", example: "teste@teste.com" },
  { name: "login_ip_address", type: "string", example: "192.168.1.1" },
  { name: "login_source", type: "string", example: "MOBILE" },
  { name: "login_agent", type: "string", example: "Mozilla/5.0..." },
  { name: "login_date", type: "date", example: "26/11/2025 18:25:59" },
];

// ── User Registration ──
const userRegistrationFields: FieldSchema[] = [
  ...userFields,
];

const schemas: Record<string, { label: string; fields: FieldSchema[] }> = {
  SPORT_BET: { label: "Aposta Esportiva", fields: sportBetFields },
  SPORT_PRIZE: { label: "Premio Esportivo", fields: sportPrizeFields },
  CASINO_BET: { label: "Aposta Cassino", fields: casinoBetFields },
  CASINO_PRIZE: { label: "Premio Cassino", fields: casinoPrizeFields },
  CASINO_REFUND: { label: "Reembolso Cassino", fields: casinoRefundFields },
  DEPOSIT_REQUEST: { label: "Deposito Solicitado", fields: depositFields },
  DEPOSIT: { label: "Deposito Confirmado", fields: depositFields },
  WITHDRAWAL_REQUEST: { label: "Saque Solicitado", fields: withdrawalFields },
  WITHDRAWAL_CONFIRMATION: { label: "Saque Aprovado", fields: withdrawalFields },
  LOGIN: { label: "Login", fields: loginFields },
  USER_REGISTRATION: { label: "Cadastro de Usuario", fields: userRegistrationFields },
};

export async function webhookSchemaRoutes(app: FastifyInstance) {
  // Backwards compat
  app.post("/process", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const typeToWebhookType: Record<string, string> = {
      SPORT_BET: "SPORT_BET",
      SPORT_PRIZE: "SPORT_PRIZE",
      CASINO_BET: "CASINO_BET",
      CASINO_PRIZE: "CASINO_PRIZE",
      CASINO_REFUND: "CASINO_REFUND",
      WITHDRAWAL_CONFIRMATION: "WITHDRAWAL_CONFIRMATION",
      WITHDRAWAL_REQUEST: "WITHDRAWAL_REQUEST",
      DEPOSIT_REQUEST: "DEPOSIT_REQUEST",
      DEPOSIT_CONFIRMATION: "DEPOSIT",
      USER_LOGIN: "LOGIN",
      USER_REGISTRATION: "USER_REGISTRATION",
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
        return reply.status(404).send({ error: "Tipo de webhook nao encontrado" });
      }
      return schema;
    }
  );
}
