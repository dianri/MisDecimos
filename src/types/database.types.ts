export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          metadata: Json
          percentage: number | null
          target_user_id: string | null
          ticket_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          metadata?: Json
          percentage?: number | null
          target_user_id?: string | null
          ticket_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          percentage?: number | null
          target_user_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      draw_templates: {
        Row: {
          created_at: string
          default_price: number
          draw_type: string
          id: string
          is_active: boolean
          name: string
          overlay_config: Json
          template_image_url: string | null
          year: number
        }
        Insert: {
          created_at?: string
          default_price?: number
          draw_type: string
          id?: string
          is_active?: boolean
          name: string
          overlay_config?: Json
          template_image_url?: string | null
          year: number
        }
        Update: {
          created_at?: string
          default_price?: number
          draw_type?: string
          id?: string
          is_active?: boolean
          name?: string
          overlay_config?: Json
          template_image_url?: string | null
          year?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string
          created_at: string
          id: string
          is_read: boolean
          metadata: Json
          ticket_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json
          ticket_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json
          ticket_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ownership_shares: {
        Row: {
          created_at: string
          id: string
          percentage: number
          prize_paid_confirmed: boolean
          prize_paid_confirmed_at: string | null
          role: string
          status: string
          ticket_id: string
          updated_at: string
          user_id: string
          waiver_requested: boolean
          waiver_requested_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          percentage: number
          prize_paid_confirmed?: boolean
          prize_paid_confirmed_at?: string | null
          role: string
          status?: string
          ticket_id: string
          updated_at?: string
          user_id: string
          waiver_requested?: boolean
          waiver_requested_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          percentage?: number
          prize_paid_confirmed?: boolean
          prize_paid_confirmed_at?: string | null
          role?: string
          status?: string
          ticket_id?: string
          updated_at?: string
          user_id?: string
          waiver_requested?: boolean
          waiver_requested_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ownership_shares_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ownership_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_invites: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          created_at: string
          created_by: string
          id: string
          invite_token: string
          label: string | null
          percentage: number
          short_code: string
          status: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          invite_token?: string
          label?: string | null
          percentage: number
          short_code: string
          status?: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          invite_token?: string
          label?: string | null
          percentage?: number
          short_code?: string
          status?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_invites_accepted_by_user_id_fkey"
            columns: ["accepted_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_invites_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          phone: string | null
          push_enabled: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          phone?: string | null
          push_enabled?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          push_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ticket_archive_hides: {
        Row: {
          hidden_at: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          hidden_at?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          hidden_at?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_archive_hides_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_archive_hides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          barcode_raw: string | null
          check_source: string | null
          created_at: string
          draw_date: string
          draw_name: string
          draw_type: string
          fraccion: string | null
          id: string
          last_checked_at: string | null
          number: string
          origin: string
          owner_id: string
          prize_amount_cents: number
          serie: string | null
          status: string
          template_id: string | null
          ticket_price: number
          updated_at: string
        }
        Insert: {
          barcode_raw?: string | null
          check_source?: string | null
          created_at?: string
          draw_date: string
          draw_name: string
          draw_type: string
          fraccion?: string | null
          id?: string
          last_checked_at?: string | null
          number: string
          origin?: string
          owner_id: string
          prize_amount_cents?: number
          serie?: string | null
          status?: string
          template_id?: string | null
          ticket_price?: number
          updated_at?: string
        }
        Update: {
          barcode_raw?: string | null
          check_source?: string | null
          created_at?: string
          draw_date?: string
          draw_name?: string
          draw_type?: string
          fraccion?: string | null
          id?: string
          last_checked_at?: string | null
          number?: string
          origin?: string
          owner_id?: string
          prize_amount_cents?: number
          serie?: string | null
          status?: string
          template_id?: string | null
          ticket_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "draw_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      web_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          p256dh: string
          platform: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          p256dh: string
          platform?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          p256dh?: string
          platform?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_pending_invite: {
        Args: { p_code_or_token: string; p_confirm?: boolean }
        Returns: Json
      }
      cancel_pending_invite: { Args: { p_invite_id: string }; Returns: boolean }
      confirm_prize_received: { Args: { p_ticket_id: string }; Returns: Json }
      create_equal_split_participations: {
        Args: {
          p_owner_participates?: boolean
          p_parts_count: number
          p_ticket_id: string
        }
        Returns: Json
      }
      create_manual_participation: {
        Args: { p_label?: string; p_percentage: number; p_ticket_id: string }
        Returns: string
      }
      create_ticket: {
        Args: {
          p_barcode_raw?: string
          p_draw_date?: string
          p_draw_name?: string
          p_draw_type?: string
          p_fraccion?: string
          p_number: string
          p_origin?: string
          p_serie?: string
          p_template_id?: string
          p_ticket_price?: number
        }
        Returns: string
      }
      is_ticket_owner: { Args: { p_ticket_id: string }; Returns: boolean }
      mark_all_notifications_read: { Args: never; Returns: number }
      record_ticket_prize_check: {
        Args: {
          p_check_source: string
          p_list_status?: string
          p_prize_amount_cents: number
          p_ticket_id: string
        }
        Returns: Json
      }
      reject_pending_invite: {
        Args: { p_code_or_token: string }
        Returns: boolean
      }
      request_payout_confirmation_reminder: {
        Args: { p_ticket_id: string }
        Returns: boolean
      }
      request_share_waiver: { Args: { p_share_id: string }; Returns: boolean }
      respond_share_waiver: {
        Args: { p_accept: boolean; p_share_id: string }
        Returns: boolean
      }
      toggle_archive_ticket: {
        Args: { p_archive: boolean; p_ticket_id: string }
        Returns: boolean
      }
      user_can_access_ticket: {
        Args: { p_ticket_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
