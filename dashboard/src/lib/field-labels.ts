/**
 * Traducao centralizada dos campos de webhook para portugues.
 * Usado em todas as telas que exibem dados de alertas, tasks e notificacoes.
 */
export const fieldLabels: Record<string, string> = {
  // Usuario
  user_id: "ID do Usuario",
  user_name: "Nome",
  user_username: "Username",
  user_email: "Email",
  user_cpf: "CPF",
  user_contact: "Contato",
  user_contact_country_code: "DDI",
  user_credits: "Creditos",
  user_birth_date: "Data de Nascimento",
  user_created_at: "Cadastro do Usuario",
  user_locked: "Usuario Bloqueado",
  user_affiliated: "Afiliado",
  user_affiliation: "Afiliacao",
  user_affiliation_manager: "Gerente de Afiliacao",
  user_locked_bet: "Bloq. Apostas",
  user_locked_bonus_bet: "Bloq. Apostas Bonus",
  user_locked_casino_bet: "Bloq. Apostas Cassino",
  user_locked_deposit: "Bloq. Deposito",
  user_locked_withdraw: "Bloq. Saque",
  user_locked_esport_bet: "Bloq. Apostas Esportivas",
  user_has_kyc: "KYC Verificado",
  user_accepted_reg_market: "Aceito Reg. Marketing",
  user_accepted_notifications: "Aceito Notificacoes",
  user_kyc_confirmed_at: "Data Verificacao KYC",

  // Saque
  withdraw_id: "ID do Saque",
  withdraw_value: "Valor do Saque",
  withdraw_created_at: "Data do Saque",
  withdraw_confirmed_at: "Data Confirmacao Saque",
  withdraw_status: "Status do Saque",
  withdraw_pix_key: "Chave PIX",
  withdraw_pix_type: "Tipo PIX",
  withdraw_external_id: "ID Externo Saque",
  withdraw_guest_player: "Jogador Convidado",

  // Deposito
  deposit_id: "ID do Deposito",
  deposit_value: "Valor do Deposito",
  deposit_created_at: "Data do Deposito",
  deposit_status: "Status do Deposito",
  deposit_method: "Metodo de Deposito",

  // Cassino
  casino_bet_id: "ID da Aposta Cassino",
  casino_game_name: "Jogo",
  casino_provider: "Provedor",
  casino_bet_value: "Valor Aposta Cassino",
  casino_prize_value: "Valor Premio Cassino",
  casino_created_at: "Data Aposta Cassino",

  // Esportivo
  bet_id: "ID da Aposta",
  bet_value: "Valor da Aposta",
  bet_return_value: "Valor Retorno",
  bet_odds: "Odds",
  bet_events_count: "Qtd. Eventos",
  bet_created_at: "Data da Aposta",

  // Login
  login_ip: "IP do Login",
  login_at: "Data do Login",
};

/**
 * Retorna o label traduzido para um campo, ou o nome original se nao houver traducao.
 */
export function getFieldLabel(fieldName: string): string {
  return fieldLabels[fieldName] ?? fieldName;
}

/**
 * Formata valor monetario estilo caixa registradora.
 * Entrada: digitos puros do onChange. Saida: "0,00", "0,01", "1,00", "100,00" etc.
 * O valor armazenado internamente e o numero inteiro (centavos).
 */
export function formatCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const num = parseInt(digits || "0", 10);
  return (num / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Extrai o valor numerico real (sem formatacao) de um valor formatado.
 * "1.000,50" -> "1000.50"
 */
export function parseCurrency(formatted: string): string {
  const digits = formatted.replace(/\D/g, "");
  const num = parseInt(digits || "0", 10);
  return (num / 100).toFixed(2).replace(",", ".");
}
