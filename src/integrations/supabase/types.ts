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
      match_events: {
        Row: {
          action: string
          assist_no: string | null
          clock: string | null
          defense: string | null
          fast_break: boolean | null
          goal_x: number | null
          goal_y: number | null
          half: number | null
          id: string
          involver_no: string | null
          match_id: string
          miss_zone: string | null
          player_no: string | null
          rebound_no: string | null
          rebound_team: number | null
          subtype: string | null
          team: number | null
          ts: number
          x: number | null
          y: number | null
          zone: string | null
        }
        Insert: {
          action: string
          assist_no?: string | null
          clock?: string | null
          defense?: string | null
          fast_break?: boolean | null
          goal_x?: number | null
          goal_y?: number | null
          half?: number | null
          id?: string
          involver_no?: string | null
          match_id: string
          miss_zone?: string | null
          player_no?: string | null
          rebound_no?: string | null
          rebound_team?: number | null
          subtype?: string | null
          team?: number | null
          ts: number
          x?: number | null
          y?: number | null
          zone?: string | null
        }
        Update: {
          action?: string
          assist_no?: string | null
          clock?: string | null
          defense?: string | null
          fast_break?: boolean | null
          goal_x?: number | null
          goal_y?: number | null
          half?: number | null
          id?: string
          involver_no?: string | null
          match_id?: string
          miss_zone?: string | null
          player_no?: string | null
          rebound_no?: string | null
          rebound_team?: number | null
          subtype?: string | null
          team?: number | null
          ts?: number
          x?: number | null
          y?: number | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          city: string | null
          competition: string | null
          country: string | null
          created_at: string
          date: string | null
          finished_at: string
          half_length: number | null
          halves: number | null
          id: string
          score1: number
          score2: number
          season: string | null
          shootout1: number | null
          shootout2: number | null
          team1_color: string | null
          team1_id: string | null
          team1_name: string
          team1_snapshot: Json
          team2_color: string | null
          team2_id: string | null
          team2_name: string
          team2_snapshot: Json
          venue: string | null
        }
        Insert: {
          city?: string | null
          competition?: string | null
          country?: string | null
          created_at?: string
          date?: string | null
          finished_at?: string
          half_length?: number | null
          halves?: number | null
          id?: string
          score1?: number
          score2?: number
          season?: string | null
          shootout1?: number | null
          shootout2?: number | null
          team1_color?: string | null
          team1_id?: string | null
          team1_name: string
          team1_snapshot: Json
          team2_color?: string | null
          team2_id?: string | null
          team2_name: string
          team2_snapshot: Json
          venue?: string | null
        }
        Update: {
          city?: string | null
          competition?: string | null
          country?: string | null
          created_at?: string
          date?: string | null
          finished_at?: string
          half_length?: number | null
          halves?: number | null
          id?: string
          score1?: number
          score2?: number
          season?: string | null
          shootout1?: number | null
          shootout2?: number | null
          team1_color?: string | null
          team1_id?: string | null
          team1_name?: string
          team1_snapshot?: Json
          team2_color?: string | null
          team2_id?: string | null
          team2_name?: string
          team2_snapshot?: Json
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_bonuses: {
        Row: {
          bonus_08: number
          bonus_10: number
          team_name: string
          updated_at: string
        }
        Insert: {
          bonus_08?: number
          bonus_10?: number
          team_name: string
          updated_at?: string
        }
        Update: {
          bonus_08?: number
          bonus_10?: number
          team_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_players: {
        Row: {
          add_info: string | null
          captain: boolean | null
          height: string | null
          id: string
          name: string | null
          no: string
          playing: boolean | null
          position: string | null
          surname: string | null
          team_id: string
        }
        Insert: {
          add_info?: string | null
          captain?: boolean | null
          height?: string | null
          id?: string
          name?: string | null
          no: string
          playing?: boolean | null
          position?: string | null
          surname?: string | null
          team_id: string
        }
        Update: {
          add_info?: string | null
          captain?: boolean | null
          height?: string | null
          id?: string
          name?: string | null
          no?: string
          playing?: boolean | null
          position?: string | null
          surname?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          name_key: string
          short_name: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          name_key: string
          short_name?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          name_key?: string
          short_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tournament_settings: {
        Row: {
          key: string
          points_draw: number
          points_loss: number
          points_win: number
          updated_at: string
        }
        Insert: {
          key: string
          points_draw?: number
          points_loss?: number
          points_win?: number
          updated_at?: string
        }
        Update: {
          key?: string
          points_draw?: number
          points_loss?: number
          points_win?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
