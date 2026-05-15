// Mock data — anchored to 2026-05-15. All synthetic; org numbers fictional.
// Ported from haus-ai-operations-hub/project/data.js.

import type {
  AIModel,
  Customer,
  DailyUsage,
  Dependency,
  Incident,
  Integration,
  Invoice,
  ModelHistoryEntry,
  Note,
  PortfolioTotals,
  Project,
  Provider,
  SyncRun,
  TeamMember,
  Update,
} from "./types";

export const NOW = new Date("2026-05-15T10:00:00Z");
export const FX_USD_SEK = 10.78;

export const PROVIDERS: Provider[] = [
  { slug: "anthropic", name: "Anthropic", color: "apricot" },
  { slug: "openai", name: "OpenAI", color: "mint" },
  { slug: "google", name: "Google Gemini", color: "sky" },
];

export const MODELS: AIModel[] = [
  { id: "claude-haiku-4-5", provider: "anthropic", display: "Claude Haiku 4.5", price_in: 1.0, price_out: 5.0, ctx: 200_000, is_current: true, released: "2026-02-04" },
  { id: "claude-sonnet-4-5", provider: "anthropic", display: "Claude Sonnet 4.5", price_in: 3.0, price_out: 15.0, ctx: 1_000_000, is_current: true, released: "2026-01-22" },
  { id: "claude-opus-4-7", provider: "anthropic", display: "Claude Opus 4.7", price_in: 15.0, price_out: 75.0, ctx: 500_000, is_current: true, released: "2026-03-18" },
  { id: "claude-opus-4-1", provider: "anthropic", display: "Claude Opus 4.1", price_in: 15.0, price_out: 75.0, ctx: 200_000, is_current: false, released: "2025-08-12" },
  { id: "gpt-5", provider: "openai", display: "GPT-5", price_in: 10.0, price_out: 30.0, ctx: 400_000, is_current: true, released: "2025-12-09" },
  { id: "gpt-5-mini", provider: "openai", display: "GPT-5 Mini", price_in: 0.4, price_out: 2.0, ctx: 200_000, is_current: true, released: "2026-02-26" },
  { id: "o4", provider: "openai", display: "o4 (reasoning)", price_in: 20.0, price_out: 80.0, ctx: 200_000, is_current: true, released: "2025-11-04" },
  { id: "gpt-4o", provider: "openai", display: "GPT-4o", price_in: 2.5, price_out: 10.0, ctx: 128_000, is_current: false, released: "2024-05-13" },
  { id: "gemini-2-5-pro", provider: "google", display: "Gemini 2.5 Pro", price_in: 1.25, price_out: 5.0, ctx: 2_000_000, is_current: true, released: "2025-09-30" },
  { id: "gemini-2-5-flash", provider: "google", display: "Gemini 2.5 Flash", price_in: 0.1, price_out: 0.4, ctx: 1_000_000, is_current: true, released: "2025-09-30" },
  { id: "gemini-2-5-flash-lite", provider: "google", display: "Gemini 2.5 Flash Lite", price_in: 0.05, price_out: 0.2, ctx: 1_000_000, is_current: true, released: "2026-01-10" },
];

export const modelById = (id: string): AIModel | undefined =>
  MODELS.find((m) => m.id === id);

