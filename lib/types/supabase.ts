// Auto-generated from Supabase project kxveauocjqpqpqmyrlhu (haus-ai-ops).
// Regenerate: pnpm dlx supabase gen types typescript --project-id kxveauocjqpqpqmyrlhu

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      ai_models: {
        Row: {
          cache_read_price_per_mtok_usd: number | null;
          cache_write_price_per_mtok_usd: number | null;
          context_window: number | null;
          created_at: string;
          deprecated_at: string | null;
          display_name: string;
          family: string | null;
          id: string;
          input_price_per_mtok_usd: number | null;
          is_current: boolean;
          model_id: string;
          output_price_per_mtok_usd: number | null;
          provider_id: string;
          released_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["ai_models"]["Row"]> & {
          display_name: string;
          model_id: string;
          provider_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_models"]["Row"]>;
      };
      ai_providers: {
        Row: {
          api_base_url: string | null;
          display_name: string;
          id: string;
          slug: string;
          status: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ai_providers"]["Row"]> & {
          display_name: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_providers"]["Row"]>;
      };
      customers: {
        Row: {
          account_manager_id: string | null;
          archived_at: string | null;
          contract_status: string;
          created_at: string;
          customer_class: string | null;
          fortnox_customer_id: string | null;
          id: string;
          invoice_email: string | null;
          name: string;
          notes_count: number;
          org_number: string | null;
          primary_contact_email: string | null;
          primary_contact_name: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["customers"]["Row"]> & {
          name: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Row"]>;
      };
      projects: {
        Row: {
          archived_at: string | null;
          config_bearer_secret_id: string | null;
          created_at: string;
          customer_id: string;
          description: string | null;
          github_default_branch: string | null;
          github_repo_url: string | null;
          go_live_date: string | null;
          hosting_external_id: string | null;
          hosting_provider: string | null;
          id: string;
          internal_owner_id: string | null;
          monthly_infra_budget_sek: number | null;
          monthly_revenue_sek: number | null;
          name: string;
          slug: string;
          status: string;
          tech_stack: string[] | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["projects"]["Row"]> & {
          customer_id: string;
          name: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Row"]>;
      };
      project_models: {
        Row: {
          config: Json | null;
          created_by: string | null;
          effective_from: string;
          effective_to: string | null;
          id: string;
          is_active: boolean;
          model_id: string;
          note: string | null;
          project_id: string;
          role: string;
        };
        Insert: Partial<Database["public"]["Tables"]["project_models"]["Row"]> & {
          model_id: string;
          project_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["project_models"]["Row"]>;
      };
      token_usage_daily: {
        Row: {
          cache_read_tokens: number | null;
          cache_write_tokens: number | null;
          cost_sek: number | null;
          cost_usd: number | null;
          id: string;
          ingested_at: string;
          input_tokens: number | null;
          model_id: string | null;
          output_tokens: number | null;
          project_id: string | null;
          provider_id: string | null;
          raw: Json | null;
          request_count: number | null;
          source_workspace_id: string | null;
          usage_date: string;
        };
        Insert: Partial<Database["public"]["Tables"]["token_usage_daily"]["Row"]> & {
          usage_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["token_usage_daily"]["Row"]>;
      };
      // Other tables omitted for brevity — query via dynamic typing or extend as needed.
    };
    Views: {
      mv_project_pnl_monthly: {
        Row: {
          ai_cost_sek: number | null;
          customer_id: string | null;
          infra_cost_sek: number | null;
          margin_pct: number | null;
          margin_sek: number | null;
          name: string | null;
          period_month: string | null;
          project_id: string | null;
          revenue_sek: number | null;
        };
      };
    };
    Functions: {
      has_role: { Args: { required: string }; Returns: boolean };
      is_haus_member: { Args: never; Returns: boolean };
      refresh_pnl_monthly: { Args: never; Returns: undefined };
    };
  };
};
