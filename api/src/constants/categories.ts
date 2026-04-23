export type AlertCategory = "sportbook" | "cassino" | "finance" | "blocks";

export const CATEGORY_PERMISSIONS: Record<AlertCategory, string> = {
  sportbook: "category:sportbook",
  cassino: "category:cassino",
  finance: "category:finance",
  blocks: "category:blocks",
};

export const CATEGORY_WEBHOOK_TYPES: Record<Exclude<AlertCategory, "blocks">, string[]> = {
  sportbook: ["SPORT_BET", "SPORT_PRIZE"],
  cassino: ["CASINO_BET", "CASINO_PRIZE", "CASINO_REFUND"],
  finance: ["DEPOSIT", "DEPOSIT_REQUEST", "WITHDRAWAL_REQUEST", "WITHDRAWAL_CONFIRMATION"],
};

export function getCategoryForAlert(
  webhookType: string | null | undefined,
  source: string | null | undefined
): AlertCategory | null {
  if (source === "group_lock") return "blocks";
  if (!webhookType) return null;
  for (const [cat, types] of Object.entries(CATEGORY_WEBHOOK_TYPES) as [
    Exclude<AlertCategory, "blocks">,
    string[]
  ][]) {
    if (types.includes(webhookType)) return cat;
  }
  return null;
}

export function allowedCategoriesFromPermissions(permissions: string[]): AlertCategory[] {
  return (Object.entries(CATEGORY_PERMISSIONS) as [AlertCategory, string][])
    .filter(([, perm]) => permissions.includes(perm))
    .map(([cat]) => cat);
}

export function allowedWebhookTypes(cats: AlertCategory[]): string[] {
  return cats.flatMap((c) => (c === "blocks" ? [] : CATEGORY_WEBHOOK_TYPES[c]));
}