export const CUSTOMERS: Customer[] = [
  { id: "amanda", name: "Amanda AI AB", org_number: "559187-2244", cls: "B", am: "Arvid Östermanwallen", contract: "live", mrr: 95_000, mark: "mint", init: "A" },
  { id: "vasakronan", name: "Vasakronan", org_number: "556001-9301", cls: "A", am: "Sara Bergström", contract: "live", mrr: 280_000, mark: "sky", init: "V" },
  { id: "ica", name: "ICA Gruppen", org_number: "556048-3098", cls: "A", am: "Sara Bergström", contract: "live", mrr: 320_000, mark: "tomato", init: "I" },
  { id: "klarna", name: "Klarna Bank AB", org_number: "556737-0431", cls: "A", am: "Arvid Östermanwallen", contract: "live", mrr: 540_000, mark: "lilac", init: "K" },
  { id: "northvolt", name: "Northvolt AB", org_number: "559097-7679", cls: "B", am: "Sara Bergström", contract: "paused", mrr: 0, mark: "butter", init: "N" },
  { id: "polestar", name: "Polestar", org_number: "559123-4012", cls: "B", am: "Per Lind", contract: "live", mrr: 145_000, mark: "apricot", init: "P" },
  { id: "skandia", name: "Skandia", org_number: "516406-0948", cls: "A", am: "Per Lind", contract: "live", mrr: 410_000, mark: "blush", init: "S" },
  { id: "storytel", name: "Storytel AB", org_number: "556575-2960", cls: "B", am: "Arvid Östermanwallen", contract: "live", mrr: 175_000, mark: "mint", init: "S" },
  { id: "haus", name: "Haus AI (internal)", org_number: "559302-1100", cls: "C", am: "Arvid Östermanwallen", contract: "live", mrr: 0, mark: "tomato", init: "H" },
];

export const customerById = (id: string): Customer | undefined =>
  CUSTOMERS.find((c) => c.id === id);

