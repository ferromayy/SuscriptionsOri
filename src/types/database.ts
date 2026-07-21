export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TenantStatus =
  | "pending_owner"
  | "active"
  | "suspended"
  | "cancelled";

export type TenantMemberRole = "owner" | "admin" | "subscriber";

export type JoinedVia = "client_invite" | "public_signup";

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export type SubscriptionStatus =
  | "pending_payment"
  | "pending_authorization"
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled";

export type PlanFieldType = "select" | "text";

export type DeliveryMethod = "shipping" | "andreani" | "store_pickup";

export type PaymentMethod = "card_monthly" | "card_annual" | "transfer";

export type BillingInterval = "month" | "year";

export type BillingCycleDays = 15 | 30 | 45;

export type MpConnectionStatus = "connected" | "disconnected" | "error";

export type PaymentStatus = "pending" | "authorized" | "paused" | "cancelled";

export type PaymentEventSource = "transfer" | "card" | "manual";

export type PaymentEventKind =
  | "submitted"
  | "confirmed"
  | "charged"
  | "rejected"
  | "cancelled";

export type PaymentCycleStatus =
  | "upcoming"
  | "awaiting_payment"
  | "submitted"
  | "paid"
  | "past_due"
  | "failed"
  | "cancelled";

export type DeliveryFulfillmentStatus = "ready" | "shipped";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          password_hash: string;
          full_name: string | null;
          email_verified_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash: string;
          full_name?: string | null;
          email_verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string;
          full_name?: string | null;
          email_verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      email_verification_tokens: {
        Row: {
          id: string;
          user_id: string;
          code_hash: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          code_hash: string;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          code_hash?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      password_reset_tokens: {
        Row: {
          id: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token_hash?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token_hash?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      platform_admins: {
        Row: {
          user_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          status: TenantStatus;
          settings: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          status?: TenantStatus;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          status?: TenantStatus;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      platform_invitations: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          token_hash: string;
          verification_code_hash: string | null;
          invited_by: string;
          status: InvitationStatus;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          email: string;
          token_hash: string;
          verification_code_hash?: string | null;
          invited_by: string;
          status?: InvitationStatus;
          expires_at: string;
          accepted_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          email?: string;
          token_hash?: string;
          verification_code_hash?: string | null;
          invited_by?: string;
          status?: InvitationStatus;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      tenant_members: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          role: TenantMemberRole;
          joined_via: JoinedVia;
          status: string;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          role: TenantMemberRole;
          joined_via: JoinedVia;
          status?: string;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          role?: TenantMemberRole;
          joined_via?: JoinedVia;
          status?: string;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          description: string | null;
          internal_label: string | null;
          price_cents: number;
          currency: string;
          interval: string;
          field_count: number;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          description?: string | null;
          internal_label?: string | null;
          price_cents?: number;
          currency?: string;
          interval?: string;
          field_count?: number;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          description?: string | null;
          internal_label?: string | null;
          price_cents?: number;
          currency?: string;
          interval?: string;
          field_count?: number;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      plan_fields: {
        Row: {
          id: string;
          plan_id: string;
          sort_order: number;
          label: string;
          field_type: PlanFieldType;
          affects_price: boolean;
          is_required: boolean;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          plan_id: string;
          sort_order?: number;
          label: string;
          field_type: PlanFieldType;
          affects_price?: boolean;
          is_required?: boolean;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          plan_id?: string;
          sort_order?: number;
          label?: string;
          field_type?: PlanFieldType;
          affects_price?: boolean;
          is_required?: boolean;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      plan_field_options: {
        Row: {
          id: string;
          field_id: string;
          label: string;
          price_delta_cents: number;
          sort_order: number;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          field_id: string;
          label: string;
          price_delta_cents?: number;
          sort_order?: number;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          field_id?: string;
          label?: string;
          price_delta_cents?: number;
          sort_order?: number;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          plan_id: string;
          status: SubscriptionStatus;
          final_price_cents: number | null;
          contact_email: string | null;
          contact_phone: string | null;
          contact_first_name: string | null;
          contact_last_name: string | null;
          delivery_method: DeliveryMethod | null;
          delivery_details: Json;
          payment_reference: string | null;
          payment_receipt_path: string | null;
          payment_method: PaymentMethod | null;
          billing_interval: BillingInterval | null;
          billing_cycle_days: BillingCycleDays | null;
          mp_preapproval_id: string | null;
          mp_init_point: string | null;
          payment_status: PaymentStatus | null;
          mp_last_rejection_detail: string | null;
          mp_last_rejection_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          plan_id: string;
          status?: SubscriptionStatus;
          final_price_cents?: number | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          contact_first_name?: string | null;
          contact_last_name?: string | null;
          delivery_method?: DeliveryMethod | null;
          delivery_details?: Json;
          payment_reference?: string | null;
          payment_receipt_path?: string | null;
          payment_method?: PaymentMethod | null;
          billing_interval?: BillingInterval | null;
          billing_cycle_days?: BillingCycleDays | null;
          mp_preapproval_id?: string | null;
          mp_init_point?: string | null;
          payment_status?: PaymentStatus | null;
          mp_last_rejection_detail?: string | null;
          mp_last_rejection_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          plan_id?: string;
          status?: SubscriptionStatus;
          final_price_cents?: number | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          contact_first_name?: string | null;
          contact_last_name?: string | null;
          delivery_method?: DeliveryMethod | null;
          delivery_details?: Json;
          payment_reference?: string | null;
          payment_receipt_path?: string | null;
          payment_method?: PaymentMethod | null;
          billing_interval?: BillingInterval | null;
          billing_cycle_days?: BillingCycleDays | null;
          mp_preapproval_id?: string | null;
          mp_init_point?: string | null;
          payment_status?: PaymentStatus | null;
          mp_last_rejection_detail?: string | null;
          mp_last_rejection_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      tenant_mp_connections: {
        Row: {
          id: string;
          tenant_id: string;
          mp_user_id: string | null;
          access_token: string;
          refresh_token: string | null;
          token_expires_at: string | null;
          live_mode: boolean;
          status: MpConnectionStatus;
          transfer_cbu: string | null;
          transfer_alias: string | null;
          transfer_holder_name: string | null;
          connected_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          mp_user_id?: string | null;
          access_token: string;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          live_mode?: boolean;
          status?: MpConnectionStatus;
          transfer_cbu?: string | null;
          transfer_alias?: string | null;
          transfer_holder_name?: string | null;
          connected_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          mp_user_id?: string | null;
          access_token?: string;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          live_mode?: boolean;
          status?: MpConnectionStatus;
          transfer_cbu?: string | null;
          transfer_alias?: string | null;
          transfer_holder_name?: string | null;
          connected_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      subscription_choices: {
        Row: {
          id: string;
          subscription_id: string;
          field_id: string;
          option_id: string | null;
          text_value: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          subscription_id: string;
          field_id: string;
          option_id?: string | null;
          text_value?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          subscription_id?: string;
          field_id?: string;
          option_id?: string | null;
          text_value?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      payment_events: {
        Row: {
          id: string;
          tenant_id: string;
          subscription_id: string;
          user_id: string;
          source: PaymentEventSource;
          kind: PaymentEventKind;
          amount_cents: number;
          billing_cycle_days: number | null;
          due_on: string | null;
          paid_at: string | null;
          payment_reference: string | null;
          payment_receipt_path: string | null;
          external_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          subscription_id: string;
          user_id: string;
          source: PaymentEventSource;
          kind: PaymentEventKind;
          amount_cents: number;
          billing_cycle_days?: number | null;
          due_on?: string | null;
          paid_at?: string | null;
          payment_reference?: string | null;
          payment_receipt_path?: string | null;
          external_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          subscription_id?: string;
          user_id?: string;
          source?: PaymentEventSource;
          kind?: PaymentEventKind;
          amount_cents?: number;
          billing_cycle_days?: number | null;
          due_on?: string | null;
          paid_at?: string | null;
          payment_reference?: string | null;
          payment_receipt_path?: string | null;
          external_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      payment_cycles: {
        Row: {
          id: string;
          tenant_id: string;
          subscription_id: string;
          user_id: string;
          cycle_number: number;
          period_start: string;
          due_on: string;
          amount_cents: number;
          payment_method: PaymentMethod;
          status: PaymentCycleStatus;
          payment_reference: string | null;
          payment_receipt_path: string | null;
          external_id: string | null;
          submitted_at: string | null;
          paid_at: string | null;
          reminder_email_sent_at: string | null;
          reminder_whatsapp_opened_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          subscription_id: string;
          user_id: string;
          cycle_number: number;
          period_start: string;
          due_on: string;
          amount_cents: number;
          payment_method: PaymentMethod;
          status?: PaymentCycleStatus;
          payment_reference?: string | null;
          payment_receipt_path?: string | null;
          external_id?: string | null;
          submitted_at?: string | null;
          paid_at?: string | null;
          reminder_email_sent_at?: string | null;
          reminder_whatsapp_opened_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          subscription_id?: string;
          user_id?: string;
          cycle_number?: number;
          period_start?: string;
          due_on?: string;
          amount_cents?: number;
          payment_method?: PaymentMethod;
          status?: PaymentCycleStatus;
          payment_reference?: string | null;
          payment_receipt_path?: string | null;
          external_id?: string | null;
          submitted_at?: string | null;
          paid_at?: string | null;
          reminder_email_sent_at?: string | null;
          reminder_whatsapp_opened_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      delivery_fulfillments: {
        Row: {
          id: string;
          tenant_id: string;
          subscription_id: string;
          user_id: string;
          due_on: string;
          status: DeliveryFulfillmentStatus;
          ready_at: string | null;
          shipped_at: string | null;
          shipped_email_sent_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          subscription_id: string;
          user_id: string;
          due_on: string;
          status: DeliveryFulfillmentStatus;
          ready_at?: string | null;
          shipped_at?: string | null;
          shipped_email_sent_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          subscription_id?: string;
          user_id?: string;
          due_on?: string;
          status?: DeliveryFulfillmentStatus;
          ready_at?: string | null;
          shipped_at?: string | null;
          shipped_email_sent_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
