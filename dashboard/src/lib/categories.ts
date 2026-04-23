export type AlertCategory = "sportbook" | "cassino" | "finance" | "blocks";

export const CATEGORY_PERMISSIONS: Record<AlertCategory, string> = {
  sportbook: "category:sportbook",
  cassino: "category:cassino",
  finance: "category:finance",
  blocks: "category:blocks",
};