export const PROJECTS: Project[] = [
  { id: "p-amanda-chat", slug: "amanda-chat", name: "Amanda Chatbot", customer_id: "amanda", status: "live", go_live: "2025-11-04", repo: "haus/amanda-chat", hosting: "Vercel + Supabase", stack: ["Next.js 16", "Supabase", "pgvector"], active_model: "claude-opus-4-7", monthly_revenue: 65_000, infra_cost: 4_800, ai_cost: 14_240, owner: "Sebastian Holm", healthy: true },
  { id: "p-amanda-vision", slug: "amanda-vision", name: "Amanda Vision Tagger", customer_id: "amanda", status: "live", go_live: "2026-02-18", repo: "haus/amanda-vision", hosting: "GCP Vertex AI", stack: ["Python", "FastAPI", "Vertex AI"], active_model: "gemini-2-5-pro", monthly_revenue: 30_000, infra_cost: 2_100, ai_cost: 6_180, owner: "Linus Frej", healthy: true },
  { id: "p-vasa-lease", slug: "vasakronan-lease", name: "Vasakronan Lease Assistant", customer_id: "vasakronan", status: "live", go_live: "2025-09-20", repo: "haus/vasakronan-lease", hosting: "Vercel + Supabase", stack: ["Next.js 16", "Supabase", "pgvector", "Resend"], active_model: "claude-sonnet-4-5", monthly_revenue: 180_000, infra_cost: 8_600, ai_cost: 33_900, owner: "Sebastian Holm", healthy: true },
  { id: "p-vasa-docs", slug: "vasakronan-docs", name: "Vasakronan Doc Search", customer_id: "vasakronan", status: "building", go_live: null, repo: "haus/vasakronan-docs", hosting: "Vercel + Supabase", stack: ["Next.js 16", "Supabase", "pgvector"], active_model: "gpt-5-mini", monthly_revenue: 100_000, infra_cost: 1_300, ai_cost: 940, owner: "Lova Nyberg", healthy: true },
  { id: "p-ica-recipes", slug: "ica-recipes", name: "ICA Recipe Generator", customer_id: "ica", status: "live", go_live: "2025-06-12", repo: "haus/ica-recipes", hosting: "GCP Cloud Run", stack: ["Python", "FastAPI", "Cloud Run", "BigQuery"], active_model: "claude-haiku-4-5", monthly_revenue: 145_000, infra_cost: 6_200, ai_cost: 18_300, owner: "Lova Nyberg", healthy: true },
  { id: "p-ica-checkout", slug: "ica-checkout", name: "ICA Checkout Helper", customer_id: "ica", status: "live", go_live: "2026-03-04", repo: "haus/ica-checkout", hosting: "Vercel", stack: ["Next.js 16", "Edge Functions"], active_model: "gemini-2-5-flash", monthly_revenue: 175_000, infra_cost: 5_200, ai_cost: 4_710, owner: "Sebastian Holm", healthy: true },
  { id: "p-klarna-dispute", slug: "klarna-dispute", name: "Klarna Dispute Triage", customer_id: "klarna", status: "live", go_live: "2025-08-22", repo: "haus/klarna-dispute", hosting: "AWS Lambda", stack: ["Python", "AWS Lambda", "DynamoDB", "Anthropic"], active_model: "claude-opus-4-7", monthly_revenue: 240_000, infra_cost: 14_800, ai_cost: 162_400, owner: "Linus Frej", healthy: false },
  { id: "p-klarna-voice", slug: "klarna-voice", name: "Klarna Voice Agent", customer_id: "klarna", status: "building", go_live: null, repo: "haus/klarna-voice", hosting: "GCP Vertex AI", stack: ["Python", "Vertex AI", "LiveKit"], active_model: "gemini-2-5-pro", monthly_revenue: 0, infra_cost: 1_400, ai_cost: 2_780, owner: "Sebastian Holm", healthy: true },
  { id: "p-klarna-fraud", slug: "klarna-fraud", name: "Klarna Fraud Co-pilot", customer_id: "klarna", status: "live", go_live: "2025-12-01", repo: "haus/klarna-fraud", hosting: "AWS Lambda", stack: ["Python", "AWS", "DynamoDB"], active_model: "claude-sonnet-4-5", monthly_revenue: 300_000, infra_cost: 12_400, ai_cost: 54_300, owner: "Lova Nyberg", healthy: true },
  { id: "p-nv-qa", slug: "northvolt-qa", name: "Northvolt QA Assistant", customer_id: "northvolt", status: "paused", go_live: "2025-04-10", repo: "haus/nv-qa", hosting: "Azure OpenAI", stack: ["Python", "Azure", "OpenAI"], active_model: "gpt-5", monthly_revenue: 0, infra_cost: 1_100, ai_cost: 0, owner: "Linus Frej", healthy: false },
  { id: "p-pole-manual", slug: "polestar-manual", name: "Polestar Owner's Manual", customer_id: "polestar", status: "live", go_live: "2025-10-08", repo: "haus/polestar-manual", hosting: "Vercel + Supabase", stack: ["Next.js 16", "Supabase"], active_model: "gpt-5", monthly_revenue: 95_000, infra_cost: 3_400, ai_cost: 41_200, owner: "Sebastian Holm", healthy: true },
  { id: "p-pole-eu", slug: "polestar-eu", name: "Polestar EU Compliance", customer_id: "polestar", status: "discovery", go_live: null, repo: null, hosting: "—", stack: ["TBD"], active_model: "claude-sonnet-4-5", monthly_revenue: 50_000, infra_cost: 0, ai_cost: 380, owner: "Lova Nyberg", healthy: true },
  { id: "p-skandia-claim", slug: "skandia-claim", name: "Skandia Claim Summarizer", customer_id: "skandia", status: "live", go_live: "2025-07-14", repo: "haus/skandia-claim", hosting: "Azure", stack: ["Python", "Azure", "OpenAI"], active_model: "claude-sonnet-4-5", monthly_revenue: 260_000, infra_cost: 9_400, ai_cost: 47_300, owner: "Linus Frej", healthy: true },
  { id: "p-skandia-wiki", slug: "skandia-wiki", name: "Skandia Internal Wiki Q&A", customer_id: "skandia", status: "discovery", go_live: null, repo: null, hosting: "—", stack: ["TBD"], active_model: "gpt-5-mini", monthly_revenue: 150_000, infra_cost: 0, ai_cost: 220, owner: "Sebastian Holm", healthy: true },
  { id: "p-story-tags", slug: "storytel-tags", name: "Storytel Audio Tagger", customer_id: "storytel", status: "live", go_live: "2025-12-01", repo: "haus/storytel-tags", hosting: "GCP Vertex AI", stack: ["Python", "Vertex AI", "BigQuery"], active_model: "gemini-2-5-flash", monthly_revenue: 75_000, infra_cost: 4_400, ai_cost: 8_100, owner: "Lova Nyberg", healthy: true },
  { id: "p-story-reco", slug: "storytel-reco", name: "Storytel Reco Engine", customer_id: "storytel", status: "live", go_live: "2026-01-22", repo: "haus/storytel-reco", hosting: "GCP Cloud Run", stack: ["Python", "Cloud Run", "Anthropic"], active_model: "claude-haiku-4-5", monthly_revenue: 100_000, infra_cost: 5_400, ai_cost: 11_900, owner: "Sebastian Holm", healthy: true },
  { id: "p-haus-internal", slug: "haus-internal", name: "Haus Internal Tools", customer_id: "haus", status: "live", go_live: "2025-03-15", repo: "haus/internal", hosting: "Vercel + Supabase", stack: ["Next.js 16", "Supabase"], active_model: "claude-opus-4-7", monthly_revenue: 0, infra_cost: 1_200, ai_cost: 8_800, owner: "Arvid Östermanwallen", healthy: true },
];

