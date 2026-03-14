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
          niveau_1: string | null
          niveau_2: string | null
          niveau_3: string | null
          niveau_4: string | null
          nom_classe: string
          parent_code: string | null
        }
        Insert: {
          atc_code: string
          created_at?: string
          description?: string | null
          niveau?: number
          niveau_1?: string | null
          niveau_2?: string | null
          niveau_3?: string | null
          niveau_4?: string | null
          nom_classe: string
          parent_code?: string | null
        }
        Update: {
          atc_code?: string
          created_at?: string
          description?: string | null
          niveau?: number
          niveau_1?: string | null
          niveau_2?: string | null
          niveau_3?: string | null
          niveau_4?: string | null
          nom_classe?: string
          parent_code?: string | null
        }
        Relationships: []
      }
      conseils_associes: {
        Row: {
          conseil: string
          conseil_code: string | null
          created_at: string
          description: string | null
          id: string
          pathologie_id: string
          priorite: number
        }
        Insert: {
          conseil: string
          conseil_code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          pathologie_id: string
          priorite?: number
        }
        Update: {
          conseil?: string
          conseil_code?: string | null
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
      medicament_pathologie: {
        Row: {
          id: string
          medicament_id: string
          pathologie_id: string
          score_pertinence: number
          source_mapping: string | null
        }
        Insert: {
          id?: string
          medicament_id: string
          pathologie_id: string
          score_pertinence?: number
          source_mapping?: string | null
        }
        Update: {
          id?: string
          medicament_id?: string
          pathologie_id?: string
          score_pertinence?: number
          source_mapping?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicament_pathologie_medicament_id_fkey"
            columns: ["medicament_id"]
            isOneToOne: false
            referencedRelation: "medicaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicament_pathologie_pathologie_id_fkey"
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
          est_eligible_comme_complementaire: boolean | null
          est_otc: boolean | null
          est_produit_conseil: boolean | null
          forme_galenique: string | null
          id: string
          laboratoire: string | null
          molecule_id: string | null
          nom_commercial: string
          statut_officine: string | null
        }
        Insert: {
          atc_code?: string | null
          cip_code?: string | null
          created_at?: string
          dosage?: string | null
          est_eligible_comme_complementaire?: boolean | null
          est_otc?: boolean | null
          est_produit_conseil?: boolean | null
          forme_galenique?: string | null
          id?: string
          laboratoire?: string | null
          molecule_id?: string | null
          nom_commercial: string
          statut_officine?: string | null
        }
        Update: {
          atc_code?: string | null
          cip_code?: string | null
          created_at?: string
          dosage?: string | null
          est_eligible_comme_complementaire?: boolean | null
          est_otc?: boolean | null
          est_produit_conseil?: boolean | null
          forme_galenique?: string | null
          id?: string
          laboratoire?: string | null
          molecule_id?: string | null
          nom_commercial?: string
          statut_officine?: string | null
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
          score_pertinence: number | null
          source_mapping: string | null
        }
        Insert: {
          id?: string
          molecule_id: string
          pathologie_id: string
          score_pertinence?: number | null
          source_mapping?: string | null
        }
        Update: {
          id?: string
          molecule_id?: string
          pathologie_id?: string
          score_pertinence?: number | null
          source_mapping?: string | null
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
          niveau_gravite: number | null
          nom_pathologie: string
          orientation_urgence: boolean | null
        }
        Insert: {
          categorie?: string | null
          created_at?: string
          description?: string | null
          id?: string
          niveau_gravite?: number | null
          nom_pathologie: string
          orientation_urgence?: boolean | null
        }
        Update: {
          categorie?: string | null
          created_at?: string
          description?: string | null
          id?: string
          niveau_gravite?: number | null
          nom_pathologie?: string
          orientation_urgence?: boolean | null
        }
        Relationships: []
      }
      pathology_protocol: {
        Row: {
          conseil: string
          created_at: string
          id: string
          pathologie: string
          priority: number
          produit_1: string
          produit_2: string
          updated_at: string
        }
        Insert: {
          conseil: string
          created_at?: string
          id?: string
          pathologie: string
          priority?: number
          produit_1: string
          produit_2: string
          updated_at?: string
        }
        Update: {
          conseil?: string
          created_at?: string
          id?: string
          pathologie?: string
          priority?: number
          produit_1?: string
          produit_2?: string
          updated_at?: string
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
          est_complement: boolean | null
          est_dispositif_medical: boolean | null
          est_eligible_cross_sell: boolean | null
          est_otc: boolean | null
          id: string
          nom_produit: string | null
          pathologie_id: string
          priorite: number
          produit: string
          type_produit: string | null
        }
        Insert: {
          categorie?: string | null
          created_at?: string
          description?: string | null
          est_complement?: boolean | null
          est_dispositif_medical?: boolean | null
          est_eligible_cross_sell?: boolean | null
          est_otc?: boolean | null
          id?: string
          nom_produit?: string | null
          pathologie_id: string
          priorite?: number
          produit: string
          type_produit?: string | null
        }
        Update: {
          categorie?: string | null
          created_at?: string
          description?: string | null
          est_complement?: boolean | null
          est_dispositif_medical?: boolean | null
          est_eligible_cross_sell?: boolean | null
          est_otc?: boolean | null
          id?: string
          nom_produit?: string | null
          pathologie_id?: string
          priorite?: number
          produit?: string
          type_produit?: string | null
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
      protocole_pathologie: {
        Row: {
          actif: boolean | null
          conseil_1_id: string | null
          conseil_2_id: string | null
          created_at: string
          id: string
          justification_1: string | null
          justification_2: string | null
          justification_3: string | null
          pathologie_id: string
          priorite_produit_1: number | null
          priorite_produit_2: number | null
          priorite_produit_3: number | null
          produit_complementaire_1_id: string | null
          produit_complementaire_2_id: string | null
          produit_complementaire_3_id: string | null
          updated_at: string
          version_protocole: number | null
        }
        Insert: {
          actif?: boolean | null
          conseil_1_id?: string | null
          conseil_2_id?: string | null
          created_at?: string
          id?: string
          justification_1?: string | null
          justification_2?: string | null
          justification_3?: string | null
          pathologie_id: string
          priorite_produit_1?: number | null
          priorite_produit_2?: number | null
          priorite_produit_3?: number | null
          produit_complementaire_1_id?: string | null
          produit_complementaire_2_id?: string | null
          produit_complementaire_3_id?: string | null
          updated_at?: string
          version_protocole?: number | null
        }
        Update: {
          actif?: boolean | null
          conseil_1_id?: string | null
          conseil_2_id?: string | null
          created_at?: string
          id?: string
          justification_1?: string | null
          justification_2?: string | null
          justification_3?: string | null
          pathologie_id?: string
          priorite_produit_1?: number | null
          priorite_produit_2?: number | null
          priorite_produit_3?: number | null
          produit_complementaire_1_id?: string | null
          produit_complementaire_2_id?: string | null
          produit_complementaire_3_id?: string | null
          updated_at?: string
          version_protocole?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "protocole_pathologie_conseil_1_id_fkey"
            columns: ["conseil_1_id"]
            isOneToOne: false
            referencedRelation: "conseils_associes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocole_pathologie_conseil_2_id_fkey"
            columns: ["conseil_2_id"]
            isOneToOne: false
            referencedRelation: "conseils_associes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocole_pathologie_pathologie_id_fkey"
            columns: ["pathologie_id"]
            isOneToOne: false
            referencedRelation: "pathologies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocole_pathologie_produit_complementaire_1_id_fkey"
            columns: ["produit_complementaire_1_id"]
            isOneToOne: false
            referencedRelation: "produits_complementaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocole_pathologie_produit_complementaire_2_id_fkey"
            columns: ["produit_complementaire_2_id"]
            isOneToOne: false
            referencedRelation: "produits_complementaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocole_pathologie_produit_complementaire_3_id_fkey"
            columns: ["produit_complementaire_3_id"]
            isOneToOne: false
            referencedRelation: "produits_complementaires"
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
          pathologie_id: string | null
          produit_id: string | null
          score_clinique: number | null
          score_final: number | null
          score_friction_achat: number | null
          score_officine: number | null
          score_panier: number
          score_pathologie: number
          score_popularite: number | null
          score_saison: number
        }
        Insert: {
          created_at?: string
          id?: string
          pathologie_id?: string | null
          produit_id?: string | null
          score_clinique?: number | null
          score_final?: number | null
          score_friction_achat?: number | null
          score_officine?: number | null
          score_panier?: number
          score_pathologie?: number
          score_popularite?: number | null
          score_saison?: number
        }
        Update: {
          created_at?: string
          id?: string
          pathologie_id?: string | null
          produit_id?: string | null
          score_clinique?: number | null
          score_final?: number | null
          score_friction_achat?: number | null
          score_officine?: number | null
          score_panier?: number
          score_pathologie?: number
          score_popularite?: number | null
          score_saison?: number
        }
        Relationships: [
          {
            foreignKeyName: "regles_ranking_pathologie_id_fkey"
            columns: ["pathologie_id"]
            isOneToOne: false
            referencedRelation: "pathologies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regles_ranking_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits_complementaires"
            referencedColumns: ["id"]
          },
        ]
      }
      symptome_pathologie: {
        Row: {
          id: string
          pathologie_id: string
          score_pertinence: number
          symptome_id: string
        }
        Insert: {
          id?: string
          pathologie_id: string
          score_pertinence?: number
          symptome_id: string
        }
        Update: {
          id?: string
          pathologie_id?: string
          score_pertinence?: number
          symptome_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "symptome_pathologie_pathologie_id_fkey"
            columns: ["pathologie_id"]
            isOneToOne: false
            referencedRelation: "pathologies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "symptome_pathologie_symptome_id_fkey"
            columns: ["symptome_id"]
            isOneToOne: false
            referencedRelation: "symptomes_officine"
            referencedColumns: ["id"]
          },
        ]
      }
      symptomes_officine: {
        Row: {
          created_at: string
          description: string | null
          id: string
          nom_symptome: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          nom_symptome: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          nom_symptome?: string
        }
        Relationships: []
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
