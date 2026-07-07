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
      accepted_combinations: {
        Row: {
          created_at: string
          id: string
          medicament_source: string | null
          medicaments_analyses: string[]
          pc_accepte: string
          pc_categorie: string | null
          pcs_proposes: string[]
          pharmacy_id: string
          register_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          medicament_source?: string | null
          medicaments_analyses?: string[]
          pc_accepte: string
          pc_categorie?: string | null
          pcs_proposes?: string[]
          pharmacy_id: string
          register_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          medicament_source?: string | null
          medicaments_analyses?: string[]
          pc_accepte?: string
          pc_categorie?: string | null
          pcs_proposes?: string[]
          pharmacy_id?: string
          register_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
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
      admin_2fa_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_2fa_sessions: {
        Row: {
          updated_at: string
          user_id: string
          verified_until: string
        }
        Insert: {
          updated_at?: string
          user_id: string
          verified_until: string
        }
        Update: {
          updated_at?: string
          user_id?: string
          verified_until?: string
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
          pharmacy_id: string
          prescription_hash: string
          register_id: string | null
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
          pharmacy_id: string
          prescription_hash: string
          register_id?: string | null
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
          pharmacy_id?: string
          prescription_hash?: string
          register_id?: string | null
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
          {
            foreignKeyName: "analysis_history_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_registers"
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
          register_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          pharmacy_id?: string | null
          register_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          pharmacy_id?: string | null
          register_id?: string | null
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
          {
            foreignKeyName: "analytics_events_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      basket_context: {
        Row: {
          active: boolean
          blocked_pcs: Json
          created_at: string
          id: string
          pharmacy_id: string
          proposed_pcs: Json
          scanned_medicaments: Json
          selected_pcs: Json
          session_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          blocked_pcs?: Json
          created_at?: string
          id?: string
          pharmacy_id: string
          proposed_pcs?: Json
          scanned_medicaments?: Json
          selected_pcs?: Json
          session_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          blocked_pcs?: Json
          created_at?: string
          id?: string
          pharmacy_id?: string
          proposed_pcs?: Json
          scanned_medicaments?: Json
          selected_pcs?: Json
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "basket_context_pharmacy_id_fkey"
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
      clinical_sources: {
        Row: {
          code: string
          created_at: string
          derniere_synchro: string | null
          id: string
          licence: string
          nom_complet: string
          notes: string | null
          type_source: string
          updated_at: string
          url_attribution: string | null
          url_officielle: string | null
          version_donnees: string | null
        }
        Insert: {
          code: string
          created_at?: string
          derniere_synchro?: string | null
          id?: string
          licence: string
          nom_complet: string
          notes?: string | null
          type_source: string
          updated_at?: string
          url_attribution?: string | null
          url_officielle?: string | null
          version_donnees?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          derniere_synchro?: string | null
          id?: string
          licence?: string
          nom_complet?: string
          notes?: string | null
          type_source?: string
          updated_at?: string
          url_attribution?: string | null
          url_officielle?: string | null
          version_donnees?: string | null
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
          rule_version: number
          source_code: string | null
          source_reference: string | null
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
        }
        Insert: {
          conseil: string
          conseil_code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          pathologie_id: string
          priorite?: number
          rule_version?: number
          source_code?: string | null
          source_reference?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
        }
        Update: {
          conseil?: string
          conseil_code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          pathologie_id?: string
          priorite?: number
          rule_version?: number
          source_code?: string | null
          source_reference?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conseils_associes_pathologie_id_fkey"
            columns: ["pathologie_id"]
            isOneToOne: false
            referencedRelation: "pathologies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conseils_associes_source_code_fkey"
            columns: ["source_code"]
            isOneToOne: false
            referencedRelation: "clinical_sources"
            referencedColumns: ["code"]
          },
        ]
      }
      cross_sell_tracking: {
        Row: {
          created_at: string
          id: string
          match_source: string
          matched_at: string | null
          medicament_id: string | null
          medicament_nom: string
          pathologie_id: string | null
          pathologie_nom: string | null
          pharmacy_id: string
          produit_complementaire_id: string | null
          produit_complementaire_nom: string
          sale_id: string | null
          was_sold: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          match_source?: string
          matched_at?: string | null
          medicament_id?: string | null
          medicament_nom: string
          pathologie_id?: string | null
          pathologie_nom?: string | null
          pharmacy_id: string
          produit_complementaire_id?: string | null
          produit_complementaire_nom: string
          sale_id?: string | null
          was_sold?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          match_source?: string
          matched_at?: string | null
          medicament_id?: string | null
          medicament_nom?: string
          pathologie_id?: string | null
          pathologie_nom?: string | null
          pharmacy_id?: string
          produit_complementaire_id?: string | null
          produit_complementaire_nom?: string
          sale_id?: string | null
          was_sold?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cross_sell_tracking_medicament_id_fkey"
            columns: ["medicament_id"]
            isOneToOne: false
            referencedRelation: "medicaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cross_sell_tracking_pathologie_id_fkey"
            columns: ["pathologie_id"]
            isOneToOne: false
            referencedRelation: "pathologies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cross_sell_tracking_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cross_sell_tracking_produit_complementaire_id_fkey"
            columns: ["produit_complementaire_id"]
            isOneToOne: false
            referencedRelation: "produits_complementaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cross_sell_tracking_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_leads: {
        Row: {
          contacted_at: string | null
          created_at: string
          email: string
          id: string
          nom: string
          notes: string | null
          officine: string
          session_id: string
          status: string
          tracking_link_id: string | null
          updated_at: string
        }
        Insert: {
          contacted_at?: string | null
          created_at?: string
          email: string
          id?: string
          nom: string
          notes?: string | null
          officine: string
          session_id: string
          status?: string
          tracking_link_id?: string | null
          updated_at?: string
        }
        Update: {
          contacted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          nom?: string
          notes?: string | null
          officine?: string
          session_id?: string
          status?: string
          tracking_link_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_leads_tracking_link_id_fkey"
            columns: ["tracking_link_id"]
            isOneToOne: false
            referencedRelation: "tracking_links"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sessions: {
        Row: {
          converted_to_lead: boolean
          created_at: string
          id: string
          ip_city: string | null
          ip_country: string | null
          ordonnance_id: string
          referrer: string | null
          session_id: string
          tracking_link_id: string | null
          user_agent: string | null
        }
        Insert: {
          converted_to_lead?: boolean
          created_at?: string
          id?: string
          ip_city?: string | null
          ip_country?: string | null
          ordonnance_id: string
          referrer?: string | null
          session_id: string
          tracking_link_id?: string | null
          user_agent?: string | null
        }
        Update: {
          converted_to_lead?: boolean
          created_at?: string
          id?: string
          ip_city?: string | null
          ip_country?: string | null
          ordonnance_id?: string
          referrer?: string | null
          session_id?: string
          tracking_link_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_sessions_tracking_link_id_fkey"
            columns: ["tracking_link_id"]
            isOneToOne: false
            referencedRelation: "tracking_links"
            referencedColumns: ["id"]
          },
        ]
      }
      gdpr_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          ip_address: string | null
          notes: string | null
          pharmacy_id: string
          request_type: string
          requested_at: string
          requested_by: string | null
          result_summary: Json | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          pharmacy_id: string
          request_type: string
          requested_at?: string
          requested_by?: string | null
          result_summary?: Json | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          pharmacy_id?: string
          request_type?: string
          requested_at?: string
          requested_by?: string | null
          result_summary?: Json | null
          status?: string
        }
        Relationships: []
      }
      group_alerts: {
        Row: {
          alert_type: string
          created_at: string
          groupement_id: string
          id: string
          message: string
          metadata: Json | null
          pharmacy_id: string | null
          read_at: string | null
          resolved: boolean
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          groupement_id: string
          id?: string
          message: string
          metadata?: Json | null
          pharmacy_id?: string | null
          read_at?: string | null
          resolved?: boolean
          severity?: string
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          groupement_id?: string
          id?: string
          message?: string
          metadata?: Json | null
          pharmacy_id?: string | null
          read_at?: string | null
          resolved?: boolean
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_alerts_groupement_id_fkey"
            columns: ["groupement_id"]
            isOneToOne: false
            referencedRelation: "groupements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_alerts_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      group_product_mapping: {
        Row: {
          active: boolean
          categorie: string
          cip_code: string | null
          created_at: string
          groupement_id: string
          id: string
          laboratoire_partenaire: string | null
          niveau_priorite: number
          notes: string | null
          produit_prioritaire: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          categorie: string
          cip_code?: string | null
          created_at?: string
          groupement_id: string
          id?: string
          laboratoire_partenaire?: string | null
          niveau_priorite?: number
          notes?: string | null
          produit_prioritaire: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          categorie?: string
          cip_code?: string | null
          created_at?: string
          groupement_id?: string
          id?: string
          laboratoire_partenaire?: string | null
          niveau_priorite?: number
          notes?: string | null
          produit_prioritaire?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_product_mapping_groupement_id_fkey"
            columns: ["groupement_id"]
            isOneToOne: false
            referencedRelation: "groupements"
            referencedColumns: ["id"]
          },
        ]
      }
      groupements: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          headquarters_city: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          headquarters_city?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          headquarters_city?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      latent_need_metrics: {
        Row: {
          besoin: string
          created_at: string
          id: string
          impact_score: number | null
          medicament_source: string
          pc_proposed: string
          pharmacy_id: string
          times_converted: number
          times_proposed: number
          updated_at: string
        }
        Insert: {
          besoin: string
          created_at?: string
          id?: string
          impact_score?: number | null
          medicament_source: string
          pc_proposed: string
          pharmacy_id: string
          times_converted?: number
          times_proposed?: number
          updated_at?: string
        }
        Update: {
          besoin?: string
          created_at?: string
          id?: string
          impact_score?: number | null
          medicament_source?: string
          pc_proposed?: string
          pharmacy_id?: string
          times_converted?: number
          times_proposed?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "latent_need_metrics_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      latent_needs: {
        Row: {
          benefice: string | null
          besoin_infere: string
          categorie: string
          created_at: string
          description: string | null
          id: string
          medicament_source: string
          phrase_patient: string | null
          score: number
        }
        Insert: {
          benefice?: string | null
          besoin_infere: string
          categorie: string
          created_at?: string
          description?: string | null
          id?: string
          medicament_source: string
          phrase_patient?: string | null
          score?: number
        }
        Update: {
          benefice?: string | null
          besoin_infere?: string
          categorie?: string
          created_at?: string
          description?: string | null
          id?: string
          medicament_source?: string
          phrase_patient?: string | null
          score?: number
        }
        Relationships: []
      }
      lineage_audit_log: {
        Row: {
          after_data: Json | null
          before_data: Json | null
          changed_by: string | null
          created_at: string
          id: string
          notes: string | null
          operation: string
          record_id: string
          rule_version: number | null
          source_code: string | null
          source_reference: string | null
          table_name: string
        }
        Insert: {
          after_data?: Json | null
          before_data?: Json | null
          changed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          operation: string
          record_id: string
          rule_version?: number | null
          source_code?: string | null
          source_reference?: string | null
          table_name: string
        }
        Update: {
          after_data?: Json | null
          before_data?: Json | null
          changed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          operation?: string
          record_id?: string
          rule_version?: number | null
          source_code?: string | null
          source_reference?: string | null
          table_name?: string
        }
        Relationships: []
      }
      medicament_atc_audit: {
        Row: {
          confidence: string | null
          created_at: string
          current_atc: string | null
          current_class_name: string | null
          id: string
          medicament_id: string
          mismatch: boolean
          nom_commercial: string
          reasoning: string | null
          reviewed: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          suggested_atc: string | null
          suggested_class_name: string | null
          updated_at: string
        }
        Insert: {
          confidence?: string | null
          created_at?: string
          current_atc?: string | null
          current_class_name?: string | null
          id?: string
          medicament_id: string
          mismatch?: boolean
          nom_commercial: string
          reasoning?: string | null
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          suggested_atc?: string | null
          suggested_class_name?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: string | null
          created_at?: string
          current_atc?: string | null
          current_class_name?: string | null
          id?: string
          medicament_id?: string
          mismatch?: boolean
          nom_commercial?: string
          reasoning?: string | null
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          suggested_atc?: string | null
          suggested_class_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicament_atc_audit_medicament_id_fkey"
            columns: ["medicament_id"]
            isOneToOne: true
            referencedRelation: "medicaments"
            referencedColumns: ["id"]
          },
        ]
      }
      medicament_cip: {
        Row: {
          cip13: string
          cis: string | null
          created_at: string
          denomination: string | null
          forme: string | null
          id: string
          medicament_nom: string
          statut: string | null
        }
        Insert: {
          cip13: string
          cis?: string | null
          created_at?: string
          denomination?: string | null
          forme?: string | null
          id?: string
          medicament_nom: string
          statut?: string | null
        }
        Update: {
          cip13?: string
          cis?: string | null
          created_at?: string
          denomination?: string | null
          forme?: string | null
          id?: string
          medicament_nom?: string
          statut?: string | null
        }
        Relationships: []
      }
      medicament_curated_pcs: {
        Row: {
          created_at: string
          medicament_id: string
          pc_1: string | null
          pc_2: string | null
          pertinence_pc1: string | null
          pertinence_pc2: string | null
          phrase_conseil_pc1: string | null
          phrase_conseil_pc2: string | null
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          medicament_id: string
          pc_1?: string | null
          pc_2?: string | null
          pertinence_pc1?: string | null
          pertinence_pc2?: string | null
          phrase_conseil_pc1?: string | null
          phrase_conseil_pc2?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          medicament_id?: string
          pc_1?: string | null
          pc_2?: string | null
          pertinence_pc1?: string | null
          pertinence_pc2?: string | null
          phrase_conseil_pc1?: string | null
          phrase_conseil_pc2?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicament_curated_pcs_medicament_id_fkey"
            columns: ["medicament_id"]
            isOneToOne: true
            referencedRelation: "medicaments"
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
      medicament_pc_mapping: {
        Row: {
          active: boolean
          created_at: string
          id: string
          medicament_nom: string
          pc_categorie: string | null
          pc_nom: string
          pharmacy_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          medicament_nom: string
          pc_categorie?: string | null
          pc_nom: string
          pharmacy_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          medicament_nom?: string
          pc_categorie?: string | null
          pc_nom?: string
          pharmacy_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      medicament_pc_valide: {
        Row: {
          created_at: string
          finalite: string
          id: string
          medicament_id: string
          pc_id: string
          score: number
          source: string
        }
        Insert: {
          created_at?: string
          finalite: string
          id?: string
          medicament_id: string
          pc_id: string
          score?: number
          source?: string
        }
        Update: {
          created_at?: string
          finalite?: string
          id?: string
          medicament_id?: string
          pc_id?: string
          score?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicament_pc_valide_medicament_id_fkey"
            columns: ["medicament_id"]
            isOneToOne: false
            referencedRelation: "medicaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicament_pc_valide_pc_id_fkey"
            columns: ["pc_id"]
            isOneToOne: false
            referencedRelation: "produits_complementaires"
            referencedColumns: ["id"]
          },
        ]
      }
      medicaments: {
        Row: {
          atc_code: string | null
          cible_age: string
          cip_code: string | null
          created_at: string
          dosage: string | null
          est_eligible_comme_complementaire: boolean | null
          est_otc: boolean | null
          est_produit_conseil: boolean | null
          forme_galenique: string | null
          id: string
          imported_at: string | null
          laboratoire: string | null
          molecule_id: string | null
          nom_commercial: string
          posologie: string | null
          source_code: string | null
          source_reference: string | null
          statut_officine: string | null
          voie_administration: string | null
        }
        Insert: {
          atc_code?: string | null
          cible_age?: string
          cip_code?: string | null
          created_at?: string
          dosage?: string | null
          est_eligible_comme_complementaire?: boolean | null
          est_otc?: boolean | null
          est_produit_conseil?: boolean | null
          forme_galenique?: string | null
          id?: string
          imported_at?: string | null
          laboratoire?: string | null
          molecule_id?: string | null
          nom_commercial: string
          posologie?: string | null
          source_code?: string | null
          source_reference?: string | null
          statut_officine?: string | null
          voie_administration?: string | null
        }
        Update: {
          atc_code?: string | null
          cible_age?: string
          cip_code?: string | null
          created_at?: string
          dosage?: string | null
          est_eligible_comme_complementaire?: boolean | null
          est_otc?: boolean | null
          est_produit_conseil?: boolean | null
          forme_galenique?: string | null
          id?: string
          imported_at?: string | null
          laboratoire?: string | null
          molecule_id?: string | null
          nom_commercial?: string
          posologie?: string | null
          source_code?: string | null
          source_reference?: string | null
          statut_officine?: string | null
          voie_administration?: string | null
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
          {
            foreignKeyName: "medicaments_source_code_fkey"
            columns: ["source_code"]
            isOneToOne: false
            referencedRelation: "clinical_sources"
            referencedColumns: ["code"]
          },
        ]
      }
      medication_coverage_audit: {
        Row: {
          completeness_score: number | null
          created_at: string
          has_classe: boolean | null
          has_contextes: boolean | null
          has_pathologie_link: boolean | null
          has_protocole: boolean | null
          has_questions: boolean | null
          has_suggestions_otc: boolean | null
          has_symptomes: boolean | null
          id: string
          last_audit_at: string
          matched_medicament_id: string | null
          matched_molecule_id: string | null
          notes: string | null
          reference_id: string
          status: string
        }
        Insert: {
          completeness_score?: number | null
          created_at?: string
          has_classe?: boolean | null
          has_contextes?: boolean | null
          has_pathologie_link?: boolean | null
          has_protocole?: boolean | null
          has_questions?: boolean | null
          has_suggestions_otc?: boolean | null
          has_symptomes?: boolean | null
          id?: string
          last_audit_at?: string
          matched_medicament_id?: string | null
          matched_molecule_id?: string | null
          notes?: string | null
          reference_id: string
          status?: string
        }
        Update: {
          completeness_score?: number | null
          created_at?: string
          has_classe?: boolean | null
          has_contextes?: boolean | null
          has_pathologie_link?: boolean | null
          has_protocole?: boolean | null
          has_questions?: boolean | null
          has_suggestions_otc?: boolean | null
          has_symptomes?: boolean | null
          id?: string
          last_audit_at?: string
          matched_medicament_id?: string | null
          matched_molecule_id?: string | null
          notes?: string | null
          reference_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_coverage_audit_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "reference_top_300"
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
          rule_version: number
          source_code: string | null
          source_reference: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
        }
        Insert: {
          conseil: string
          created_at?: string
          id?: string
          pathologie: string
          priority?: number
          produit_1: string
          produit_2: string
          rule_version?: number
          source_code?: string | null
          source_reference?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
        }
        Update: {
          conseil?: string
          created_at?: string
          id?: string
          pathologie?: string
          priority?: number
          produit_1?: string
          produit_2?: string
          rule_version?: number
          source_code?: string | null
          source_reference?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pathology_protocol_source_code_fkey"
            columns: ["source_code"]
            isOneToOne: false
            referencedRelation: "clinical_sources"
            referencedColumns: ["code"]
          },
        ]
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
      patient_reminders: {
        Row: {
          analysis_id: string | null
          created_at: string
          id: string
          message: string | null
          patient_hash: string
          patient_name: string | null
          pharmacy_id: string
          phone: string | null
          reminder_date: string
          reminder_type: string
          sent_at: string | null
          status: string
          treatment_end_date: string
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          patient_hash: string
          patient_name?: string | null
          pharmacy_id: string
          phone?: string | null
          reminder_date: string
          reminder_type?: string
          sent_at?: string | null
          status?: string
          treatment_end_date: string
        }
        Update: {
          analysis_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          patient_hash?: string
          patient_name?: string | null
          pharmacy_id?: string
          phone?: string | null
          reminder_date?: string
          reminder_type?: string
          sent_at?: string | null
          status?: string
          treatment_end_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_reminders_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analysis_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_reminders_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pc_audit_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          links_created: number
          links_rejected: number
          new_pcs_created: number
          orphans_filled: number
          pcs_classified: number
          started_at: string
          status: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          links_created?: number
          links_rejected?: number
          new_pcs_created?: number
          orphans_filled?: number
          pcs_classified?: number
          started_at?: string
          status?: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          links_created?: number
          links_rejected?: number
          new_pcs_created?: number
          orphans_filled?: number
          pcs_classified?: number
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      pc_category_pricing: {
        Row: {
          categorie: string
          computed_at: string
          method: string
          nb_pcs_referenced: number | null
          prix_moyen_pondere: number
          volume_total: number | null
        }
        Insert: {
          categorie: string
          computed_at?: string
          method?: string
          nb_pcs_referenced?: number | null
          prix_moyen_pondere: number
          volume_total?: number | null
        }
        Update: {
          categorie?: string
          computed_at?: string
          method?: string
          nb_pcs_referenced?: number | null
          prix_moyen_pondere?: number
          volume_total?: number | null
        }
        Relationships: []
      }
      pc_cip_mapping: {
        Row: {
          categorie: string | null
          code: string
          created_at: string
          id: string
          marque: string | null
          occurrences: number | null
          pc_label: string
          pc_label_norm: string
          produit_reference: string | null
          source: string | null
          statut: string | null
          type_code: string | null
          type_produit: string | null
        }
        Insert: {
          categorie?: string | null
          code: string
          created_at?: string
          id?: string
          marque?: string | null
          occurrences?: number | null
          pc_label: string
          pc_label_norm: string
          produit_reference?: string | null
          source?: string | null
          statut?: string | null
          type_code?: string | null
          type_produit?: string | null
        }
        Update: {
          categorie?: string | null
          code?: string
          created_at?: string
          id?: string
          marque?: string | null
          occurrences?: number | null
          pc_label?: string
          pc_label_norm?: string
          produit_reference?: string | null
          source?: string | null
          statut?: string | null
          type_code?: string | null
          type_produit?: string | null
        }
        Relationships: []
      }
      pc_feedback: {
        Row: {
          action: string
          analysis_id: string | null
          created_at: string
          detection_source: string
          id: string
          medicament_nom: string
          pc_categorie: string | null
          pc_nom: string
          pharmacy_id: string
          reason: string | null
          register_id: string | null
          user_id: string
        }
        Insert: {
          action?: string
          analysis_id?: string | null
          created_at?: string
          detection_source?: string
          id?: string
          medicament_nom: string
          pc_categorie?: string | null
          pc_nom: string
          pharmacy_id: string
          reason?: string | null
          register_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          analysis_id?: string | null
          created_at?: string
          detection_source?: string
          id?: string
          medicament_nom?: string
          pc_categorie?: string | null
          pc_nom?: string
          pharmacy_id?: string
          reason?: string | null
          register_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pc_feedback_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analysis_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pc_feedback_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pc_feedback_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      pc_pricing: {
        Row: {
          categorie: string | null
          cip13: string | null
          id: string
          notes: string | null
          pc_nom: string
          pc_nom_normalise: string
          prix_max_ttc: number | null
          prix_min_ttc: number | null
          prix_unitaire_ttc: number
          source: string
          updated_at: string
          volume_pondere: number | null
        }
        Insert: {
          categorie?: string | null
          cip13?: string | null
          id?: string
          notes?: string | null
          pc_nom: string
          pc_nom_normalise: string
          prix_max_ttc?: number | null
          prix_min_ttc?: number | null
          prix_unitaire_ttc: number
          source?: string
          updated_at?: string
          volume_pondere?: number | null
        }
        Update: {
          categorie?: string | null
          cip13?: string | null
          id?: string
          notes?: string | null
          pc_nom?: string
          pc_nom_normalise?: string
          prix_max_ttc?: number | null
          prix_min_ttc?: number | null
          prix_unitaire_ttc?: number
          source?: string
          updated_at?: string
          volume_pondere?: number | null
        }
        Relationships: []
      }
      pending_cross_sell: {
        Row: {
          device_id: string | null
          expires_at: string
          id: string
          matched_at: string | null
          matched_cip: string | null
          matched_nom: string | null
          medicament_id: string | null
          medicament_nom: string
          pathologie_id: string | null
          pathologie_nom: string | null
          pc_cip: string | null
          pc_name: string
          pc_normalized: string
          pharmacy_id: string
          proposed_at: string
        }
        Insert: {
          device_id?: string | null
          expires_at?: string
          id?: string
          matched_at?: string | null
          matched_cip?: string | null
          matched_nom?: string | null
          medicament_id?: string | null
          medicament_nom: string
          pathologie_id?: string | null
          pathologie_nom?: string | null
          pc_cip?: string | null
          pc_name: string
          pc_normalized: string
          pharmacy_id: string
          proposed_at?: string
        }
        Update: {
          device_id?: string | null
          expires_at?: string
          id?: string
          matched_at?: string | null
          matched_cip?: string | null
          matched_nom?: string | null
          medicament_id?: string | null
          medicament_nom?: string
          pathologie_id?: string | null
          pathologie_nom?: string | null
          pc_cip?: string | null
          pc_name?: string
          pc_normalized?: string
          pharmacy_id?: string
          proposed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_cross_sell_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
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
          groupement_id: string | null
          id: string
          name: string
          postal_code: string | null
          status: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          groupement_id?: string | null
          id?: string
          name: string
          postal_code?: string | null
          status?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          groupement_id?: string | null
          id?: string
          name?: string
          postal_code?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacies_groupement_id_fkey"
            columns: ["groupement_id"]
            isOneToOne: false
            referencedRelation: "groupements"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_benchmark: {
        Row: {
          avg_analyses_per_day: number
          avg_pc_per_analysis: number
          conversion_rate: number
          created_at: string
          id: string
          period: string
          period_start: string
          pharmacy_id: string
          top_categories: Json
          total_analyses: number
          total_pc_proposed: number
          total_pc_sold: number
          updated_at: string
        }
        Insert: {
          avg_analyses_per_day?: number
          avg_pc_per_analysis?: number
          conversion_rate?: number
          created_at?: string
          id?: string
          period?: string
          period_start: string
          pharmacy_id: string
          top_categories?: Json
          total_analyses?: number
          total_pc_proposed?: number
          total_pc_sold?: number
          updated_at?: string
        }
        Update: {
          avg_analyses_per_day?: number
          avg_pc_per_analysis?: number
          conversion_rate?: number
          created_at?: string
          id?: string
          period?: string
          period_start?: string
          pharmacy_id?: string
          top_categories?: Json
          total_analyses?: number
          total_pc_proposed?: number
          total_pc_sold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_benchmark_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_instance_heartbeats: {
        Row: {
          app_version: string | null
          first_seen_at: string
          id: string
          instance_id: string
          last_scan_at: string | null
          last_seen_at: string
          pharmacy_id: string
          platform: string
          scanner_status: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          first_seen_at?: string
          id?: string
          instance_id: string
          last_scan_at?: string | null
          last_seen_at?: string
          pharmacy_id: string
          platform?: string
          scanner_status?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          first_seen_at?: string
          id?: string
          instance_id?: string
          last_scan_at?: string | null
          last_seen_at?: string
          pharmacy_id?: string
          platform?: string
          scanner_status?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pharmacy_lgo_config: {
        Row: {
          api_base_url: string
          api_key: string | null
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
          api_key?: string | null
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
          api_key?: string | null
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
      pharmacy_quotas: {
        Row: {
          created_at: string
          current_daily_analyses: number
          current_monthly_ai_calls: number
          daily_analyses_limit: number
          last_reset_daily: string
          last_reset_monthly: string
          max_upload_size_mb: number
          monthly_ai_calls_limit: number
          notes: string | null
          over_limit_count: number
          pharmacy_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_daily_analyses?: number
          current_monthly_ai_calls?: number
          daily_analyses_limit?: number
          last_reset_daily?: string
          last_reset_monthly?: string
          max_upload_size_mb?: number
          monthly_ai_calls_limit?: number
          notes?: string | null
          over_limit_count?: number
          pharmacy_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_daily_analyses?: number
          current_monthly_ai_calls?: number
          daily_analyses_limit?: number
          last_reset_daily?: string
          last_reset_monthly?: string
          max_upload_size_mb?: number
          monthly_ai_calls_limit?: number
          notes?: string | null
          over_limit_count?: number
          pharmacy_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      pharmacy_registers: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          device_id: string | null
          id: string
          label: string
          pharmacy_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          id?: string
          label?: string
          pharmacy_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          id?: string
          label?: string
          pharmacy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_registers_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_scanner_keys: {
        Row: {
          active: boolean
          api_key: string
          created_at: string
          id: string
          label: string | null
          pharmacy_id: string
        }
        Insert: {
          active?: boolean
          api_key?: string
          created_at?: string
          id?: string
          label?: string | null
          pharmacy_id: string
        }
        Update: {
          active?: boolean
          api_key?: string
          created_at?: string
          id?: string
          label?: string | null
          pharmacy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_scanner_keys_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_mapping: {
        Row: {
          active: boolean
          categorie: string
          cip_code: string | null
          created_at: string
          id: string
          pharmacy_id: string
          produit_selectionne: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          categorie: string
          cip_code?: string | null
          created_at?: string
          id?: string
          pharmacy_id: string
          produit_selectionne: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          categorie?: string
          cip_code?: string | null
          created_at?: string
          id?: string
          pharmacy_id?: string
          produit_selectionne?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_mapping_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      produit_complementaire_ranking: {
        Row: {
          created_at: string
          id: string
          pathologie_id: string
          produit_id: string
          score_clinique: number
          score_cross_sell: number
          score_final: number | null
          score_pertinence_pathologie: number
          score_popularite: number
          score_saisonnalite: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          pathologie_id: string
          produit_id: string
          score_clinique?: number
          score_cross_sell?: number
          score_final?: number | null
          score_pertinence_pathologie?: number
          score_popularite?: number
          score_saisonnalite?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          pathologie_id?: string
          produit_id?: string
          score_clinique?: number
          score_cross_sell?: number
          score_final?: number | null
          score_pertinence_pathologie?: number
          score_popularite?: number
          score_saisonnalite?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produit_complementaire_ranking_pathologie_id_fkey"
            columns: ["pathologie_id"]
            isOneToOne: false
            referencedRelation: "pathologies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produit_complementaire_ranking_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits_complementaires"
            referencedColumns: ["id"]
          },
        ]
      }
      produits_complementaires: {
        Row: {
          categorie: string | null
          cible_age: string[]
          created_at: string
          description: string | null
          est_complement: boolean | null
          est_dispositif_medical: boolean | null
          est_eligible_cross_sell: boolean | null
          est_otc: boolean | null
          finalite: string | null
          finalite_audited_at: string | null
          id: string
          medicament_id: string | null
          nom_produit: string | null
          pathologie_id: string | null
          phrase_conseil: string | null
          priorite: number
          produit: string
          rule_version: number
          source_code: string | null
          source_reference: string | null
          trigger_atc_prefixes: string[] | null
          type_produit: string | null
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
        }
        Insert: {
          categorie?: string | null
          cible_age?: string[]
          created_at?: string
          description?: string | null
          est_complement?: boolean | null
          est_dispositif_medical?: boolean | null
          est_eligible_cross_sell?: boolean | null
          est_otc?: boolean | null
          finalite?: string | null
          finalite_audited_at?: string | null
          id?: string
          medicament_id?: string | null
          nom_produit?: string | null
          pathologie_id?: string | null
          phrase_conseil?: string | null
          priorite?: number
          produit: string
          rule_version?: number
          source_code?: string | null
          source_reference?: string | null
          trigger_atc_prefixes?: string[] | null
          type_produit?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
        }
        Update: {
          categorie?: string | null
          cible_age?: string[]
          created_at?: string
          description?: string | null
          est_complement?: boolean | null
          est_dispositif_medical?: boolean | null
          est_eligible_cross_sell?: boolean | null
          est_otc?: boolean | null
          finalite?: string | null
          finalite_audited_at?: string | null
          id?: string
          medicament_id?: string | null
          nom_produit?: string | null
          pathologie_id?: string | null
          phrase_conseil?: string | null
          priorite?: number
          produit?: string
          rule_version?: number
          source_code?: string | null
          source_reference?: string | null
          trigger_atc_prefixes?: string[] | null
          type_produit?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produits_complementaires_medicament_id_fkey"
            columns: ["medicament_id"]
            isOneToOne: false
            referencedRelation: "medicaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produits_complementaires_pathologie_id_fkey"
            columns: ["pathologie_id"]
            isOneToOne: false
            referencedRelation: "pathologies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produits_complementaires_source_code_fkey"
            columns: ["source_code"]
            isOneToOne: false
            referencedRelation: "clinical_sources"
            referencedColumns: ["code"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          managed_groupement_id: string | null
          onboarding_completed: boolean
          pharmacy_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          managed_groupement_id?: string | null
          onboarding_completed?: boolean
          pharmacy_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          managed_groupement_id?: string | null
          onboarding_completed?: boolean
          pharmacy_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_managed_groupement_id_fkey"
            columns: ["managed_groupement_id"]
            isOneToOne: false
            referencedRelation: "groupements"
            referencedColumns: ["id"]
          },
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
      recommendation_metrics: {
        Row: {
          conversion_rate: number | null
          created_at: string
          id: string
          medicament_source: string
          pc_categorie: string | null
          pc_proposed: string
          pharmacy_id: string
          register_id: string | null
          times_clicked: number
          times_displayed: number
          times_proposed: number
          times_scanned: number
          times_sold: number
          updated_at: string
        }
        Insert: {
          conversion_rate?: number | null
          created_at?: string
          id?: string
          medicament_source: string
          pc_categorie?: string | null
          pc_proposed: string
          pharmacy_id: string
          register_id?: string | null
          times_clicked?: number
          times_displayed?: number
          times_proposed?: number
          times_scanned?: number
          times_sold?: number
          updated_at?: string
        }
        Update: {
          conversion_rate?: number | null
          created_at?: string
          id?: string
          medicament_source?: string
          pc_categorie?: string | null
          pc_proposed?: string
          pharmacy_id?: string
          register_id?: string | null
          times_clicked?: number
          times_displayed?: number
          times_proposed?: number
          times_scanned?: number
          times_sold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_metrics_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_metrics_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_registers"
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
      reference_top_300: {
        Row: {
          atc5_code: string
          classe_therapeutique: string | null
          created_at: string
          id: string
          molecule: string
          nom_commercial_ref: string | null
          rang: number
          source: string | null
          updated_at: string
          volume_annuel: number | null
        }
        Insert: {
          atc5_code: string
          classe_therapeutique?: string | null
          created_at?: string
          id?: string
          molecule: string
          nom_commercial_ref?: string | null
          rang: number
          source?: string | null
          updated_at?: string
          volume_annuel?: number | null
        }
        Update: {
          atc5_code?: string
          classe_therapeutique?: string | null
          created_at?: string
          id?: string
          molecule?: string
          nom_commercial_ref?: string | null
          rang?: number
          source?: string | null
          updated_at?: string
          volume_annuel?: number | null
        }
        Relationships: []
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
      rgpd_processing_register: {
        Row: {
          active: boolean
          base_legale: string
          categories_donnees: string
          categories_personnes: string
          created_at: string
          destinataires: string
          duree_conservation: string
          finalite: string
          id: string
          mesures_securite: string
          nom_traitement: string
          notes: string | null
          ordre: number
          transferts_hors_ue: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_legale: string
          categories_donnees: string
          categories_personnes: string
          created_at?: string
          destinataires: string
          duree_conservation: string
          finalite: string
          id?: string
          mesures_securite: string
          nom_traitement: string
          notes?: string | null
          ordre?: number
          transferts_hors_ue?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_legale?: string
          categories_donnees?: string
          categories_personnes?: string
          created_at?: string
          destinataires?: string
          duree_conservation?: string
          finalite?: string
          id?: string
          mesures_securite?: string
          nom_traitement?: string
          notes?: string | null
          ordre?: number
          transferts_hors_ue?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sales_attribution_monthly: {
        Row: {
          category: string
          clicked_count: number
          computed_at: string
          hid_auto_count: number
          id: string
          inferred_count: number
          month: string
          pharmacy_id: string
          proposed_count: number
          revenue_estimate: number
          total_attributed: number
        }
        Insert: {
          category?: string
          clicked_count?: number
          computed_at?: string
          hid_auto_count?: number
          id?: string
          inferred_count?: number
          month: string
          pharmacy_id: string
          proposed_count?: number
          revenue_estimate?: number
          total_attributed?: number
        }
        Update: {
          category?: string
          clicked_count?: number
          computed_at?: string
          hid_auto_count?: number
          id?: string
          inferred_count?: number
          month?: string
          pharmacy_id?: string
          proposed_count?: number
          revenue_estimate?: number
          total_attributed?: number
        }
        Relationships: []
      }
      sales_transactions: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          items: Json
          pharmacy_id: string
          source: string
          total_items: number
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          items?: Json
          pharmacy_id: string
          source?: string
          total_items?: number
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          items?: Json
          pharmacy_id?: string
          source?: string
          total_items?: number
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_transactions_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_events: {
        Row: {
          created_at: string
          ean_code: string
          error_message: string | null
          id: string
          metadata: Json | null
          pharmacy_id: string | null
          product_name: string | null
          register_id: string | null
          status: string
          suggestions_count: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          ean_code: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          pharmacy_id?: string | null
          product_name?: string | null
          register_id?: string | null
          status: string
          suggestions_count?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          ean_code?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          pharmacy_id?: string | null
          product_name?: string | null
          register_id?: string | null
          status?: string
          suggestions_count?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_events_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_queue: {
        Row: {
          created_at: string
          device_id: string | null
          ean_code: string | null
          id: string
          input_data: Json
          pharmacy_id: string
          processed_at: string | null
          result: Json | null
          scan_type: string
          source: string
          status: string
          wwks2_source_id: number | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          ean_code?: string | null
          id?: string
          input_data?: Json
          pharmacy_id: string
          processed_at?: string | null
          result?: Json | null
          scan_type?: string
          source?: string
          status?: string
          wwks2_source_id?: number | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          ean_code?: string | null
          id?: string
          input_data?: Json
          pharmacy_id?: string
          processed_at?: string | null
          result?: Json | null
          scan_type?: string
          source?: string
          status?: string
          wwks2_source_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_queue_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      signalements: {
        Row: {
          admin_notes: string | null
          commentaire: string | null
          context: Json | null
          created_at: string
          id: string
          medicament_nom: string
          pc_categorie: string | null
          pc_nom: string | null
          pharmacy_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          commentaire?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          medicament_nom: string
          pc_categorie?: string | null
          pc_nom?: string | null
          pharmacy_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          commentaire?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          medicament_nom?: string
          pc_categorie?: string | null
          pc_nom?: string | null
          pharmacy_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      tracking_clicks: {
        Row: {
          created_at: string
          device_type: string | null
          id: string
          ip_city: string | null
          ip_country: string | null
          is_unique: boolean
          link_id: string
          referrer: string | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          id?: string
          ip_city?: string | null
          ip_country?: string | null
          is_unique?: boolean
          link_id: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          device_type?: string | null
          id?: string
          ip_city?: string | null
          ip_country?: string | null
          is_unique?: boolean
          link_id?: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracking_clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "tracking_links"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_links: {
        Row: {
          campaign: string | null
          clicks_count: number
          created_at: string
          created_by: string | null
          demos_count: number
          destination: string
          expires_at: string | null
          id: string
          is_active: boolean
          label: string
          leads_count: number
          slug: string
          unique_clicks_count: number
          updated_at: string
        }
        Insert: {
          campaign?: string | null
          clicks_count?: number
          created_at?: string
          created_by?: string | null
          demos_count?: number
          destination?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label: string
          leads_count?: number
          slug: string
          unique_clicks_count?: number
          updated_at?: string
        }
        Update: {
          campaign?: string | null
          clicks_count?: number
          created_at?: string
          created_by?: string | null
          demos_count?: number
          destination?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string
          leads_count?: number
          slug?: string
          unique_clicks_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      unmatched_medicaments: {
        Row: {
          first_seen_at: string
          id: string
          last_seen_at: string
          nom_normalise: string
          nom_saisi: string
          notes: string | null
          occurrence_count: number
          pharmacy_id: string | null
          status: string
        }
        Insert: {
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          nom_normalise: string
          nom_saisi: string
          notes?: string | null
          occurrence_count?: number
          pharmacy_id?: string | null
          status?: string
        }
        Update: {
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          nom_normalise?: string
          nom_saisi?: string
          notes?: string | null
          occurrence_count?: number
          pharmacy_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "unmatched_medicaments_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
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
      user_shortcuts: {
        Row: {
          created_at: string
          shortcuts: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          shortcuts?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          shortcuts?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_clinical_lineage: {
        Row: {
          created_at: string | null
          pathologie_id: string | null
          rule_id: string | null
          rule_label: string | null
          rule_type: string | null
          rule_version: number | null
          source_code: string | null
          source_derniere_synchro: string | null
          source_licence: string | null
          source_nom: string | null
          source_reference: string | null
          validated_at: string | null
          validated_by: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_and_increment_quota: {
        Args: { _pharmacy_id: string; _quota_type: string }
        Returns: Json
      }
      current_user_pharmacy_id: { Args: never; Returns: string }
      get_medicaments_coverage_stats: { Args: never; Returns: Json }
      get_pharmacy_connection_counts: {
        Args: never
        Returns: {
          connected_instances: number
          connected_users: number
          desktop_instances: number
          last_activity: string
          pharmacy_id: string
          web_instances: number
        }[]
      }
      get_top_produits: {
        Args: { p_limit?: number; p_pathologie_id: string }
        Returns: {
          categorie: string
          description: string
          produit: string
          produit_id: string
          score_final: number
          type_produit: string
        }[]
      }
      get_user_managed_groupement: {
        Args: { _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_2fa_verified: { Args: never; Returns: boolean }
      is_pharmacy_active: { Args: { _user_id: string }; Returns: boolean }
      wipe_asclion_base: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "preparateur" | "manager" | "group_manager"
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
      app_role: ["admin", "preparateur", "manager", "group_manager"],
    },
  },
} as const