export const projectById = (id: string): Project | undefined =>
  PROJECTS.find((p) => p.id === id);
export const projectBySlug = (slug: string): Project | undefined =>
  PROJECTS.find((p) => p.slug === slug);
export const projectsByCustomer = (cid: string): Project[] =>
  PROJECTS.filter((p) => p.customer_id === cid);

export function computePortfolio(): PortfolioTotals {
  const live = PROJECTS.filter((p) => p.status === "live");
  const total_mrr = PROJECTS.reduce((s, p) => s + (p.monthly_revenue || 0), 0);
  const ai_cost = PROJECTS.reduce((s, p) => s + (p.ai_cost || 0), 0);
  const infra = PROJECTS.reduce((s, p) => s + (p.infra_cost || 0), 0);
  const margin = total_mrr - ai_cost - infra;
  return {
    project_count: PROJECTS.length,
    live_count: live.length,
    customer_count: new Set(PROJECTS.map((p) => p.customer_id)).size,
    total_mrr,
    ai_cost,
    infra_cost: infra,
    margin,
    margin_pct: total_mrr ? margin / total_mrr : 0,
  };
}

function _rand(seed: number) {
  let t = seed | 0;
  return function () {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function genDailyUsage(): DailyUsage[] {
  const days = 60;
  const out: DailyUsage[] = [];
  const start = new Date(NOW);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const intensities: Record<string, number> = {};
  for (const p of PROJECTS) {
    intensities[p.id] = Math.max(50, (p.ai_cost || 1000) / 50);
  }
  const rnd = _rand(42);
  for (let d = 0; d < days; d++) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + d);
    const iso = date.toISOString().slice(0, 10);
    const weekday = date.getUTCDay();
    const weekFactor = weekday === 0 || weekday === 6 ? 0.55 : 1;
    for (const p of PROJECTS) {
      if (p.status === "paused" || p.status === "offboarded") continue;
      const model = modelById(p.active_model);
      if (!model) continue;
      const base = intensities[p.id];
      const noise = 0.6 + rnd() * 0.9;
      const tokens_in = Math.round(base * 1000 * noise * weekFactor);
      const tokens_out = Math.round(base * 350 * noise * weekFactor);
      const cost_usd =
        (tokens_in / 1e6) * model.price_in +
        (tokens_out / 1e6) * model.price_out;
      const cost_sek = cost_usd * FX_USD_SEK;
      out.push({
        date: iso,
        project_id: p.id,
        model_id: p.active_model,
        tokens_in,
        tokens_out,
        cost_usd,
        cost_sek,
      });
    }
  }
  return out;
}

