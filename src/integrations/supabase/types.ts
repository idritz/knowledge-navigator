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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          checkin_date: string | null
          checkout_date: string | null
          confirm_deadline: string | null
          created_at: string
          crop_type: string
          driver_id: string | null
          duration_days: number | null
          facility_id: string | null
          farmer_id: string
          id: string
          price_quoted: number
          status: Database["public"]["Enums"]["booking_status"]
          type: Database["public"]["Enums"]["booking_type"]
          updated_at: string
          volume_crates: number
        }
        Insert: {
          checkin_date?: string | null
          checkout_date?: string | null
          confirm_deadline?: string | null
          created_at?: string
          crop_type: string
          driver_id?: string | null
          duration_days?: number | null
          facility_id?: string | null
          farmer_id: string
          id?: string
          price_quoted?: number
          status?: Database["public"]["Enums"]["booking_status"]
          type: Database["public"]["Enums"]["booking_type"]
          updated_at?: string
          volume_crates: number
        }
        Update: {
          checkin_date?: string | null
          checkout_date?: string | null
          confirm_deadline?: string | null
          created_at?: string
          crop_type?: string
          driver_id?: string | null
          duration_days?: number | null
          facility_id?: string | null
          farmer_id?: string
          id?: string
          price_quoted?: number
          status?: Database["public"]["Enums"]["booking_status"]
          type?: Database["public"]["Enums"]["booking_type"]
          updated_at?: string
          volume_crates?: number
        }
        Relationships: [
          {
            foreignKeyName: "bookings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "storage_facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone_number: string | null
          rating_avg: number
          region: string | null
          role: Database["public"]["Enums"]["user_role"]
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone_number?: string | null
          rating_avg?: number
          region?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone_number?: string | null
          rating_avg?: number
          region?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: []
      }
      storage_facilities: {
        Row: {
          address_text: string
          available_capacity_crates: number
          created_at: string
          id: string
          name: string
          owner_id: string
          power_source: Database["public"]["Enums"]["power_source"]
          price_per_crate_per_day: number
          status: Database["public"]["Enums"]["facility_status"]
          total_capacity_crates: number
          updated_at: string
          verification_status: Database["public"]["Enums"]["facility_verification_status"]
        }
        Insert: {
          address_text: string
          available_capacity_crates: number
          created_at?: string
          id?: string
          name: string
          owner_id: string
          power_source?: Database["public"]["Enums"]["power_source"]
          price_per_crate_per_day: number
          status?: Database["public"]["Enums"]["facility_status"]
          total_capacity_crates: number
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["facility_verification_status"]
        }
        Update: {
          address_text?: string
          available_capacity_crates?: number
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          power_source?: Database["public"]["Enums"]["power_source"]
          price_per_crate_per_day?: number
          status?: Database["public"]["Enums"]["facility_status"]
          total_capacity_crates?: number
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["facility_verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "storage_facilities_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          availability_status: Database["public"]["Enums"]["vehicle_availability"]
          capacity_kg: number
          created_at: string
          driver_id: string
          home_region: string
          id: string
          updated_at: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          verification_status: Database["public"]["Enums"]["facility_verification_status"]
        }
        Insert: {
          availability_status?: Database["public"]["Enums"]["vehicle_availability"]
          capacity_kg: number
          created_at?: string
          driver_id: string
          home_region: string
          id?: string
          updated_at?: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          verification_status?: Database["public"]["Enums"]["facility_verification_status"]
        }
        Update: {
          availability_status?: Database["public"]["Enums"]["vehicle_availability"]
          capacity_kg?: number
          created_at?: string
          driver_id?: string
          home_region?: string
          id?: string
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
          verification_status?: Database["public"]["Enums"]["facility_verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
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
      adjust_facility_capacity: {
        Args: { _delta: number; _facility_id: string }
        Returns: number
      }
    }
    Enums: {
      booking_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "disputed"
      booking_type: "storage" | "transport"
      facility_status: "active" | "paused"
      facility_verification_status: "pending" | "verified" | "rejected"
      power_source: "solar" | "grid" | "hybrid"
      user_role: "farmer" | "driver" | "facility_owner" | "admin"
      vehicle_availability: "available" | "on_job" | "offline"
      vehicle_type: "motorcycle" | "van" | "truck"
      verification_status: "unverified" | "pending" | "verified" | "rejected"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      booking_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "disputed",
      ],
      booking_type: ["storage", "transport"],
      facility_status: ["active", "paused"],
      facility_verification_status: ["pending", "verified", "rejected"],
      power_source: ["solar", "grid", "hybrid"],
      user_role: ["farmer", "driver", "facility_owner", "admin"],
      vehicle_availability: ["available", "on_job", "offline"],
      vehicle_type: ["motorcycle", "van", "truck"],
      verification_status: ["unverified", "pending", "verified", "rejected"],
    },
  },
} as const
