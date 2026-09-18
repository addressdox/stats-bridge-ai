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
            foreignKeyName: "answers_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "insight_turnaround"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "answers_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "review_queue"
            referencedColumns: ["case_id"]
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
            foreignKeyName: "approvals_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "insight_turnaround"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "approvals_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "review_queue"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "approvals_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "review_queue"
            referencedColumns: ["latest_draft_id"]
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
          {
            foreignKeyName: "audit_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "insight_turnaround"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "audit_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "review_queue"
            referencedColumns: ["case_id"]
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
            foreignKeyName: "cases_follow_up_of_case_id_fkey"
            columns: ["follow_up_of_case_id"]
            isOneToOne: false
            referencedRelation: "insight_turnaround"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "cases_follow_up_of_case_id_fkey"
            columns: ["follow_up_of_case_id"]
            isOneToOne: false
            referencedRelation: "review_queue"
            referencedColumns: ["case_id"]
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
      conversation_analysis: {
        Row: {
          conversation_id: string
          created_at: string
          key_points: string[]
          resolved: boolean
          sentiment: Database["public"]["Enums"]["sentiment_label"]
          summary: string
          topic: string | null
          unmet_need: string | null
          urgency: Database["public"]["Enums"]["urgency_level"]
        }
        Insert: {
          conversation_id: string
          created_at?: string
          key_points?: string[]
          resolved?: boolean
          sentiment?: Database["public"]["Enums"]["sentiment_label"]
          summary: string
          topic?: string | null
          unmet_need?: string | null
          urgency?: Database["public"]["Enums"]["urgency_level"]
        }
        Update: {
          conversation_id?: string
          created_at?: string
          key_points?: string[]
          resolved?: boolean
          sentiment?: Database["public"]["Enums"]["sentiment_label"]
          summary?: string
          topic?: string | null
          unmet_need?: string | null
          urgency?: Database["public"]["Enums"]["urgency_level"]
        }
        Relationships: [
          {
            foreignKeyName: "conversation_analysis_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_turns: {
        Row: {
          answer_id: string | null
          author: Database["public"]["Enums"]["turn_author"]
          author_profile_id: string | null
          body: string
          conversation_id: string
          created_at: string
          id: string
          outcome: Database["public"]["Enums"]["answer_outcome"] | null
          spoken: boolean
          tools_used: string[]
        }
        Insert: {
          answer_id?: string | null
          author: Database["public"]["Enums"]["turn_author"]
          author_profile_id?: string | null
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          outcome?: Database["public"]["Enums"]["answer_outcome"] | null
          spoken?: boolean
          tools_used?: string[]
        }
        Update: {
          answer_id?: string | null
          author?: Database["public"]["Enums"]["turn_author"]
          author_profile_id?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          outcome?: Database["public"]["Enums"]["answer_outcome"] | null
          spoken?: boolean
          tools_used?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "conversation_turns_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_turns_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_turns_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          channel: Database["public"]["Enums"]["conversation_channel"]
          created_at: string
          device: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          is_demo: boolean
          language: string
          page_url: string | null
          started_at: string
          state: Database["public"]["Enums"]["conversation_state"]
          turn_count: number
          updated_at: string
          visitor_id: string | null
        }
        Insert: {
          channel?: Database["public"]["Enums"]["conversation_channel"]
          created_at?: string
          device?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_demo?: boolean
          language?: string
          page_url?: string | null
          started_at?: string
          state?: Database["public"]["Enums"]["conversation_state"]
          turn_count?: number
          updated_at?: string
          visitor_id?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["conversation_channel"]
          created_at?: string
          device?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_demo?: boolean
          language?: string
          page_url?: string | null
          started_at?: string
          state?: Database["public"]["Enums"]["conversation_state"]
          turn_count?: number
          updated_at?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
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
            foreignKeyName: "drafts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "insight_turnaround"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "drafts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "review_queue"
            referencedColumns: ["case_id"]
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
      handoff_events: {
        Row: {
          action: string
          actor_profile_id: string | null
          created_at: string
          detail: string | null
          handoff_id: string
          id: string
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          created_at?: string
          detail?: string | null
          handoff_id: string
          id?: string
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          created_at?: string
          detail?: string | null
          handoff_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "handoff_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoff_events_handoff_id_fkey"
            columns: ["handoff_id"]
            isOneToOne: false
            referencedRelation: "handoffs"
            referencedColumns: ["id"]
          },
        ]
      }
      handoffs: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          case_id: string | null
          closed_at: string | null
          conversation_id: string
          decline_reason: string | null
          declined_at: string | null
          declined_by: string | null
          id: string
          is_demo: boolean
          reason: Database["public"]["Enums"]["handoff_reason"]
          requested_at: string
          state: Database["public"]["Enums"]["handoff_state"]
          summary: string
          topic: string | null
          transferred_at: string | null
          transferred_to: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency_level"]
          visitor_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          case_id?: string | null
          closed_at?: string | null
          conversation_id: string
          decline_reason?: string | null
          declined_at?: string | null
          declined_by?: string | null
          id?: string
          is_demo?: boolean
          reason?: Database["public"]["Enums"]["handoff_reason"]
          requested_at?: string
          state?: Database["public"]["Enums"]["handoff_state"]
          summary: string
          topic?: string | null
          transferred_at?: string | null
          transferred_to?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
          visitor_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          case_id?: string | null
          closed_at?: string | null
          conversation_id?: string
          decline_reason?: string | null
          declined_at?: string | null
          declined_by?: string | null
          id?: string
          is_demo?: boolean
          reason?: Database["public"]["Enums"]["handoff_reason"]
          requested_at?: string
          state?: Database["public"]["Enums"]["handoff_state"]
          summary?: string
          topic?: string | null
          transferred_at?: string | null
          transferred_to?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "handoffs_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "insight_turnaround"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "handoffs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "review_queue"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "handoffs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_declined_by_fkey"
            columns: ["declined_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_transferred_to_fkey"
            columns: ["transferred_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_embeddings: {
        Row: {
          content: string
          created_at: string
          embedding: string
          id: string
          model: string
          owner_id: string
          owner_kind: Database["public"]["Enums"]["embedding_owner"]
          source_version_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          embedding: string
          id?: string
          model: string
          owner_id: string
          owner_kind: Database["public"]["Enums"]["embedding_owner"]
          source_version_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string
          id?: string
          model?: string
          owner_id?: string
          owner_kind?: Database["public"]["Enums"]["embedding_owner"]
          source_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_embeddings_source_version_id_fkey"
            columns: ["source_version_id"]
            isOneToOne: false
            referencedRelation: "source_versions"
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
            referencedRelation: "decision_record"
            referencedColumns: ["release_id"]
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
            foreignKeyName: "releases_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "insight_turnaround"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "releases_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "review_queue"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "releases_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "releases_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "review_queue"
            referencedColumns: ["latest_draft_id"]
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
      visitor_identifiers: {
        Row: {
          created_at: string
          id: string
          kind: string
          value: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          value: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          value?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_identifiers_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      visitors: {
        Row: {
          address: string | null
          consent_at: string | null
          consent_given: boolean
          conversation_count: number
          created_at: string
          email: string | null
          first_seen_at: string
          full_name: string | null
          id: string
          is_demo: boolean
          last_seen_at: string
          notes: string | null
          organisation: string | null
          phone: string | null
          preferred_language: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          consent_at?: string | null
          consent_given?: boolean
          conversation_count?: number
          created_at?: string
          email?: string | null
          first_seen_at?: string
          full_name?: string | null
          id?: string
          is_demo?: boolean
          last_seen_at?: string
          notes?: string | null
          organisation?: string | null
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          consent_at?: string | null
          consent_given?: boolean
          conversation_count?: number
          created_at?: string
          email?: string | null
          first_seen_at?: string
          full_name?: string | null
          id?: string
          is_demo?: boolean
          last_seen_at?: string
          notes?: string | null
          organisation?: string | null
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
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
      decision_record: {
        Row: {
          approval_basis: Database["public"]["Enums"]["approval_basis"] | null
          approved_at: string | null
          approved_by: string | null
          approved_by_name: string | null
          drafted_by: string | null
          fingerprint: string | null
          first_author_kind: Database["public"]["Enums"]["author_kind"] | null
          guideline_id: string | null
          is_demo_seed: boolean | null
          kind: Database["public"]["Enums"]["case_kind"] | null
          memory_item_id: string | null
          question_text: string | null
          reference: string | null
          release_id: string | null
          released_at: string | null
          released_by_name: string | null
          released_version: number | null
          source_version_ids: string[] | null
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
            foreignKeyName: "approvals_guideline_id_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "guidelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "releases_memory_item_id_fkey"
            columns: ["memory_item_id"]
            isOneToOne: false
            referencedRelation: "memory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      insight_gaps: {
        Row: {
          gap_count: number | null
          includes_demo_seed: boolean | null
          most_recent: string | null
          recent_example: string | null
          topic: string | null
        }
        Relationships: []
      }
      insight_topics: {
        Row: {
          includes_demo_seed: boolean | null
          outcome: Database["public"]["Enums"]["answer_outcome"] | null
          question_count: number | null
          topic: string | null
          window_end: string | null
          window_start: string | null
        }
        Relationships: []
      }
      insight_turnaround: {
        Row: {
          case_id: string | null
          deadline_at: string | null
          hours_to_release: number | null
          is_demo_seed: boolean | null
          kind: Database["public"]["Enums"]["case_kind"] | null
          met_deadline: boolean | null
          received_at: string | null
          reference: string | null
          released_at: string | null
        }
        Insert: {
          case_id?: string | null
          deadline_at?: string | null
          hours_to_release?: never
          is_demo_seed?: boolean | null
          kind?: Database["public"]["Enums"]["case_kind"] | null
          met_deadline?: never
          received_at?: string | null
          reference?: string | null
          released_at?: string | null
        }
        Update: {
          case_id?: string | null
          deadline_at?: string | null
          hours_to_release?: never
          is_demo_seed?: boolean | null
          kind?: Database["public"]["Enums"]["case_kind"] | null
          met_deadline?: never
          received_at?: string | null
          reference?: string | null
          released_at?: string | null
        }
        Relationships: []
      }
      review_queue: {
        Row: {
          assigned_to: string | null
          assigned_to_name: string | null
          case_id: string | null
          channel: Database["public"]["Enums"]["channel"] | null
          deadline_at: string | null
          draft_count: number | null
          has_active_approval: boolean | null
          is_demo_seed: boolean | null
          kind: Database["public"]["Enums"]["case_kind"] | null
          latest_draft_id: string | null
          latest_draft_version: number | null
          question_text: string | null
          received_at: string | null
          reference: string | null
          review_reasons: Database["public"]["Enums"]["review_reason"][] | null
          source_changed: boolean | null
          status: Database["public"]["Enums"]["case_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_guidelines: {
        Args: { _guideline_id: string }
        Returns: undefined
      }
      approve_draft: { Args: { _draft_id: string }; Returns: string }
      approve_source: {
        Args: {
          _basis?: Database["public"]["Enums"]["approval_basis"]
          _version_id: string
        }
        Returns: undefined
      }
      assign_case: {
        Args: { _case_id: string; _owner: string }
        Returns: undefined
      }
      bump_rate_counter: {
        Args: { _key_hash: string; _limit: number; _window_start: string }
        Returns: boolean
      }
      correct_routing: {
        Args: {
          _case_id: string
          _kind: Database["public"]["Enums"]["case_kind"]
          _note: string
          _reasons: Database["public"]["Enums"]["review_reason"][]
        }
        Returns: undefined
      }
      erase_contacts: { Args: never; Returns: number }
      flag_source_change: {
        Args: {
          _actor: string
          _reason: Database["public"]["Enums"]["void_reason"]
          _version_id: string
        }
        Returns: undefined
      }
      has_staff_role: {
        Args: { _role: Database["public"]["Enums"]["staff_role"]; _uid: string }
        Returns: boolean
      }
      is_staff: { Args: { _uid: string }; Returns: boolean }
      next_case_reference: { Args: never; Returns: string }
      open_case: {
        Args: {
          _channel?: Database["public"]["Enums"]["channel"]
          _consent?: boolean
          _contact?: string
          _deadline?: string
          _is_demo?: boolean
          _kind: Database["public"]["Enums"]["case_kind"]
          _name?: string
          _notice?: string
          _origin_answer?: string
          _outlet?: string
          _question: string
          _reasons: Database["public"]["Enums"]["review_reason"][]
          _token_hash: string
        }
        Returns: {
          id: string
          reference: string
        }[]
      }
      reject_case: {
        Args: { _case_id: string; _reason: string }
        Returns: undefined
      }
      reject_source: {
        Args: { _reason: string; _version_id: string }
        Returns: undefined
      }
      release_draft: { Args: { _case_id: string }; Returns: string }
      request_changes: {
        Args: { _case_id: string; _instruction: string }
        Returns: undefined
      }
      require_role: {
        Args: { _role: Database["public"]["Enums"]["staff_role"] }
        Returns: string
      }
      save_draft: {
        Args: {
          _adapted_from?: string
          _body: string
          _case_id: string
          _format?: Database["public"]["Enums"]["draft_format"]
          _gaps?: string[]
          _parts?: Json
          _reading_level?: Database["public"]["Enums"]["reading_level"]
        }
        Returns: string
      }
      search_knowledge_semantic: {
        Args: { _embedding: string; _limit?: number }
        Returns: {
          content: string
          owner_id: string
          owner_kind: Database["public"]["Enums"]["embedding_owner"]
          similarity: number
          source_version_id: string
        }[]
      }
      search_memory: {
        Args: { _limit?: number; _q: string }
        Returns: {
          approval_basis: Database["public"]["Enums"]["approval_basis"]
          body: string
          communicated_on: string
          item_type: Database["public"]["Enums"]["memory_type"]
          memory_id: string
          rank: number
          reference_period: string
          reuse_status: Database["public"]["Enums"]["reuse_status"]
          title: string
          topic: string
        }[]
      }
      search_observations: {
        Args: { _limit?: number; _q: string }
        Returns: {
          adjustment: string
          comparability_note: string
          display_value: string
          geography: string
          measure: string
          measure_key: string
          observation_id: string
          original_url: string
          page_number: number
          period_end: string
          period_start: string
          population: string
          published_on: string
          publisher: string
          rank: number
          reference_period: string
          reported_change: string
          source_version_id: string
          table_label: string
          title: string
          unit: string
          value: number
          value_state: Database["public"]["Enums"]["value_state"]
          version_label: string
        }[]
      }
      search_passages: {
        Args: { _limit?: number; _q: string }
        Returns: {
          content: string
          original_url: string
          page_number: number
          passage_id: string
          published_on: string
          publisher: string
          rank: number
          reference_period: string
          section_label: string
          source_id: string
          source_type: Database["public"]["Enums"]["source_type"]
          source_version_id: string
          title: string
          topic: string
          version_label: string
        }[]
      }
      set_role: {
        Args: {
          _role: Database["public"]["Enums"]["staff_role"]
          _target: string
        }
        Returns: undefined
      }
      staff_role_of: {
        Args: { _uid: string }
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      start_review: { Args: { _case_id: string }; Returns: undefined }
      withdraw_source: {
        Args: { _reason: string; _version_id: string }
        Returns: undefined
      }
      write_audit: {
        Args: {
          _action: string
          _actor: string
          _case_id: string
          _detail: Json
          _entity_id: string
          _entity_kind: string
          _from: string
          _origin: Database["public"]["Enums"]["audit_origin"]
          _to: string
        }
        Returns: undefined
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
      conversation_channel: "chat" | "voice" | "widget" | "api"
      conversation_state: "active" | "ended" | "handed_off" | "abandoned"
      delivery_state: "shown" | "queued" | "sent" | "failed"
      draft_format: "general_reply" | "faq_answer" | "short_media_statement"
      embedding_owner: "passage" | "observation" | "memory_item"
      evidence_owner: "answer" | "draft" | "memory_item"
      guideline_status: "draft" | "active" | "retired"
      handoff_reason:
        | "visitor_request"
        | "media"
        | "sensitive"
        | "unsupported"
        | "low_confidence"
        | "complaint"
        | "other"
      handoff_state:
        | "waiting"
        | "accepted"
        | "declined"
        | "transferred"
        | "closed"
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
      sentiment_label: "positive" | "neutral" | "negative" | "frustrated"
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
      turn_author: "visitor" | "assistant" | "official" | "system"
      urgency_level: "low" | "normal" | "high" | "urgent"
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
      conversation_channel: ["chat", "voice", "widget", "api"],
      conversation_state: ["active", "ended", "handed_off", "abandoned"],
      delivery_state: ["shown", "queued", "sent", "failed"],
      draft_format: ["general_reply", "faq_answer", "short_media_statement"],
      embedding_owner: ["passage", "observation", "memory_item"],
      evidence_owner: ["answer", "draft", "memory_item"],
      guideline_status: ["draft", "active", "retired"],
      handoff_reason: [
        "visitor_request",
        "media",
        "sensitive",
        "unsupported",
        "low_confidence",
        "complaint",
        "other",
      ],
      handoff_state: [
        "waiting",
        "accepted",
        "declined",
        "transferred",
        "closed",
      ],
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
      sentiment_label: ["positive", "neutral", "negative", "frustrated"],
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
      turn_author: ["visitor", "assistant", "official", "system"],
      urgency_level: ["low", "normal", "high", "urgent"],
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