export const DAILY_USAGE: DailyUsage[] = genDailyUsage();

export const dailyForProject = (pid: string): DailyUsage[] =>
  DAILY_USAGE.filter((d) => d.project_id === pid);

export interface PortfolioDay {
  date: string;
  cost_sek: number;
  tokens: number;
  byProvider: { anthropic: number; openai: number; google: number };
}

function genDailyPortfolio(): PortfolioDay[] {
  const map = new Map<string, PortfolioDay>();
  for (const u of DAILY_USAGE) {
    if (!map.has(u.date)) {
      map.set(u.date, {
        date: u.date,
        cost_sek: 0,
        tokens: 0,
        byProvider: { anthropic: 0, openai: 0, google: 0 },
      });
    }
    const row = map.get(u.date)!;
    row.cost_sek += u.cost_sek;
    row.tokens += u.tokens_in + u.tokens_out;
    const m = modelById(u.model_id);
    if (m) row.byProvider[m.provider] += u.cost_sek;
  }
  return Array.from(map.values());
}

export const DAILY_PORTFOLIO: PortfolioDay[] = genDailyPortfolio();

export const MODEL_HISTORY: ModelHistoryEntry[] = [
  { project_id: "p-amanda-chat", model_id: "claude-opus-4-7", from: "2026-03-22", to: null, actor: "Arvid Östermanwallen", note: "Bytte från Sonnet — bättre på tonalitet i kunddialoger." },
  { project_id: "p-amanda-chat", model_id: "claude-sonnet-4-5", from: "2026-01-22", to: "2026-03-22", actor: "Sebastian Holm", note: "Migration från Sonnet 4 → 4.5 vid release." },
  { project_id: "p-amanda-chat", model_id: "claude-opus-4-1", from: "2025-11-04", to: "2026-01-22", actor: "Sebastian Holm", note: "Lansering — Opus 4.1." },
  { project_id: "p-vasa-lease", model_id: "claude-sonnet-4-5", from: "2026-01-24", to: null, actor: "Sara Bergström", note: "Sonnet 4.5 — billigare än Opus, samma kvalitet på avtalstexter." },
  { project_id: "p-vasa-lease", model_id: "claude-opus-4-1", from: "2025-09-20", to: "2026-01-24", actor: "Sebastian Holm", note: "Lansering." },
  { project_id: "p-klarna-dispute", model_id: "claude-opus-4-7", from: "2026-04-02", to: null, actor: "Linus Frej", note: "Opus 4.7 — flaggat som dyrare; under utvärdering." },
  { project_id: "p-klarna-dispute", model_id: "claude-opus-4-1", from: "2025-08-22", to: "2026-04-02", actor: "Linus Frej", note: "Lansering." },
  { project_id: "p-ica-recipes", model_id: "claude-haiku-4-5", from: "2026-02-10", to: null, actor: "Lova Nyberg", note: "Haiku 4.5 räcker — 80% kostnadsminskning." },
  { project_id: "p-ica-recipes", model_id: "claude-sonnet-4-5", from: "2025-06-12", to: "2026-02-10", actor: "Lova Nyberg", note: "Lansering." },
];

export const modelHistoryFor = (pid: string): ModelHistoryEntry[] =>
  MODEL_HISTORY.filter((h) => h.project_id === pid);

