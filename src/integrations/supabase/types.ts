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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          city: string | null
          contact_name: string
          created_at: string
          email: string
          id: string
          lgo_type: string | null
          message: string | null
          pharmacy_name: string
          phone: string | null
          status: string
        }
        Insert: {
          city?: string | null
          contact_name: string
          created_at?: string
          email: string
          id?: string
          lgo_type?: string | null
          message?: string | null
          pharmacy_name: string
          phone?: string | null
          status?: string
        }
        Update: {
          city?: string | null
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          lgo_type?: string | null
          message?: string | null
          pharmacy_name?: string
          phone?: string | null
          status?: string
        }
        Relationships: []
      }
      analysis_history: {
        Row: {
          created_at: string
          has_major_interaction: boolean
          id: string
          interactions_count: number
          medicaments: Json
          metadata: Json | null
          patient_hash: string
          patient_name: string | null
          pharmacy_id: string
          prescription_hash: string
          suggestions_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          has_major_interaction?: boolean
          id?: string
          interactions_count?: number
          medicaments?: Json
          metadata?: Json | null
          patient_hash: string
          patient_name?: string | null
          pharmacy_id: string
          prescription_hash: string
          suggestions_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          has_major_interaction?: boolean
          id?: string
          interactions_count?: number
          medicaments?: Json
          metadata?: Json | null
          patient_hash?: string
          patient_name?: string | null
          pharmacy_id?: string
          prescription_hash?: string
          suggestions_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_history_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          pharmacy_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          pharmacy_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          pharmacy_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      classe_atc: {
        Row: {
          atc_code: string
          created_at: string
          description: string | null
          niveau: number
          nom_classe: string
          parent_code: string | null
        }
        Insert: {
          atc_code: string
          created_at?: string
          description?: string | null
          niveau?: number
          nom_classe: string
          parent_code?: string | null
        }
        Update: {
          atc_code?: string
          created_at?: string
          description?: string | null
          niveau?: number
          nom_classe?: string
          parent_code?: string | null
        }
        Relationships: []
      }
      conseils_associes: {
        Row: {
          conseil: string
          created_at: string
          description: string | null
          id: string
          pathologie_id: string
          priorite: number
        }
        Insert: {
          conseil: string
          created_at?: string
          description?: string | null
          id?: string
          pathologie_id: string
          priorite?: number
        }
        Update: {
          conseil?: string
          created_at?: string
          description?: string | null
          id?: string
          pathologie_id?: string
          priorite?: number
        }
        Relationships: [
          {
            foreignKeyName: "conseils_associes_pathologie_id_fkey"
            columns: ["pathologie_id"]
            isOneToOne: false
            referencedRelation: "pathologies"
            referencedColumns: ["id"]
          },
        ]
      }
      medicaments: {
        Row: {
          atc_code: string | null
          cip_code: string | null
          created_at: string
          dosage: string | null
          forme_galenique: string | null
          id: string
          laboratoire: string | null
          molecule_id: string | null
          nom_commercial: string
        }
        Insert: {
          atc_code?: string | null
          cip_code?: string | null
          created_at?: string
          dosage?: string | null
          forme_galenique?: string | null
          id?: string
          laboratoire?: string | null
          molecule_id?: string | null
          nom_commercial: string
        }
        Update: {
          atc_code?: string | null
          cip_code?: string | null
          created_at?: string
          dosage?: string | null
          forme_galenique?: string | null
          id?: string
          laboratoire?: string | null
          molecule_id?: string | null
          nom_commercial?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicaments_atc_code_fkey"
            columns: ["atc_code"]
            isOneToOne: false
            referencedRelation: "classe_atc"
            referencedColumns: ["atc_code"]
          },
          {
            foreignKeyName: "medicaments_molecule_id_fkey"
            columns: ["molecule_id"]
            isOneToOne: false
            referencedRelation: "molecules"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          classe_therapeutique_id: string | null
          code_atc: string | null
          created_at: string
          effets_secondaires_frequents: string[] | null
          id: string
          indications_principales: string[] | null
          mecanisme_action: string | null
          molecule_active: string
          nom_commercial: string
        }
        Insert: {
          classe_therapeutique_id?: string | null
          code_atc?: string | null
          created_at?: string
          effets_secondaires_frequents?: string[] | null
          id?: string
          indications_principales?: string[] | null
          mecanisme_action?: string | null
          molecule_active: string
          nom_commercial: string
        }
        Update: {
          classe_therapeutique_id?: string | null
          code_atc?: string | null
          created_at?: string
          effets_secondaires_frequents?: string[] | null
          id?: string
          indications_principales?: string[] | null
          mecanisme_action?: string | null
          molecule_active?: string
          nom_commercial?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_classe_therapeutique_id_fkey"
            columns: ["classe_therapeutique_id"]
            isOneToOne: false
            referencedRelation: "therapeutic_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      molecule_pathologie: {
        Row: {
          id: string
          molecule_id: string
          pathologie_id: string
        }
        Insert: {
          id?: string
          molecule_id: string
          pathologie_id: string
        }
        Update: {
          id?: string
          molecule_id?: string
          pathologie_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "molecule_pathologie_molecule_id_fkey"
            columns: ["molecule_id"]
            isOneToOne: false
            referencedRelation: "molecules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "molecule_pathologie_pathologie_id_fkey"
            columns: ["pathologie_id"]
            isOneToOne: false
            referencedRelation: "pathologies"
            referencedColumns: ["id"]
          },
        ]
      }
      molecules: {
        Row: {
          atc_code: string | null
          classe_therapeutique: string | null
          created_at: string
          description: string | null
          id: string
          nom_molecule: string
        }
        Insert: {
          atc_code?: string | null
          classe_therapeutique?: string | null
          created_at?: string
          description?: string | null
          id?: string
          nom_molecule: string
        }
        Update: {
          atc_code?: string | null
          classe_therapeutique?: string | null
          created_at?: string
          description?: string | null
          id?: string
          nom_molecule?: string
        }
        Relationships: []
      }
      otc_suggestions: {
        Row: {
          categorie_produit: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          patient_need_id: string
          priorite: string | null
        }
        Insert: {
          categorie_produit: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          patient_need_id: string
          priorite?: string | null
        }
        Update: {
          categorie_produit?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          patient_need_id?: string
          priorite?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "otc_suggestions_patient_need_id_fkey"
            columns: ["patient_need_id"]
            isOneToOne: false
            referencedRelation: "patient_needs"
            referencedColumns: ["id"]
          },
        ]
      }
      pathologies: {
        Row: {
          categorie: string | null
          created_at: string
          description: string | null
          id: string
          nom_pathologie: string
        }
        Insert: {
          categorie?: string | null
          created_at?: string
          description?: string | null
          id?: string
          nom_pathologie: string
        }
        Update: {
          categorie?: string | null
          created_at?: string
          description?: string | null
          id?: string
          nom_pathologie?: string
        }
        Relationships: []
      }
      patient_needs: {
        Row: {
          besoin: string
          created_at: string
          id: string
          symptom_id: string
        }
        Insert: {
          besoin: string
          created_at?: string
          id?: string
          symptom_id: string
        }
        Update: {
          besoin?: string
          created_at?: string
          id?: string
          symptom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_needs_symptom_id_fkey"
            columns: ["symptom_id"]
            isOneToOne: false
            referencedRelation: "symptoms"
            referencedColumns: ["id"]
          },
        ]
      }
      pharma_questions: {
        Row: {
          contexte_explication: string | null
          created_at: string
          id: string
          priorite: number | null
          question: string
          symptom_id: string
        }
        Insert: {
          contexte_explication?: string | null
          created_at?: string
          id?: string
          priorite?: number | null
          question: string
          symptom_id: string
        }
        Update: {
          contexte_explication?: string | null
          created_at?: string
          id?: string
          priorite?: number | null
          question?: string
          symptom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharma_questions_symptom_id_fkey"
            columns: ["symptom_id"]
            isOneToOne: false
            referencedRelation: "symptoms"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacies: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          name: string
          postal_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name: string
          postal_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          postal_code?: string | null
        }
        Relationships: []
      }
      pharmacy_lgo_config: {
        Row: {
          api_base_url: string
          api_key_encrypted: string | null
          auth_method: string
          created_at: string
          enabled: boolean
          id: string
          last_sync_at: string | null
          lgo_type: string
          pharmacy_id: string
          updated_at: string
        }
        Insert: {
          api_base_url: string
          api_key_encrypted?: string | null
          auth_method?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          lgo_type?: string
          pharmacy_id: string
          updated_at?: string
        }
        Update: {
          api_base_url?: string
          api_key_encrypted?: string | null
          auth_method?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          lgo_type?: string
          pharmacy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_lgo_config_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: true
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_preferences: {
        Row: {
          categories_prioritaires: string[] | null
          created_at: string
          id: string
          marques_partenaires: string[] | null
          pharmacy_id: string
          produits_recommandes: Json | null
          updated_at: string
        }
        Insert: {
          categories_prioritaires?: string[] | null
          created_at?: string
          id?: string
          marques_partenaires?: string[] | null
          pharmacy_id: string
          produits_recommandes?: Json | null
          updated_at?: string
        }
        Update: {
          categories_prioritaires?: string[] | null
          created_at?: string
          id?: string
          marques_partenaires?: string[] | null
          pharmacy_id?: string
          produits_recommandes?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_preferences_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: true
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      produits_complementaires: {
        Row: {
          categorie: string | null
          created_at: string
          description: string | null
          id: string
          pathologie_id: string
          priorite: number
          produit: string
        }
        Insert: {
          categorie?: string | null
          created_at?: string
          description?: string | null
          id?: string
          pathologie_id: string
          priorite?: number
          produit: string
        }
        Update: {
          categorie?: string | null
          created_at?: string
          description?: string | null
          id?: string
          pathologie_id?: string
          priorite?: number
          produit?: string
        }
        Relationships: [
          {
            foreignKeyName: "produits_complementaires_pathologie_id_fkey"
            columns: ["pathologie_id"]
            isOneToOne: false
            referencedRelation: "pathologies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          pharmacy_id: string | null
          role: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          pharmacy_id?: string | null
          role?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          pharmacy_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_usage: {
        Row: {
          created_at: string
          event_type: string
          id: string
          otc_suggestion_id: string | null
          pharmacy_id: string | null
          question_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          otc_suggestion_id?: string | null
          pharmacy_id?: string | null
          question_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          otc_suggestion_id?: string | null
          pharmacy_id?: string | null
          question_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_usage_otc_suggestion_id_fkey"
            columns: ["otc_suggestion_id"]
            isOneToOne: false
            referencedRelation: "otc_suggestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_usage_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_usage_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "pharma_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      regles_ranking: {
        Row: {
          created_at: string
          id: string
          produit_id: string | null
          score_panier: number
          score_pathologie: number
          score_saison: number
        }
        Insert: {
          created_at?: string
          id?: string
          produit_id?: string | null
          score_panier?: number
          score_pathologie?: number
          score_saison?: number
        }
        Update: {
          created_at?: string
          id?: string
          produit_id?: string | null
          score_panier?: number
          score_pathologie?: number
          score_saison?: number
        }
        Relationships: [
          {
            foreignKeyName: "regles_ranking_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits_complementaires"
            referencedColumns: ["id"]
          },
        ]
      }
      symptoms: {
        Row: {
          contexte_id: string
          created_at: string
          frequence_score: number | null
          id: string
          symptome: string
        }
        Insert: {
          contexte_id: string
          created_at?: string
          frequence_score?: number | null
          id?: string
          symptome: string
        }
        Update: {
          contexte_id?: string
          created_at?: string
          frequence_score?: number | null
          id?: string
          symptome?: string
        }
        Relationships: [
          {
            foreignKeyName: "symptoms_contexte_id_fkey"
            columns: ["contexte_id"]
            isOneToOne: false
            referencedRelation: "therapeutic_contexts"
            referencedColumns: ["id"]
          },
        ]
      }
      therapeutic_classes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          nom: string
          systeme_physiologique: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          nom: string
          systeme_physiologique?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
          systeme_physiologique?: string | null
        }
        Relationships: []
      }
      therapeutic_contexts: {
        Row: {
          classe_therapeutique_id: string
          created_at: string
          description: string
          frequence_score: number | null
          id: string
          medication_id: string | null
        }
        Insert: {
          classe_therapeutique_id: string
          created_at?: string
          description: string
          frequence_score?: number | null
          id?: string
          medication_id?: string | null
        }
        Update: {
          classe_therapeutique_id?: string
          created_at?: string
          description?: string
          frequence_score?: number | null
          id?: string
          medication_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "therapeutic_contexts_classe_therapeutique_id_fkey"
            columns: ["classe_therapeutique_id"]
            isOneToOne: false
            referencedRelation: "therapeutic_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapeutic_contexts_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
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
      app_role: "admin" | "preparateur" | "manager"
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
      app_role: ["admin", "preparateur", "manager"],
    },
  },
} as const
