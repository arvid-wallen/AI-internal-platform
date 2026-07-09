// Zod schemas for the mutation boundaries. The client sends whole edited row
// arrays back for the card import, so this is the layer that keeps malformed
// values out of costs_monthly.
import { z } from "zod";

export const COST_CATEGORIES = [
  "hosting",
  "database",
  "storage",
  "cdn",
  "third_party_api",
  "domain",
  "other",
] as const;

export const switchModelSchema = z.object({
  projectId: z.string().regex(/^(p-)?[a-z0-9-]+$/),
  toModelId: z.string().min(1).max(120),
  reason: z.string().max(500).optional(),
});

export const cardImportRowSchema = z.object({
  period_month: z.string().regex(/^\d{4}-\d{2}-01$/),
  amount_sek: z.number().positive().finite(),
  cost_category: z.enum(COST_CATEGORIES),
  vendor: z.string().trim().min(1).max(200),
  project_id: z.string().uuid().nullable(),
  include: z.boolean(),
});

// The action receives full CardImportRow objects; validate the fields that
// reach the database and pass the rest through.
export const saveCardCostsSchema = z
  .array(cardImportRowSchema.passthrough())
  .max(500);

export const manualCostSchema = z.object({
  vendor: z.string().trim().min(1).max(200),
  amount_sek: z.number().positive().finite(),
  cost_category: z.enum(COST_CATEGORIES),
  period_month: z.string().regex(/^\d{4}-\d{2}(-01)?$/),
  project_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(1000).optional(),
});

export const workspaceMapSchema = z.object({
  provider: z.enum(["anthropic", "openai", "sentry"]),
  map: z.record(z.string().min(1).max(200), z.string().uuid()),
});

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const INVALID_INPUT_MESSAGE =
  "Ogiltiga värden — kontrollera formuläret.";