export const INVOICES: Invoice[] = [
  { id: "F-2604-118", customer_id: "klarna", project_id: "p-klarna-fraud", date: "2026-05-01", due: "2026-05-31", amount: 300_000, status: "sent", recurring: true },
  { id: "F-2604-117", customer_id: "klarna", project_id: "p-klarna-dispute", date: "2026-05-01", due: "2026-05-31", amount: 240_000, status: "sent", recurring: true },
  { id: "F-2604-116", customer_id: "skandia", project_id: "p-skandia-claim", date: "2026-05-01", due: "2026-05-31", amount: 260_000, status: "paid", recurring: true },
  { id: "F-2604-115", customer_id: "skandia", project_id: "p-skandia-wiki", date: "2026-05-01", due: "2026-05-31", amount: 150_000, status: "sent", recurring: true },
  { id: "F-2604-114", customer_id: "ica", project_id: "p-ica-recipes", date: "2026-05-01", due: "2026-05-31", amount: 145_000, status: "paid", recurring: true },
  { id: "F-2604-113", customer_id: "ica", project_id: "p-ica-checkout", date: "2026-05-01", due: "2026-05-31", amount: 175_000, status: "sent", recurring: true },
  { id: "F-2604-112", customer_id: "vasakronan", project_id: "p-vasa-lease", date: "2026-05-01", due: "2026-05-31", amount: 180_000, status: "paid", recurring: true },
  { id: "F-2604-111", customer_id: "vasakronan", project_id: "p-vasa-docs", date: "2026-05-01", due: "2026-05-31", amount: 100_000, status: "sent", recurring: true },
  { id: "F-2604-110", customer_id: "amanda", project_id: "p-amanda-chat", date: "2026-05-01", due: "2026-05-31", amount: 65_000, status: "paid", recurring: true },
  { id: "F-2604-109", customer_id: "amanda", project_id: "p-amanda-vision", date: "2026-05-01", due: "2026-05-31", amount: 30_000, status: "paid", recurring: true },
  { id: "F-2604-108", customer_id: "storytel", project_id: "p-story-tags", date: "2026-05-01", due: "2026-05-31", amount: 75_000, status: "sent", recurring: true },
  { id: "F-2604-107", customer_id: "storytel", project_id: "p-story-reco", date: "2026-05-01", due: "2026-05-31", amount: 100_000, status: "sent", recurring: true },
  { id: "F-2604-106", customer_id: "polestar", project_id: "p-pole-manual", date: "2026-05-01", due: "2026-05-31", amount: 95_000, status: "paid", recurring: true },
  { id: "F-2604-105", customer_id: "polestar", project_id: "p-pole-eu", date: "2026-05-01", due: "2026-05-31", amount: 50_000, status: "draft", recurring: false },
  { id: "F-2603-098", customer_id: "klarna", project_id: "p-klarna-fraud", date: "2026-04-01", due: "2026-04-30", amount: 300_000, status: "paid", recurring: true },
  { id: "F-2603-097", customer_id: "klarna", project_id: "p-klarna-dispute", date: "2026-04-01", due: "2026-04-30", amount: 240_000, status: "overdue", recurring: true },
];

export const INCIDENTS: Incident[] = [
  { id: "INC-2026-014", when: "2026-05-13 09:42", project_id: "p-klarna-dispute", severity: "high", title: "Anthropic 529 — overload på Opus 4.7", summary: "Cirka 35 min med förhöjda fel under EU-peak. Auto-fallback till Sonnet 4.5 fungerade.", resolved: true },
  { id: "INC-2026-013", when: "2026-05-09 14:11", project_id: "p-pole-manual", severity: "medium", title: "OpenAI rate limit på org-tier", summary: "Tier-3 begränsning slog till efter publik kampanj. Klar efter att vi höjt limit.", resolved: true },
  { id: "INC-2026-012", when: "2026-05-07 23:50", project_id: "p-ica-recipes", severity: "low", title: "Kvalitetsdegradering på Haiku 4.5", summary: 'Tema "veckomatsedel" tappade JSON-format i 3% av svaren. Rollat ut bättre system prompt.', resolved: true },
  { id: "INC-2026-011", when: "2026-05-02 08:20", project_id: "p-vasa-lease", severity: "low", title: "pgvector index timeout", summary: "Långsam query efter migration; nytt HNSW-index löste det.", resolved: true },
  { id: "INC-2026-010", when: "2026-04-28 16:00", project_id: "p-klarna-dispute", severity: "high", title: "Kostnadsspike — 4.2× normal", summary: "Opus 4.7-rollout dubblade prompt-storleken. Trim av context window, separat tråd i Reports.", resolved: false },
];

