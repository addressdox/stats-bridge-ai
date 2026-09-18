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
      answers: {
        Row: {
          ai_explanation: string | null
          ai_model: string | null
          ai_provider: string | null
          api_version: string
          case_id: string | null
          caveats: string[]
          channel: Database["public"]["Enums"]["channel"]
          clarification: Json | null
          created_at: string
          follow_ups: string[]
          gap_description: string | null
          guideline_id: string | null
          id: string
          is_demo_seed: boolean
          language: string
          latency_ms: number | null
          official_blocks: Json
          outcome: Database["public"]["Enums"]["answer_outcome"]
          parent_answer_id: string | null
          prompt_version: string | null
          public_ref: string
          question_text: string
          reading_level: Database["public"]["Enums"]["reading_level"]
          review_flag: Database["public"]["Enums"]["review_flag"]
          review_flag_reason: string | null
          review_reasons: Database["public"]["Enums"]["review_reason"][]
          site_id: string | null
          topic: string | null
          validation_result: Json
        }
        Insert: {
          ai_explanation?: string | null
          ai_model?: string | null
          ai_provider?: string | null
          api_version?: string
          case_id?: string | null
          caveats?: string[]
          channel?: Database["public"]["Enums"]["channel"]
          clarification?: Json | null
          created_at?: string
          follow_ups?: string[]
          gap_description?: string | null
          guideline_id?: string | null
          id?: string
          is_demo_seed?: boolean
          language?: string
          latency_ms?: number | null
          official_blocks?: Json
          outcome: Database["public"]["Enums"]["answer_outcome"]
          parent_answer_id?: string | null
          prompt_version?: string | null
          public_ref: string
          question_text: string
          reading_level?: Database["public"]["Enums"]["reading_level"]
          review_flag?: Database["public"]["Enums"]["review_flag"]
          review_flag_reason?: string | null
          review_reasons?: Database["public"]["Enums"]["review_reason"][]
          site_id?: string | null
          topic?: string | null
          validation_result?: Json
        }
        Update: {
          ai_explanation?: string | null
          ai_model?: string | null
          ai_provider?: string | null
          api_version?: string
          case_id?: string | null
          caveats?: string[]
          channel?: Database["public"]["Enums"]["channel"]
          clarification?: Json | null
          created_at?: string
          follow_ups?: string[]
          gap_description?: string | null
          guideline_id?: string | null
          id?: string
          is_demo_seed?: boolean
          language?: string
          latency_ms?: number | null
          official_blocks?: Json
          outcome?: Database["public"]["Enums"]["answer_outcome"]
          parent_answer_id?: string | null
          prompt_version?: string | null
          public_ref?: string
          question_text?: string
          reading_level?: Database["public"]["Enums"]["reading_level"]
          review_flag?: Database["public"]["Enums"]["review_flag"]
          review_flag_reason?: string | null
          review_reasons?: Database["public"]["Enums"]["review_reason"][]
          site_id?: string | null
          topic?: string | null
          validation_result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "answers_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_guideline_id_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "guidelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_parent_answer_id_fkey"
            columns: ["parent_answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "widget_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          approval_basis: Database["public"]["Enums"]["approval_basis"]
          approved_at: string
          approved_by: string
          case_id: string
          draft_id: string
          fingerprint: string
          guideline_id: string
          id: string
          source_version_ids: string[]
          status: Database["public"]["Enums"]["approval_status"]
          void_reason: Database["public"]["Enums"]["void_reason"] | null
          voided_at: string | null
        }
        Insert: {
          approval_basis?: Database["public"]["Enums"]["approval_basis"]
          approved_at?: string
          approved_by: string
          case_id: string
          draft_id: string
          fingerprint: string
          guideline_id: string
          id?: string
          source_version_ids?: string[]
          status?: Database["public"]["Enums"]["approval_status"]
          void_reason?: Database["public"]["Enums"]["void_reason"] | null
          voided_at?: string | null
        }
        Update: {
          approval_basis?: Database["public"]["Enums"]["approval_basis"]
          approved_at?: string
          approved_by?: string
          case_id?: string
          draft_id?: string
          fingerprint?: string
          guideline_id?: string
          id?: string
          source_version_ids?: string[]
          status?: Database["public"]["Enums"]["approval_status"]
          void_reason?: Database["public"]["Enums"]["void_reason"] | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_guideline_id_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "guidelines"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          case_id: string | null
          detail: Json
          entity_id: string | null
          entity_kind: string
          from_state: string | null
          id: string
          occurred_at: string
          origin: Database["public"]["Enums"]["audit_origin"]
          to_state: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          case_id?: string | null
          detail?: Json
          entity_id?: string | null
          entity_kind: string
          from_state?: string | null
          id?: string
          occurred_at?: string
          origin?: Database["public"]["Enums"]["audit_origin"]
          to_state?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          case_id?: string | null
          detail?: Json
          entity_id?: string | null
          entity_kind?: string
          from_state?: string | null
          id?: string
          occurred_at?: string
          origin?: Database["public"]["Enums"]["audit_origin"]
          to_state?: string | null
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
            foreignKeyName: "audit_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          approved_at: string | null
          assigned_to: string | null
          channel: Database["public"]["Enums"]["channel"]
          closed_reason: string | null
          contact_consent: boolean
          contact_erase_after: string | null
          created_at: string
          deadline_at: string | null
          first_draft_at: string | null
          follow_up_of_case_id: string | null
          id: string
          is_demo_seed: boolean
          kind: Database["public"]["Enums"]["case_kind"]
          notice_version: string | null
          origin_answer_id: string | null
          question_text: string
          received_at: string
          reference: string
          released_at: string | null
          requester_contact: string | null
          requester_name: string | null
          requester_outlet: string | null
          review_reasons: Database["public"]["Enums"]["review_reason"][]
          routing_corrected_by: string | null
          routing_note: string | null
          status: Database["public"]["Enums"]["case_status"]
          status_token_hash: string
        }
        Insert: {
          approved_at?: string | null
          assigned_to?: string | null
          channel?: Database["public"]["Enums"]["channel"]
          closed_reason?: string | null
          contact_consent?: boolean
          contact_erase_after?: string | null
          created_at?: string
          deadline_at?: string | null
          first_draft_at?: string | null
          follow_up_of_case_id?: string | null
          id?: string
          is_demo_seed?: boolean
          kind: Database["public"]["Enums"]["case_kind"]
          notice_version?: string | null
          origin_answer_id?: string | null
          question_text: string
          received_at?: string
          reference: string
          released_at?: string | null
          requester_contact?: string | null
          requester_name?: string | null
          requester_outlet?: string | null
          review_reasons: Database["public"]["Enums"]["review_reason"][]
          routing_corrected_by?: string | null
          routing_note?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          status_token_hash: string
        }
        Update: {
          approved_at?: string | null
          assigned_to?: string | null
          channel?: Database["public"]["Enums"]["channel"]
          closed_reason?: string | null
          contact_consent?: boolean
          contact_erase_after?: string | null
          created_at?: string
          deadline_at?: string | null
          first_draft_at?: string | null
          follow_up_of_case_id?: string | null
          id?: string
          is_demo_seed?: boolean
          kind?: Database["public"]["Enums"]["case_kind"]
          notice_version?: string | null
          origin_answer_id?: string | null
          question_text?: string
          received_at?: string
          reference?: string
          released_at?: string | null
          requester_contact?: string | null
          requester_name?: string | null
          requester_outlet?: string | null
          review_reasons?: Database["public"]["Enums"]["review_reason"][]
          routing_corrected_by?: string | null
          routing_note?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          status_token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_follow_up_of_case_id_fkey"
            columns: ["follow_up_of_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_origin_answer_fk"
            columns: ["origin_answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_routing_corrected_by_fkey"
            columns: ["routing_corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          adapted_from_memory_item_id: string | null
          ai_model: string | null
          ai_provider: string | null
          author_id: string | null
          author_kind: Database["public"]["Enums"]["author_kind"]
          body: string
          case_id: string
          created_at: string
          fingerprint: string
          format: Database["public"]["Enums"]["draft_format"]
          gaps: string[]
          guideline_id: string
          id: string
          instruction: string | null
          parts: Json
          prompt_version: string | null
          reading_level: Database["public"]["Enums"]["reading_level"]
          version_number: number
        }
        Insert: {
          adapted_from_memory_item_id?: string | null
          ai_model?: string | null
          ai_provider?: string | null
          author_id?: string | null
          author_kind: Database["public"]["Enums"]["author_kind"]
          body: string
          case_id: string
          created_at?: string
          fingerprint: string
          format?: Database["public"]["Enums"]["draft_format"]
          gaps?: string[]
          guideline_id: string
          id?: string
          instruction?: string | null
          parts?: Json
          prompt_version?: string | null
          reading_level?: Database["public"]["Enums"]["reading_level"]
          version_number: number
        }
        Update: {
          adapted_from_memory_item_id?: string | null
          ai_model?: string | null
          ai_provider?: string | null
          author_id?: string | null
          author_kind?: Database["public"]["Enums"]["author_kind"]
          body?: string
          case_id?: string
          created_at?: string
          fingerprint?: string
          format?: Database["public"]["Enums"]["draft_format"]
          gaps?: string[]
          guideline_id?: string
          id?: string
          instruction?: string | null
          parts?: Json
          prompt_version?: string | null
          reading_level?: Database["public"]["Enums"]["reading_level"]
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "drafts_adapted_from_memory_item_id_fkey"
            columns: ["adapted_from_memory_item_id"]
            isOneToOne: false
            referencedRelation: "memory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_guideline_id_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "guidelines"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_links: {
        Row: {
          created_at: string
          id: string
          observation_id: string | null
          owner_id: string
          owner_kind: Database["public"]["Enums"]["evidence_owner"]
          passage_id: string | null
          source_version_id: string
          statement: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          observation_id?: string | null
          owner_id: string
          owner_kind: Database["public"]["Enums"]["evidence_owner"]
          passage_id?: string | null
          source_version_id: string
          statement?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          observation_id?: string | null
          owner_id?: string
          owner_kind?: Database["public"]["Enums"]["evidence_owner"]
          passage_id?: string | null
          source_version_id?: string
          statement?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_links_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_links_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_links_source_version_id_fkey"
            columns: ["source_version_id"]
            isOneToOne: false
            referencedRelation: "source_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      guidelines: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          approval_basis: Database["public"]["Enums"]["approval_basis"]
          branding_rules: string | null
          created_at: string
          created_by: string | null
          id: string
          messaging_rules: string | null
          number_rules: string | null
          retired_at: string | null
          status: Database["public"]["Enums"]["guideline_status"]
          style_rules: string | null
          terminology: Json
          title: string
          version_number: number
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          approval_basis?: Database["public"]["Enums"]["approval_basis"]
          branding_rules?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          messaging_rules?: string | null
          number_rules?: string | null
          retired_at?: string | null
          status?: Database["public"]["Enums"]["guideline_status"]
          style_rules?: string | null
          terminology?: Json
          title: string
          version_number: number
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          approval_basis?: Database["public"]["Enums"]["approval_basis"]
          branding_rules?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          messaging_rules?: string | null
          number_rules?: string | null
          retired_at?: string | null
          status?: Database["public"]["Enums"]["guideline_status"]
          style_rules?: string | null
          terminology?: Json
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "guidelines_activated_by_fkey"
            columns: ["activated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guidelines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_items: {
        Row: {
          approval_basis: Database["public"]["Enums"]["approval_basis"]
          audience: Database["public"]["Enums"]["audience"]
          body: string
          communicated_on: string
          created_at: string
          created_by: string | null
          id: string
          is_demo_seed: boolean
          item_type: Database["public"]["Enums"]["memory_type"]
          origin: Database["public"]["Enums"]["memory_origin"]
          original_url: string | null
          reference_period: string | null
          release_id: string | null
          reuse_status: Database["public"]["Enums"]["reuse_status"]
          review_flag_reason: string | null
          search_text: unknown
          title: string
          topic: string | null
        }
        Insert: {
          approval_basis?: Database["public"]["Enums"]["approval_basis"]
          audience?: Database["public"]["Enums"]["audience"]
          body: string
          communicated_on: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo_seed?: boolean
          item_type: Database["public"]["Enums"]["memory_type"]
          origin: Database["public"]["Enums"]["memory_origin"]
          original_url?: string | null
          reference_period?: string | null
          release_id?: string | null
          reuse_status?: Database["public"]["Enums"]["reuse_status"]
          review_flag_reason?: string | null
          search_text?: unknown
          title: string
          topic?: string | null
        }
        Update: {
          approval_basis?: Database["public"]["Enums"]["approval_basis"]
          audience?: Database["public"]["Enums"]["audience"]
          body?: string
          communicated_on?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo_seed?: boolean
          item_type?: Database["public"]["Enums"]["memory_type"]
          origin?: Database["public"]["Enums"]["memory_origin"]
          original_url?: string | null
          reference_period?: string | null
          release_id?: string | null
          reuse_status?: Database["public"]["Enums"]["reuse_status"]
          review_flag_reason?: string | null
          search_text?: unknown
          title?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memory_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_release_fk"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      observations: {
        Row: {
          adjustment: string | null
          comparability_note: string | null
          created_at: string
          display_value: string
          geography: string
          id: string
          measure: string
          measure_key: string
          page_number: number | null
          passage_id: string | null
          period_end: string | null
          period_start: string | null
          population: string | null
          reference_period: string
          reported_change: string | null
          source_version_id: string
          table_label: string | null
          unit: string
          value: number | null
          value_state: Database["public"]["Enums"]["value_state"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          adjustment?: string | null
          comparability_note?: string | null
          created_at?: string
          display_value: string
          geography: string
          id?: string
          measure: string
          measure_key: string
          page_number?: number | null
          passage_id?: string | null
          period_end?: string | null
          period_start?: string | null
          population?: string | null
          reference_period: string
          reported_change?: string | null
          source_version_id: string
          table_label?: string | null
          unit: string
          value?: number | null
          value_state: Database["public"]["Enums"]["value_state"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          adjustment?: string | null
          comparability_note?: string | null
          created_at?: string
          display_value?: string
          geography?: string
          id?: string
          measure?: string
          measure_key?: string
          page_number?: number | null
          passage_id?: string | null
          period_end?: string | null
          period_start?: string | null
          population?: string | null
          reference_period?: string
          reported_change?: string | null
          source_version_id?: string
          table_label?: string | null
          unit?: string
          value?: number | null
          value_state?: Database["public"]["Enums"]["value_state"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "observations_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_source_version_id_fkey"
            columns: ["source_version_id"]
            isOneToOne: false
            referencedRelation: "source_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      passages: {
        Row: {
          content: string
          created_at: string
          id: string
          page_number: number | null
          position: number
          search_text: unknown
          section_label: string | null
          source_version_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          page_number?: number | null
          position: number
          search_text?: unknown
          section_label?: string | null
          source_version_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          page_number?: number | null
          position?: number
          search_text?: unknown
          section_label?: string | null
          source_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "passages_source_version_id_fkey"
            columns: ["source_version_id"]
            isOneToOne: false
            referencedRelation: "source_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          is_active: boolean
          is_demo: boolean
          role: Database["public"]["Enums"]["staff_role"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          full_name: string
          id: string
          is_active?: boolean
          is_demo?: boolean
          role: Database["public"]["Enums"]["staff_role"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          is_demo?: boolean
          role?: Database["public"]["Enums"]["staff_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_counters: {
        Row: {
          count: number
          key_hash: string
          window_start: string
        }
        Insert: {
          count?: number
          key_hash: string
          window_start: string
        }
        Update: {
          count?: number
          key_hash?: string
          window_start?: string
        }
        Relationships: []
      }
      releases: {
        Row: {
          approval_id: string
          case_id: string
          channel: Database["public"]["Enums"]["release_channel"]
          delivery_state: Database["public"]["Enums"]["delivery_state"]
          draft_id: string
          id: string
          memory_item_id: string | null
          released_at: string
          released_body: string
          released_by: string
          released_references: Json
        }
        Insert: {
          approval_id: string
          case_id: string
          channel?: Database["public"]["Enums"]["release_channel"]
          delivery_state?: Database["public"]["Enums"]["delivery_state"]
          draft_id: string
          id?: string
          memory_item_id?: string | null
          released_at?: string
          released_body: string
          released_by: string
          released_references?: Json
        }
        Update: {
          approval_id?: string
          case_id?: string
          channel?: Database["public"]["Enums"]["release_channel"]
          delivery_state?: Database["public"]["Enums"]["delivery_state"]
          draft_id?: string
          id?: string
          memory_item_id?: string | null
          released_at?: string
          released_body?: string
          released_by?: string
          released_references?: Json
        }
        Relationships: [
          {
            foreignKeyName: "releases_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "releases_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "releases_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "releases_memory_item_id_fkey"
            columns: ["memory_item_id"]
            isOneToOne: false
            referencedRelation: "memory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "releases_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      source_versions: {
        Row: {
          approval_basis: Database["public"]["Enums"]["approval_basis"] | null
          approved_at: string | null
          approved_by: string | null
          change_note: string | null
          created_at: string
          created_by: string | null
          file_fingerprint: string | null
          file_path: string | null
          id: string
          ingest_note: string | null
          ingest_state: Database["public"]["Enums"]["ingest_state"]
          original_url: string | null
          page_count: number | null
          published_on: string | null
          reference_period: string | null
          source_id: string
          status: Database["public"]["Enums"]["source_status"]
          supersedes_version_id: string | null
          version_label: string
          withdrawal_reason: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        Insert: {
          approval_basis?: Database["public"]["Enums"]["approval_basis"] | null
          approved_at?: string | null
          approved_by?: string | null
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          file_fingerprint?: string | null
          file_path?: string | null
          id?: string
          ingest_note?: string | null
          ingest_state?: Database["public"]["Enums"]["ingest_state"]
          original_url?: string | null
          page_count?: number | null
          published_on?: string | null
          reference_period?: string | null
          source_id: string
          status?: Database["public"]["Enums"]["source_status"]
          supersedes_version_id?: string | null
          version_label: string
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Update: {
          approval_basis?: Database["public"]["Enums"]["approval_basis"] | null
          approved_at?: string | null
          approved_by?: string | null
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          file_fingerprint?: string | null
          file_path?: string | null
          id?: string
          ingest_note?: string | null
          ingest_state?: Database["public"]["Enums"]["ingest_state"]
          original_url?: string | null
          page_count?: number | null
          published_on?: string | null
          reference_period?: string | null
          source_id?: string
          status?: Database["public"]["Enums"]["source_status"]
          supersedes_version_id?: string | null
          version_label?: string
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_versions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_versions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_versions_supersedes_version_id_fkey"
            columns: ["supersedes_version_id"]
            isOneToOne: false
            referencedRelation: "source_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_versions_withdrawn_by_fkey"
            columns: ["withdrawn_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          audience: Database["public"]["Enums"]["audience"]
          canonical_url: string | null
          created_at: string
          created_by: string | null
          current_version_id: string | null
          id: string
          publisher: string
          source_type: Database["public"]["Enums"]["source_type"]
          title: string
          topic: string | null
        }
        Insert: {
          audience?: Database["public"]["Enums"]["audience"]
          canonical_url?: string | null
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          id?: string
          publisher?: string
          source_type: Database["public"]["Enums"]["source_type"]
          title: string
          topic?: string | null
        }
        Update: {
          audience?: Database["public"]["Enums"]["audience"]
          canonical_url?: string | null
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          id?: string
          publisher?: string
          source_type?: Database["public"]["Enums"]["source_type"]
          title?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "source_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      widget_sites: {
        Row: {
          accent_colour: string | null
          allowed_origins: string[]
          created_at: string
          default_language: string | null
          id: string
          is_active: boolean
          name: string
          opening_text: string | null
          position: string | null
          site_key: string
        }
        Insert: {
          accent_colour?: string | null
          allowed_origins?: string[]
          created_at?: string
          default_language?: string | null
          id?: string
          is_active?: boolean
          name: string
          opening_text?: string | null
          position?: string | null
          site_key: string
        }
        Update: {
          accent_colour?: string | null
          allowed_origins?: string[]
          created_at?: string
          default_language?: string | null
          id?: string
          is_active?: boolean
          name?: string
          opening_text?: string | null
          position?: string | null
          site_key?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_staff_role: {
        Args: { _role: Database["public"]["Enums"]["staff_role"]; _uid: string }
        Returns: boolean
      }
      is_staff: { Args: { _uid: string }; Returns: boolean }
      staff_role_of: {
        Args: { _uid: string }
        Returns: Database["public"]["Enums"]["staff_role"]
      }
    }
    Enums: {
      answer_outcome:
        | "answered"
        | "clarification"
        | "gap"
        | "escalated"
        | "error"
      approval_basis: "official" | "demonstration"
      approval_status: "active" | "void"
      audience: "public" | "staff"
      audit_origin: "screen" | "api" | "system"
      author_kind: "ai" | "official"
      case_kind: "media" | "public_escalation"
      case_status:
        | "received"
        | "draft_prepared"
        | "in_review"
        | "changes_requested"
        | "approved"
        | "released"
        | "rejected"
      channel: "web" | "widget" | "api"
      delivery_state: "shown" | "queued" | "sent" | "failed"
      draft_format: "general_reply" | "faq_answer" | "short_media_statement"
      evidence_owner: "answer" | "draft" | "memory_item"
      guideline_status: "draft" | "active" | "retired"
      ingest_state: "waiting" | "done" | "failed"
      memory_origin: "imported" | "released_case"
      memory_type:
        | "media_response"
        | "press_release"
        | "official_statement"
        | "faq"
        | "other_messaging"
      reading_level: "short" | "detailed"
      release_channel: "status_page" | "email"
      reuse_status:
        | "reusable"
        | "needs_review"
        | "historical_only"
        | "withdrawn"
      review_flag: "none" | "source_changed"
      review_reason:
        | "media"
        | "sensitive"
        | "complex"
        | "interpretation"
        | "formal_approval"
        | "ambiguous"
        | "low_confidence"
        | "gap"
      source_status:
        | "pending"
        | "approved"
        | "rejected"
        | "superseded"
        | "withdrawn"
      source_type:
        | "statistical_release"
        | "media_release"
        | "methodology"
        | "organisational_page"
        | "faq_page"
        | "other"
      staff_role: "official" | "administrator" | "manager"
      value_state: "reported" | "missing" | "suppressed" | "not_applicable"
      void_reason:
        | "edited"
        | "source_withdrawn"
        | "source_superseded"
        | "manual"
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
      answer_outcome: [
        "answered",
        "clarification",
        "gap",
        "escalated",
        "error",
      ],
      approval_basis: ["official", "demonstration"],
      approval_status: ["active", "void"],
      audience: ["public", "staff"],
      audit_origin: ["screen", "api", "system"],
      author_kind: ["ai", "official"],
      case_kind: ["media", "public_escalation"],
      case_status: [
        "received",
        "draft_prepared",
        "in_review",
        "changes_requested",
        "approved",
        "released",
        "rejected",
      ],
      channel: ["web", "widget", "api"],
      delivery_state: ["shown", "queued", "sent", "failed"],
      draft_format: ["general_reply", "faq_answer", "short_media_statement"],
      evidence_owner: ["answer", "draft", "memory_item"],
      guideline_status: ["draft", "active", "retired"],
      ingest_state: ["waiting", "done", "failed"],
      memory_origin: ["imported", "released_case"],
      memory_type: [
        "media_response",
        "press_release",
        "official_statement",
        "faq",
        "other_messaging",
      ],
      reading_level: ["short", "detailed"],
      release_channel: ["status_page", "email"],
      reuse_status: [
        "reusable",
        "needs_review",
        "historical_only",
        "withdrawn",
      ],
      review_flag: ["none", "source_changed"],
      review_reason: [
        "media",
        "sensitive",
        "complex",
        "interpretation",
        "formal_approval",
        "ambiguous",
        "low_confidence",
        "gap",
      ],
      source_status: [
        "pending",
        "approved",
        "rejected",
        "superseded",
        "withdrawn",
      ],
      source_type: [
        "statistical_release",
        "media_release",
        "methodology",
        "organisational_page",
        "faq_page",
        "other",
      ],
      staff_role: ["official", "administrator", "manager"],
      value_state: ["reported", "missing", "suppressed", "not_applicable"],
      void_reason: [
        "edited",
        "source_withdrawn",
        "source_superseded",
        "manual",
      ],
    },
  },
} as const
