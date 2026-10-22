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
      audit_entries: {
        Row: {
          actor: string | null
          actor_user_id: string | null
          call_guide_id: string | null
          call_id: string | null
          call_item_id: string | null
          created_at: string
          field: string
          from_value: string | null
          id: string
          reason: string | null
          to_value: string | null
        }
        Insert: {
          actor?: string | null
          actor_user_id?: string | null
          call_guide_id?: string | null
          call_id?: string | null
          call_item_id?: string | null
          created_at?: string
          field: string
          from_value?: string | null
          id?: string
          reason?: string | null
          to_value?: string | null
        }
        Update: {
          actor?: string | null
          actor_user_id?: string | null
          call_guide_id?: string | null
          call_id?: string | null
          call_item_id?: string | null
          created_at?: string
          field?: string
          from_value?: string | null
          id?: string
          reason?: string | null
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_entries_call_guide_id_fkey"
            columns: ["call_guide_id"]
            isOneToOne: false
            referencedRelation: "call_guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_entries_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_entries_call_item_id_fkey"
            columns: ["call_item_id"]
            isOneToOne: false
            referencedRelation: "call_items"
            referencedColumns: ["id"]
          },
        ]
      }
      call_guides: {
        Row: {
          acknowledged_by_reviewer: boolean | null
          call_id: string
          channel: Database["public"]["Enums"]["guide_channel"] | null
          created_at: string
          guide_id: string
          id: string
          not_applicable_reason: string | null
          sent: boolean
          sent_at: string | null
          sent_by: string | null
          supplied_url_or_version: string | null
          updated_at: string
          walkthrough_at: string | null
          walkthrough_by: string | null
          walkthrough_notes: string | null
          walkthrough_provided: boolean
        }
        Insert: {
          acknowledged_by_reviewer?: boolean | null
          call_id: string
          channel?: Database["public"]["Enums"]["guide_channel"] | null
          created_at?: string
          guide_id: string
          id?: string
          not_applicable_reason?: string | null
          sent?: boolean
          sent_at?: string | null
          sent_by?: string | null
          supplied_url_or_version?: string | null
          updated_at?: string
          walkthrough_at?: string | null
          walkthrough_by?: string | null
          walkthrough_notes?: string | null
          walkthrough_provided?: boolean
        }
        Update: {
          acknowledged_by_reviewer?: boolean | null
          call_id?: string
          channel?: Database["public"]["Enums"]["guide_channel"] | null
          created_at?: string
          guide_id?: string
          id?: string
          not_applicable_reason?: string | null
          sent?: boolean
          sent_at?: string | null
          sent_by?: string | null
          supplied_url_or_version?: string | null
          updated_at?: string
          walkthrough_at?: string | null
          walkthrough_by?: string | null
          walkthrough_notes?: string | null
          walkthrough_provided?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "call_guides_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_items: {
        Row: {
          acknowledged_by_reviewer: boolean | null
          call_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          demo_practice: boolean
          evidence: string | null
          guide_derived: boolean
          help_text: string | null
          id: string
          issue: string | null
          kind: Database["public"]["Enums"]["item_kind"]
          label: string
          next_action: string | null
          not_applicable_reason: string | null
          required: boolean
          review_outcome: Database["public"]["Enums"]["review_outcome"] | null
          review_send: boolean
          sort_order: number
          staff_demonstrated: boolean
          staff_demonstrated_at: string | null
          staff_demonstrated_by: string | null
          status: Database["public"]["Enums"]["item_status"]
          template_item_id: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_by_reviewer?: boolean | null
          call_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          demo_practice?: boolean
          evidence?: string | null
          guide_derived?: boolean
          help_text?: string | null
          id?: string
          issue?: string | null
          kind: Database["public"]["Enums"]["item_kind"]
          label: string
          next_action?: string | null
          not_applicable_reason?: string | null
          required?: boolean
          review_outcome?: Database["public"]["Enums"]["review_outcome"] | null
          review_send?: boolean
          sort_order?: number
          staff_demonstrated?: boolean
          staff_demonstrated_at?: string | null
          staff_demonstrated_by?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          template_item_id?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_by_reviewer?: boolean | null
          call_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          demo_practice?: boolean
          evidence?: string | null
          guide_derived?: boolean
          help_text?: string | null
          id?: string
          issue?: string | null
          kind?: Database["public"]["Enums"]["item_kind"]
          label?: string
          next_action?: string | null
          not_applicable_reason?: string | null
          required?: boolean
          review_outcome?: Database["public"]["Enums"]["review_outcome"] | null
          review_send?: boolean
          sort_order?: number
          staff_demonstrated?: boolean
          staff_demonstrated_at?: string | null
          staff_demonstrated_by?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          template_item_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_items_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          call_date: string
          client_id: string
          created_at: string
          created_by: string | null
          finished_at: string | null
          follow_up_action: string | null
          follow_up_date: string | null
          follow_up_owner: string | null
          id: string
          notes: string | null
          staff_member: string
          type: Database["public"]["Enums"]["call_type"]
          updated_at: string
        }
        Insert: {
          call_date: string
          client_id: string
          created_at?: string
          created_by?: string | null
          finished_at?: string | null
          follow_up_action?: string | null
          follow_up_date?: string | null
          follow_up_owner?: string | null
          id?: string
          notes?: string | null
          staff_member: string
          type: Database["public"]["Enums"]["call_type"]
          updated_at?: string
        }
        Update: {
          call_date?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          finished_at?: string | null
          follow_up_action?: string | null
          follow_up_date?: string | null
          follow_up_owner?: string | null
          id?: string
          notes?: string | null
          staff_member?: string
          type?: Database["public"]["Enums"]["call_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_context: string | null
          assigned_team_member: string
          business_name: string
          client_name: string
          contact_details: string | null
          created_at: string
          created_by: string | null
          ghl_link: string | null
          id: string
          is_test_record: boolean
          next_call_date: string | null
          next_call_type: Database["public"]["Enums"]["call_type"] | null
          notes: string | null
          test_purpose: string | null
          updated_at: string
        }
        Insert: {
          account_context?: string | null
          assigned_team_member: string
          business_name: string
          client_name: string
          contact_details?: string | null
          created_at?: string
          created_by?: string | null
          ghl_link?: string | null
          id?: string
          is_test_record?: boolean
          next_call_date?: string | null
          next_call_type?: Database["public"]["Enums"]["call_type"] | null
          notes?: string | null
          test_purpose?: string | null
          updated_at?: string
        }
        Update: {
          account_context?: string | null
          assigned_team_member?: string
          business_name?: string
          client_name?: string
          contact_details?: string | null
          created_at?: string
          created_by?: string | null
          ghl_link?: string | null
          id?: string
          is_test_record?: boolean
          next_call_date?: string | null
          next_call_type?: Database["public"]["Enums"]["call_type"] | null
          notes?: string | null
          test_purpose?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      guide_links: {
        Row: {
          document_title: string | null
          document_version: string | null
          id: string
          label: string
          sort_order: number
          updated_at: string
          url: string | null
        }
        Insert: {
          document_title?: string | null
          document_version?: string | null
          id: string
          label: string
          sort_order?: number
          updated_at?: string
          url?: string | null
        }
        Update: {
          document_title?: string | null
          document_version?: string | null
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          call_id: string | null
          created_at: string
          error: string | null
          event_key: string
          id: string
          provider_message_id: string | null
          recipient: string
          status: string
          updated_at: string
        }
        Insert: {
          call_id?: string | null
          created_at?: string
          error?: string | null
          event_key: string
          id?: string
          provider_message_id?: string | null
          recipient: string
          status?: string
          updated_at?: string
        }
        Update: {
          call_id?: string | null
          created_at?: string
          error?: string | null
          event_key?: string
          id?: string
          provider_message_id?: string | null
          recipient?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      template_items: {
        Row: {
          archived: boolean
          demo_practice: boolean
          guide_derived: boolean
          help_text: string | null
          id: string
          kind: Database["public"]["Enums"]["item_kind"]
          label: string
          required: boolean
          review_send: boolean
          sort_order: number
          template_id: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          demo_practice?: boolean
          guide_derived?: boolean
          help_text?: string | null
          id: string
          kind: Database["public"]["Enums"]["item_kind"]
          label: string
          required?: boolean
          review_send?: boolean
          sort_order?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          demo_practice?: boolean
          guide_derived?: boolean
          help_text?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["item_kind"]
          label?: string
          required?: boolean
          review_send?: boolean
          sort_order?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          call_type: Database["public"]["Enums"]["call_type"]
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          call_type: Database["public"]["Enums"]["call_type"]
          description?: string | null
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          call_type?: Database["public"]["Enums"]["call_type"]
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      call_status:
        | "not_started"
        | "in_progress"
        | "needs_followup"
        | "completed"
      call_type: "connection" | "onboarding"
      guide_channel: "email" | "sms" | "in_app" | "call" | "other"
      item_kind: "client_action" | "staff_check"
      item_status: "not_checked" | "done" | "needs_help" | "not_applicable"
      review_outcome:
        | "recorded"
        | "sent"
        | "receipt_confirmed"
        | "failed"
        | "unknown"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
      call_status: [
        "not_started",
        "in_progress",
        "needs_followup",
        "completed",
      ],
      call_type: ["connection", "onboarding"],
      guide_channel: ["email", "sms", "in_app", "call", "other"],
      item_kind: ["client_action", "staff_check"],
      item_status: ["not_checked", "done", "needs_help", "not_applicable"],
      review_outcome: [
        "recorded",
        "sent",
        "receipt_confirmed",
        "failed",
        "unknown",
      ],
    },
  },
} as const