export const TEAM: TeamMember[] = [
  { id: "u-arvid", name: "Arvid Östermanwallen", email: "arvid@haus.se", role: "admin", initials: "AÖ", color: "apricot", active: true },
  { id: "u-sara", name: "Sara Bergström", email: "sara@haus.se", role: "admin", initials: "SB", color: "mint", active: true },
  { id: "u-sebastian", name: "Sebastian Holm", email: "sebastian@haus.se", role: "editor", initials: "SH", color: "sky", active: true },
  { id: "u-lova", name: "Lova Nyberg", email: "lova@haus.se", role: "editor", initials: "LN", color: "lilac", active: true },
  { id: "u-linus", name: "Linus Frej", email: "linus@haus.se", role: "editor", initials: "LF", color: "butter", active: true },
  { id: "u-per", name: "Per Lind", email: "per@haus.se", role: "editor", initials: "PL", color: "blush", active: true },
  { id: "u-mia", name: "Mia Stark", email: "mia@haus.se", role: "viewer", initials: "MS", color: "tomato", active: true },
];

export const INTEGRATIONS: Integration[] = [
  { id: "anthropic", name: "Anthropic Admin API", desc: "Token usage + cost reports från Anthropic-workspaces.", status: "ok", last_sync: "2026-05-15 04:12", workspaces: 9, color: "apricot" },
  { id: "openai", name: "OpenAI Organization", desc: "Daily usage från /v1/organization/usage/*.", status: "ok", last_sync: "2026-05-15 04:23", workspaces: 4, color: "mint" },
  { id: "google", name: "Google Cloud Billing", desc: "Vertex AI-kostnader via label haus_project=<slug>.", status: "warn", last_sync: "2026-05-15 04:33", workspaces: 6, color: "sky", note: "2 projekt saknar label-mappning" },
  { id: "fortnox", name: "Fortnox", desc: "Fakturor, kunder, artikelmapping. OAuth2 + webhook.", status: "ok", last_sync: "2026-05-15 05:01", workspaces: null, color: "butter" },
  { id: "github", name: "GitHub", desc: "Repo-meta, senaste commit, open PR-count.", status: "ok", last_sync: "2026-05-15 05:31", workspaces: 17, color: "paper" },
  { id: "vercel", name: "Vercel", desc: "Deployment + bandwidth-kostnader per projekt.", status: "ok", last_sync: "2026-05-15 05:46", workspaces: 12, color: "paper" },
  { id: "riksbanken", name: "Riksbanken (FX)", desc: "Dagliga USD/SEK-kurser.", status: "ok", last_sync: "2026-05-15 04:00", workspaces: null, color: "paper" },
];

export const SYNC_RUNS: SyncRun[] = [
  { id: "r-401", integration: "anthropic", at: "2026-05-15 04:12", status: "ok", records: 38, took: "4.2s" },
  { id: "r-400", integration: "openai", at: "2026-05-15 04:23", status: "ok", records: 21, took: "3.1s" },
  { id: "r-399", integration: "google", at: "2026-05-15 04:33", status: "warn", records: 14, took: "8.4s", err: "workspace 882-330 saknar haus_project label på 2 SKU" },
  { id: "r-398", integration: "fortnox", at: "2026-05-15 05:01", status: "ok", records: 6, took: "1.9s" },
  { id: "r-397", integration: "github", at: "2026-05-15 05:31", status: "ok", records: 17, took: "2.4s" },
  { id: "r-396", integration: "vercel", at: "2026-05-15 05:46", status: "ok", records: 12, took: "5.7s" },
  { id: "r-395", integration: "anthropic", at: "2026-05-14 04:12", status: "ok", records: 39, took: "4.0s" },
];

export const NOTES: Note[] = [
  { id: "n-1", parent: "global", title: "Onboarding-checklista för nya kundprojekt", when: "2026-05-12", author: "AÖ", tag: "process", body: "Workspace per kundprojekt hos Anthropic + OpenAI. Mappa workspace_id i settings/integrations innan första sync." },
  { id: "n-2", parent: "global", title: "Modellbytesrutiner — när byter vi modell?", when: "2026-05-04", author: "SH", tag: "process", body: "Tre frågor: bättre, billigare eller bredare context. Annars rör vi inte. Logga skäl i timeline." },
  { id: "n-3", parent: "p-klarna-dispute", title: "Opus 4.7-utvärdering pågår", when: "2026-05-13", author: "LF", tag: "evaluation", body: "Klarna har lyft kvalitetshöjningen i 3 reviews men kostnaden är upp 4.2×. Föreslår tillbaka till Sonnet 4.5 + reasoning_effort=high." },
  { id: "n-4", parent: "global", title: "Fortnox-artikelnamnkonvention", when: "2026-04-22", author: "SB", tag: "process", body: "AI-<KUND>-<PROJEKT>. Ex: AI-KLARNA-DISPUTE. Mappas automatiskt till project_id via /settings/integrations." },
  { id: "n-5", parent: "global", title: "Q2 OKR — minska AI-kostnaden 18%", when: "2026-04-10", author: "AÖ", tag: "strategy", body: "Tre spår: (1) Haiku/Flash på lågkrav-flöden, (2) prompt caching överallt, (3) trim av context window." },
];

export const DEPENDENCIES: Dependency[] = [
  { project_id: "p-amanda-chat", name: "Supabase Postgres", vendor: "Supabase", category: "database", monthly_sek: 1_100, critical: true },
  { project_id: "p-amanda-chat", name: "Vercel Pro", vendor: "Vercel", category: "hosting", monthly_sek: 2_700, critical: true },
  { project_id: "p-amanda-chat", name: "Resend", vendor: "Resend", category: "third_party_api", monthly_sek: 220, critical: false },
  { project_id: "p-amanda-chat", name: "Cloudflare R2", vendor: "Cloudflare", category: "storage", monthly_sek: 780, critical: false },
  { project_id: "p-vasa-lease", name: "Supabase Postgres", vendor: "Supabase", category: "database", monthly_sek: 4_400, critical: true },
  { project_id: "p-vasa-lease", name: "Vercel Pro", vendor: "Vercel", category: "hosting", monthly_sek: 3_100, critical: true },
  { project_id: "p-vasa-lease", name: "Resend", vendor: "Resend", category: "third_party_api", monthly_sek: 1_100, critical: false },
];

export const depsFor = (pid: string): Dependency[] =>
  DEPENDENCIES.filter((d) => d.project_id === pid);

export const UPDATES: Update[] = [
  { when: "2026-05-15 09:12", actor: "AÖ", kind: "model-switch", project: "p-klarna-dispute", body: "Föreslår byte tillbaka till Sonnet 4.5 efter Opus-utvärderingen — sparar ~108k SEK/mån." },
  { when: "2026-05-14 17:40", actor: "SH", kind: "note", project: "p-amanda-chat", body: "Amanda vill testa custom system prompt-varianter i veckan." },
  { when: "2026-05-14 11:05", actor: "LF", kind: "incident", project: "p-klarna-dispute", body: "INC-2026-014 löst. Auto-fallback till Sonnet 4.5 fungerade som planerat." },
  { when: "2026-05-13 16:22", actor: "LN", kind: "go-live", project: "p-ica-checkout", body: "Live för 35% av kassorna. Inga incidenter på 12 dagar." },
  { when: "2026-05-12 10:14", actor: "SB", kind: "invoice", project: "p-vasa-lease", body: "Maj-fakturan betald 5 dagar före förfallodatum." },
  { when: "2026-05-09 14:33", actor: "AÖ", kind: "model-switch", project: "p-ica-recipes", body: "Bytt från Sonnet 4.5 → Haiku 4.5. Förväntad besparing 14 200 SEK/mån." },
];
