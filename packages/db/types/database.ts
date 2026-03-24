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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          module: string | null
          summary: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          module?: string | null
          summary: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          module?: string | null
          summary?: string
        }
        Relationships: []
      }
      agent_capabilities: {
        Row: {
          agent_id: string | null
          capability: string
          created_at: string | null
          description: string | null
          id: string
        }
        Insert: {
          agent_id?: string | null
          capability: string
          created_at?: string | null
          description?: string | null
          id?: string
        }
        Update: {
          agent_id?: string | null
          capability?: string
          created_at?: string | null
          description?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_capabilities_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_conversations: {
        Row: {
          channel: string | null
          context: Json | null
          last_message_at: string | null
          session_id: string
          started_at: string | null
          template_id: string | null
          title: string | null
        }
        Insert: {
          channel?: string | null
          context?: Json | null
          last_message_at?: string | null
          session_id: string
          started_at?: string | null
          template_id?: string | null
          title?: string | null
        }
        Update: {
          channel?: string | null
          context?: Json | null
          last_message_at?: string | null
          session_id?: string
          started_at?: string | null
          template_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "agent_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memories: {
        Row: {
          access_count: number | null
          category: string
          confidence: number | null
          content: string
          created_at: string | null
          embedding: string | null
          expires_at: string | null
          id: string
          importance: number | null
          l0_abstract: string | null
          l1_overview: string | null
          last_accessed: string | null
          memory_type: string
          mergeable: boolean
          module: string | null
          origin_session_id: string | null
          path: string | null
          related_modules: string[] | null
          search_vector: unknown
          source_message_id: string | null
          status: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          access_count?: number | null
          category: string
          confidence?: number | null
          content: string
          created_at?: string | null
          embedding?: string | null
          expires_at?: string | null
          id?: string
          importance?: number | null
          l0_abstract?: string | null
          l1_overview?: string | null
          last_accessed?: string | null
          memory_type?: string
          mergeable?: boolean
          module?: string | null
          origin_session_id?: string | null
          path?: string | null
          related_modules?: string[] | null
          search_vector?: unknown
          source_message_id?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          access_count?: number | null
          category?: string
          confidence?: number | null
          content?: string
          created_at?: string | null
          embedding?: string | null
          expires_at?: string | null
          id?: string
          importance?: number | null
          l0_abstract?: string | null
          l1_overview?: string | null
          last_accessed?: string | null
          memory_type?: string
          mergeable?: boolean
          module?: string | null
          origin_session_id?: string | null
          path?: string | null
          related_modules?: string[] | null
          search_vector?: unknown
          source_message_id?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_memories_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "conversation_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          content: string
          context: Json | null
          created_at: string | null
          delivered_at: string | null
          from_agent_id: string | null
          id: string
          message_type: string | null
          related_message_id: string | null
          session_id: string | null
          status: string | null
          to_agent_id: string | null
        }
        Insert: {
          content: string
          context?: Json | null
          created_at?: string | null
          delivered_at?: string | null
          from_agent_id?: string | null
          id?: string
          message_type?: string | null
          related_message_id?: string | null
          session_id?: string | null
          status?: string | null
          to_agent_id?: string | null
        }
        Update: {
          content?: string
          context?: Json | null
          created_at?: string | null
          delivered_at?: string | null
          from_agent_id?: string | null
          id?: string
          message_type?: string | null
          related_message_id?: string | null
          session_id?: string | null
          status?: string | null
          to_agent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_from_agent_id_fkey"
            columns: ["from_agent_id"]
            isOneToOne: false
            referencedRelation: "agent_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_messages_related_message_id_fkey"
            columns: ["related_message_id"]
            isOneToOne: false
            referencedRelation: "agent_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_messages_to_agent_id_fkey"
            columns: ["to_agent_id"]
            isOneToOne: false
            referencedRelation: "agent_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_settings: {
        Row: {
          agent_name: string
          auto_restart: boolean
          big_purchase_threshold: number
          checkin_evening_enabled: boolean
          checkin_evening_time: string
          checkin_morning_enabled: boolean
          checkin_morning_time: string
          alerts_enabled: boolean
          alerts_time: string
          enabled_channels: string[]
          heartbeat_interval: number
          id: string
          language: string
          llm_model: string
          max_tokens: number
          offline_threshold: number
          security_review_day: number
          security_review_time: string
          system_prompt_path: string
          tenant_name: string
          temperature: number
          timezone: string
          updated_at: string
          weekly_review_enabled: boolean
          weekly_review_time: string
        }
        Insert: {
          agent_name?: string
          auto_restart?: boolean
          big_purchase_threshold?: number
          checkin_evening_enabled?: boolean
          checkin_evening_time?: string
          checkin_morning_enabled?: boolean
          checkin_morning_time?: string
          alerts_enabled?: boolean
          alerts_time?: string
          enabled_channels?: string[]
          heartbeat_interval?: number
          id?: string
          language?: string
          llm_model?: string
          max_tokens?: number
          offline_threshold?: number
          security_review_day?: number
          security_review_time?: string
          system_prompt_path?: string
          tenant_name?: string
          temperature?: number
          timezone?: string
          updated_at?: string
          weekly_review_enabled?: boolean
          weekly_review_time?: string
        }
        Update: {
          agent_name?: string
          auto_restart?: boolean
          big_purchase_threshold?: number
          checkin_evening_enabled?: boolean
          checkin_evening_time?: string
          checkin_morning_enabled?: boolean
          checkin_morning_time?: string
          alerts_enabled?: boolean
          alerts_time?: string
          enabled_channels?: string[]
          heartbeat_interval?: number
          id?: string
          language?: string
          llm_model?: string
          max_tokens?: number
          offline_threshold?: number
          security_review_day?: number
          security_review_time?: string
          system_prompt_path?: string
          tenant_name?: string
          temperature?: number
          timezone?: string
          updated_at?: string
          weekly_review_enabled?: boolean
          weekly_review_time?: string
        }
        Relationships: []
      }
      agent_status: {
        Row: {
          environment: string | null
          id: string
          last_heartbeat: string
          started_at: string
          status: string
          updated_at: string | null
          version: string | null
        }
        Insert: {
          environment?: string | null
          id?: string
          last_heartbeat?: string
          started_at?: string
          status?: string
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          environment?: string | null
          id?: string
          last_heartbeat?: string
          started_at?: string
          status?: string
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      agent_templates: {
        Row: {
          agent_tier: string | null
          avatar_seed: string | null
          avatar_style: string | null
          avatar_url: string | null
          created_at: string | null
          description: string | null
          id: string
          identity: string | null
          is_default: boolean | null
          is_system: boolean | null
          is_user_facing: boolean | null
          knowledge: string | null
          llm_model: string | null
          max_tokens: number | null
          memory_type: string | null
          name: string
          personality: Json | null
          philosophy: string | null
          sprite_folder: string | null
          system_prompt: string | null
          temperature: number | null
          tools_enabled: string[] | null
          updated_at: string | null
        }
        Insert: {
          agent_tier?: string | null
          avatar_seed?: string | null
          avatar_style?: string | null
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          identity?: string | null
          is_default?: boolean | null
          is_system?: boolean | null
          is_user_facing?: boolean | null
          knowledge?: string | null
          llm_model?: string | null
          max_tokens?: number | null
          memory_type?: string | null
          name: string
          personality?: Json | null
          philosophy?: string | null
          sprite_folder?: string | null
          system_prompt?: string | null
          temperature?: number | null
          tools_enabled?: string[] | null
          updated_at?: string | null
        }
        Update: {
          agent_tier?: string | null
          avatar_seed?: string | null
          avatar_style?: string | null
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          identity?: string | null
          is_default?: boolean | null
          is_system?: boolean | null
          is_user_facing?: boolean | null
          knowledge?: string | null
          llm_model?: string | null
          max_tokens?: number | null
          memory_type?: string | null
          name?: string
          personality?: Json | null
          philosophy?: string | null
          sprite_folder?: string | null
          system_prompt?: string | null
          temperature?: number | null
          tools_enabled?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      archiving_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          priority: number
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number
        }
        Relationships: []
      }
      assets: {
        Row: {
          condition: string | null
          id: string
          insurance_expiry: string | null
          insured: boolean | null
          location: string | null
          metadata: Json | null
          name: string
          notes: string | null
          purchase_date: string | null
          type: string
          value: number | null
        }
        Insert: {
          condition?: string | null
          id?: string
          insurance_expiry?: string | null
          insured?: boolean | null
          location?: string | null
          metadata?: Json | null
          name: string
          notes?: string | null
          purchase_date?: string | null
          type: string
          value?: number | null
        }
        Update: {
          condition?: string | null
          id?: string
          insurance_expiry?: string | null
          insured?: boolean | null
          location?: string | null
          metadata?: Json | null
          name?: string
          notes?: string | null
          purchase_date?: string | null
          type?: string
          value?: number | null
        }
        Relationships: []
      }
      automation_configs: {
        Row: {
          category: string
          cron_expression: string
          custom: boolean
          description: string | null
          enabled: boolean
          error_message: string | null
          id: string
          last_run: string | null
          last_status: string | null
          name: string
          run_count: number
          updated_at: string
        }
        Insert: {
          category?: string
          cron_expression: string
          custom?: boolean
          description?: string | null
          enabled?: boolean
          error_message?: string | null
          id: string
          last_run?: string | null
          last_status?: string | null
          name: string
          run_count?: number
          updated_at?: string
        }
        Update: {
          category?: string
          cron_expression?: string
          custom?: boolean
          description?: string | null
          enabled?: boolean
          error_message?: string | null
          id?: string
          last_run?: string | null
          last_status?: string | null
          name?: string
          run_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      availability_date_overrides: {
        Row: {
          created_at: string | null
          date: string
          end_time: string | null
          id: string
          is_unavailable: boolean | null
          reason: string | null
          schedule_id: string
          start_time: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          end_time?: string | null
          id?: string
          is_unavailable?: boolean | null
          reason?: string | null
          schedule_id: string
          start_time?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          end_time?: string | null
          id?: string
          is_unavailable?: boolean | null
          reason?: string | null
          schedule_id?: string
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_date_overrides_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "availability_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_schedules: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          timezone: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          timezone?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          timezone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      availability_slots: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          schedule_id: string
          start_time: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          schedule_id: string
          start_time: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          schedule_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "availability_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      body_measurements: {
        Row: {
          body_fat_pct: number | null
          chest_cm: number | null
          created_at: string | null
          external_id: string | null
          height_cm: number | null
          hip_cm: number | null
          id: string
          measured_at: string
          muscle_mass_kg: number | null
          notes: string | null
          raw_payload: Json | null
          source: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          body_fat_pct?: number | null
          chest_cm?: number | null
          created_at?: string | null
          external_id?: string | null
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          measured_at?: string
          muscle_mass_kg?: number | null
          notes?: string | null
          raw_payload?: Json | null
          source?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          body_fat_pct?: number | null
          chest_cm?: number | null
          created_at?: string | null
          external_id?: string | null
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          measured_at?: string
          muscle_mass_kg?: number | null
          notes?: string | null
          raw_payload?: Json | null
          source?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      books: {
        Row: {
          author: string | null
          created_at: string | null
          finished_at: string | null
          id: string
          key_insights: string[] | null
          notes: string | null
          rating: number | null
          started_at: string | null
          status: string
          title: string
        }
        Insert: {
          author?: string | null
          created_at?: string | null
          finished_at?: string | null
          id?: string
          key_insights?: string[] | null
          notes?: string | null
          rating?: number | null
          started_at?: string | null
          status?: string
          title: string
        }
        Update: {
          author?: string | null
          created_at?: string | null
          finished_at?: string | null
          id?: string
          key_insights?: string[] | null
          notes?: string | null
          rating?: number | null
          started_at?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      calendar_attendees: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string
          event_id: string
          id: string
          is_organizer: boolean | null
          response_status: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email: string
          event_id: string
          id?: string
          is_organizer?: boolean | null
          response_status?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string
          event_id?: string
          id?: string
          is_organizer?: boolean | null
          response_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          created_at: string | null
          description: string | null
          end_at: string
          google_event_id: string | null
          id: string
          is_recurring: boolean | null
          location: string | null
          metadata: Json | null
          organizer_email: string | null
          recurrence_rule: string | null
          start_at: string
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          all_day?: boolean | null
          created_at?: string | null
          description?: string | null
          end_at: string
          google_event_id?: string | null
          id?: string
          is_recurring?: boolean | null
          location?: string | null
          metadata?: Json | null
          organizer_email?: string | null
          recurrence_rule?: string | null
          start_at: string
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          all_day?: boolean | null
          created_at?: string | null
          description?: string | null
          end_at?: string
          google_event_id?: string | null
          id?: string
          is_recurring?: boolean | null
          location?: string | null
          metadata?: Json | null
          organizer_email?: string | null
          recurrence_rule?: string | null
          start_at?: string
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      calendar_reminders: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          minutes_before: number
          sent_at: string | null
          status: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          minutes_before?: number
          sent_at?: string | null
          status?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          minutes_before?: number
          sent_at?: string | null
          status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_sync_config: {
        Row: {
          access_token: string | null
          calendar_id: string
          calendar_name: string | null
          created_at: string | null
          google_calendar_id: string | null
          id: string
          last_sync_at: string | null
          metadata: Json | null
          refresh_token: string | null
          sync_enabled: boolean | null
          token_expiry: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          calendar_id: string
          calendar_name?: string | null
          created_at?: string | null
          google_calendar_id?: string | null
          id?: string
          last_sync_at?: string | null
          metadata?: Json | null
          refresh_token?: string | null
          sync_enabled?: boolean | null
          token_expiry?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          calendar_id?: string
          calendar_name?: string | null
          created_at?: string | null
          google_calendar_id?: string | null
          id?: string
          last_sync_at?: string | null
          metadata?: Json | null
          refresh_token?: string | null
          sync_enabled?: boolean | null
          token_expiry?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      career_certifications: {
        Row: {
          created_at: string | null
          credential_id: string | null
          credential_url: string | null
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuer: string
          name: string
          profile_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credential_id?: string | null
          credential_url?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuer: string
          name: string
          profile_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credential_id?: string | null
          credential_url?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string
          name?: string
          profile_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "career_certifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      career_educations: {
        Row: {
          activities: string[] | null
          created_at: string | null
          degree: string
          description: string | null
          end_date: string | null
          field_of_study: string | null
          grade: string | null
          id: string
          institution: string
          is_current: boolean | null
          profile_id: string
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          activities?: string[] | null
          created_at?: string | null
          degree: string
          description?: string | null
          end_date?: string | null
          field_of_study?: string | null
          grade?: string | null
          id?: string
          institution: string
          is_current?: boolean | null
          profile_id: string
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          activities?: string[] | null
          created_at?: string | null
          degree?: string
          description?: string | null
          end_date?: string | null
          field_of_study?: string | null
          grade?: string | null
          id?: string
          institution?: string
          is_current?: boolean | null
          profile_id?: string
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "career_educations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      career_experiences: {
        Row: {
          achievements: string[] | null
          company_name: string
          company_url: string | null
          created_at: string | null
          description: string | null
          employment_type: string | null
          end_date: string | null
          id: string
          industry: string | null
          is_current: boolean | null
          location: string | null
          profile_id: string
          start_date: string
          title: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          achievements?: string[] | null
          company_name: string
          company_url?: string | null
          created_at?: string | null
          description?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          industry?: string | null
          is_current?: boolean | null
          location?: string | null
          profile_id: string
          start_date: string
          title: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          achievements?: string[] | null
          company_name?: string
          company_url?: string | null
          created_at?: string | null
          description?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          industry?: string | null
          is_current?: boolean | null
          location?: string | null
          profile_id?: string
          start_date?: string
          title?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "career_experiences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_experiences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      career_profiles: {
        Row: {
          created_at: string | null
          email: string | null
          github_url: string | null
          headline: string | null
          id: string
          linkedin_url: string | null
          location: string | null
          open_to_work: boolean | null
          phone: string | null
          portfolio_url: string | null
          preferred_job_types: string[] | null
          profile_id: string
          salary_expectation: number | null
          summary: string | null
          target_industry: string | null
          target_role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          github_url?: string | null
          headline?: string | null
          id?: string
          linkedin_url?: string | null
          location?: string | null
          open_to_work?: boolean | null
          phone?: string | null
          portfolio_url?: string | null
          preferred_job_types?: string[] | null
          profile_id: string
          salary_expectation?: number | null
          summary?: string | null
          target_industry?: string | null
          target_role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          github_url?: string | null
          headline?: string | null
          id?: string
          linkedin_url?: string | null
          location?: string | null
          open_to_work?: boolean | null
          phone?: string | null
          portfolio_url?: string | null
          preferred_job_types?: string[] | null
          profile_id?: string
          salary_expectation?: number | null
          summary?: string | null
          target_industry?: string | null
          target_role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "career_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      career_skills: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          level: number | null
          name: string
          profile_id: string
          updated_at: string | null
          years_experience: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          level?: number | null
          name: string
          profile_id: string
          updated_at?: string | null
          years_experience?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          level?: number | null
          name?: string
          profile_id?: string
          updated_at?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "career_skills_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      clickup_tasks: {
        Row: {
          assignees: Json | null
          clickup_id: string
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          list_name: string | null
          name: string
          priority: number | null
          space_name: string | null
          status: string | null
          synced_at: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          assignees?: Json | null
          clickup_id: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          list_name?: string | null
          name: string
          priority?: number | null
          space_name?: string | null
          status?: string | null
          synced_at?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          assignees?: Json | null
          clickup_id?: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          list_name?: string | null
          name?: string
          priority?: number | null
          space_name?: string | null
          status?: string | null
          synced_at?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string | null
          description: string | null
          domain: string | null
          id: string
          industry: string | null
          linkedin_url: string | null
          metadata: Json | null
          name: string
          notes: string | null
          size: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          domain?: string | null
          id?: string
          industry?: string | null
          linkedin_url?: string | null
          metadata?: Json | null
          name: string
          notes?: string | null
          size?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          domain?: string | null
          id?: string
          industry?: string | null
          linkedin_url?: string | null
          metadata?: Json | null
          name?: string
          notes?: string | null
          size?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      conditions: {
        Row: {
          category: string | null
          created_at: string | null
          diagnosed_at: string | null
          icd10_code: string | null
          id: string
          name: string
          notes: string | null
          status: string | null
          treating_professional: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          diagnosed_at?: string | null
          icd10_code?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: string | null
          treating_professional?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          diagnosed_at?: string | null
          icd10_code?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: string | null
          treating_professional?: string | null
        }
        Relationships: []
      }
      contact_reminders: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          frequency_type: string
          frequency_value: number | null
          id: string
          initial_date: string
          last_triggered_at: string | null
          next_expected_date: string | null
          person_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          frequency_type: string
          frequency_value?: number | null
          id?: string
          initial_date: string
          last_triggered_at?: string | null
          next_expected_date?: string | null
          person_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          frequency_type?: string
          frequency_value?: number | null
          id?: string
          initial_date?: string
          last_triggered_at?: string | null
          next_expected_date?: string | null
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_reminders_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_audit_log: {
        Row: {
          action: string
          actor: string | null
          contract_id: string
          created_at: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor?: string | null
          contract_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor?: string | null
          contract_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_audit_log_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signatories: {
        Row: {
          contract_id: string
          created_at: string | null
          decline_reason: string | null
          declined_at: string | null
          email: string | null
          id: string
          name: string
          person_id: string | null
          role: string | null
          signed_at: string | null
          signing_order: number | null
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          email?: string | null
          id?: string
          name: string
          person_id?: string | null
          role?: string | null
          signed_at?: string | null
          signing_order?: number | null
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          email?: string | null
          id?: string
          name?: string
          person_id?: string | null
          role?: string | null
          signed_at?: string | null
          signing_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatories_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatories_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          auto_renew: boolean | null
          created_at: string | null
          end_date: string | null
          entity_id: string | null
          expiry_date: string | null
          file_url: string | null
          id: string
          metadata: Json | null
          notes: string | null
          parties: string[] | null
          reminder_sent_at: string | null
          renewal_date: string | null
          renewal_notice_days: number | null
          sent_at: string | null
          signed_at: string | null
          signing_status: string | null
          start_date: string | null
          status: string
          tags: string[] | null
          title: string
          type: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          auto_renew?: boolean | null
          created_at?: string | null
          end_date?: string | null
          entity_id?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          parties?: string[] | null
          reminder_sent_at?: string | null
          renewal_date?: string | null
          renewal_notice_days?: number | null
          sent_at?: string | null
          signed_at?: string | null
          signing_status?: string | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          title: string
          type?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          auto_renew?: boolean | null
          created_at?: string | null
          end_date?: string | null
          entity_id?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          parties?: string[] | null
          reminder_sent_at?: string | null
          renewal_date?: string | null
          renewal_notice_days?: number | null
          sent_at?: string | null
          signed_at?: string | null
          signing_status?: string | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          type?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          archived: boolean
          channel: string | null
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          session_id: string
          tokens_used: number | null
        }
        Insert: {
          archived?: boolean
          channel?: string | null
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
          tokens_used?: number | null
        }
        Update: {
          archived?: boolean
          channel?: string | null
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
          tokens_used?: number | null
        }
        Relationships: []
      }
      conversation_summaries: {
        Row: {
          created_at: string | null
          first_message_at: string
          id: string
          key_memories_extracted: string[] | null
          last_message_at: string
          message_count: number
          session_id: string
          summary: string
        }
        Insert: {
          created_at?: string | null
          first_message_at: string
          id?: string
          key_memories_extracted?: string[] | null
          last_message_at: string
          message_count: number
          session_id: string
          summary: string
        }
        Update: {
          created_at?: string | null
          first_message_at?: string
          id?: string
          key_memories_extracted?: string[] | null
          last_message_at?: string
          message_count?: number
          session_id?: string
          summary?: string
        }
        Relationships: []
      }
      cross_module_insights: {
        Row: {
          confidence: number | null
          created_at: string | null
          dismissed: boolean | null
          evidence: Json | null
          id: string
          insight: string
          modules: string[]
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          dismissed?: boolean | null
          evidence?: Json | null
          id?: string
          insight: string
          modules: string[]
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          dismissed?: boolean | null
          evidence?: Json | null
          id?: string
          insight?: string
          modules?: string[]
        }
        Relationships: []
      }
      cycle_tasks: {
        Row: {
          added_at: string | null
          cycle_id: string
          task_id: string
        }
        Insert: {
          added_at?: string | null
          cycle_id: string
          task_id: string
        }
        Update: {
          added_at?: string | null
          cycle_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_tasks_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      cycles: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string
          goal: string | null
          id: string
          name: string
          objective_id: string | null
          retrospective_notes: string | null
          start_date: string
          status: string | null
          updated_at: string | null
          velocity_actual: number | null
          velocity_estimate: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date: string
          goal?: string | null
          id?: string
          name: string
          objective_id?: string | null
          retrospective_notes?: string | null
          start_date: string
          status?: string | null
          updated_at?: string | null
          velocity_actual?: number | null
          velocity_estimate?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string
          goal?: string | null
          id?: string
          name?: string
          objective_id?: string | null
          retrospective_notes?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
          velocity_actual?: number | null
          velocity_estimate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cycles_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      data_gaps: {
        Row: {
          created_at: string | null
          description: string
          gap_type: string
          id: string
          module: string
          question_id: string | null
          resolved: boolean | null
          resolved_at: string | null
          severity: string | null
          table_name: string
        }
        Insert: {
          created_at?: string | null
          description: string
          gap_type: string
          id?: string
          module: string
          question_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string | null
          table_name: string
        }
        Update: {
          created_at?: string | null
          description?: string
          gap_type?: string
          id?: string
          module?: string
          question_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_gaps_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "onboarding_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_artifacts: {
        Row: {
          artifact_type: string
          content: string | null
          created_at: string | null
          demand_id: string
          file_url: string | null
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_table: string | null
          step_id: string | null
          title: string
        }
        Insert: {
          artifact_type: string
          content?: string | null
          created_at?: string | null
          demand_id: string
          file_url?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_table?: string | null
          step_id?: string | null
          title: string
        }
        Update: {
          artifact_type?: string
          content?: string | null
          created_at?: string | null
          demand_id?: string
          file_url?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_table?: string | null
          step_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_artifacts_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_artifacts_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "demand_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_logs: {
        Row: {
          agent_id: string | null
          created_at: string | null
          demand_id: string
          id: string
          log_type: string
          message: string
          metadata: Json | null
          step_id: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          demand_id: string
          id?: string
          log_type?: string
          message: string
          metadata?: Json | null
          step_id?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          demand_id?: string
          id?: string
          log_type?: string
          message?: string
          metadata?: Json | null
          step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_logs_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_logs_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "demand_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_steps: {
        Row: {
          assigned_agent_id: string | null
          completed_at: string | null
          condition_rule: Json | null
          created_at: string | null
          demand_id: string
          depends_on: string[] | null
          description: string | null
          error_message: string | null
          estimated_duration_minutes: number | null
          execution_type: string
          id: string
          max_retries: number | null
          result: string | null
          result_metadata: Json | null
          retry_count: number | null
          started_at: string | null
          status: string
          step_order: number
          title: string
          tool_args: Json | null
          tool_name: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_agent_id?: string | null
          completed_at?: string | null
          condition_rule?: Json | null
          created_at?: string | null
          demand_id: string
          depends_on?: string[] | null
          description?: string | null
          error_message?: string | null
          estimated_duration_minutes?: number | null
          execution_type?: string
          id?: string
          max_retries?: number | null
          result?: string | null
          result_metadata?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          step_order?: number
          title: string
          tool_args?: Json | null
          tool_name?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_agent_id?: string | null
          completed_at?: string | null
          condition_rule?: Json | null
          created_at?: string | null
          demand_id?: string
          depends_on?: string[] | null
          description?: string | null
          error_message?: string | null
          estimated_duration_minutes?: number | null
          execution_type?: string
          id?: string
          max_retries?: number | null
          result?: string | null
          result_metadata?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          step_order?: number
          title?: string
          tool_args?: Json | null
          tool_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_steps_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agent_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_steps_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
        ]
      }
      demands: {
        Row: {
          completed_at: string | null
          completed_steps: number | null
          created_at: string | null
          deadline: string | null
          description: string | null
          execution_summary: string | null
          id: string
          metadata: Json | null
          module: string | null
          objective_id: string | null
          orchestrator_agent_id: string | null
          origin: string | null
          origin_message: string | null
          origin_session_id: string | null
          priority: string | null
          progress: number | null
          scheduled_at: string | null
          started_at: string | null
          status: string
          tags: string[] | null
          title: string
          total_steps: number | null
          triage_result: Json | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_steps?: number | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          execution_summary?: string | null
          id?: string
          metadata?: Json | null
          module?: string | null
          objective_id?: string | null
          orchestrator_agent_id?: string | null
          origin?: string | null
          origin_message?: string | null
          origin_session_id?: string | null
          priority?: string | null
          progress?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          tags?: string[] | null
          title: string
          total_steps?: number | null
          triage_result?: Json | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_steps?: number | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          execution_summary?: string | null
          id?: string
          metadata?: Json | null
          module?: string | null
          objective_id?: string | null
          orchestrator_agent_id?: string | null
          origin?: string | null
          origin_message?: string | null
          origin_session_id?: string | null
          priority?: string | null
          progress?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          total_steps?: number | null
          triage_result?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demands_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_orchestrator_agent_id_fkey"
            columns: ["orchestrator_agent_id"]
            isOneToOne: false
            referencedRelation: "agent_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      document_processing_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          document_id: string
          error: string | null
          id: string
          processed_at: string | null
          status: string | null
          tasks: string[]
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          document_id: string
          error?: string | null
          id?: string
          processed_at?: string | null
          status?: string | null
          tasks?: string[]
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          document_id?: string
          error?: string | null
          id?: string
          processed_at?: string | null
          status?: string | null
          tasks?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "document_processing_queue_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_system: boolean | null
          matching_pattern: string | null
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_system?: boolean | null
          matching_pattern?: string | null
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_system?: boolean | null
          matching_pattern?: string | null
          name?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          archive_serial: string | null
          asset_id: string | null
          checksum: string | null
          content: string | null
          correspondent_id: string | null
          created_at: string | null
          description: string | null
          document_date: string | null
          document_type_id: string | null
          entity: string | null
          expires_at: string | null
          expiry_date: string | null
          file_size_bytes: number | null
          file_url: string | null
          id: string
          is_archived: boolean | null
          metadata: Json | null
          name: string
          notes: string | null
          page_count: number | null
          tags: string[] | null
          type: string
          updated_at: string | null
        }
        Insert: {
          archive_serial?: string | null
          asset_id?: string | null
          checksum?: string | null
          content?: string | null
          correspondent_id?: string | null
          created_at?: string | null
          description?: string | null
          document_date?: string | null
          document_type_id?: string | null
          entity?: string | null
          expires_at?: string | null
          expiry_date?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          is_archived?: boolean | null
          metadata?: Json | null
          name: string
          notes?: string | null
          page_count?: number | null
          tags?: string[] | null
          type: string
          updated_at?: string | null
        }
        Update: {
          archive_serial?: string | null
          asset_id?: string | null
          checksum?: string | null
          content?: string | null
          correspondent_id?: string | null
          created_at?: string | null
          description?: string | null
          document_date?: string | null
          document_type_id?: string | null
          entity?: string | null
          expires_at?: string | null
          expiry_date?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          is_archived?: boolean | null
          metadata?: Json | null
          name?: string
          notes?: string | null
          page_count?: number | null
          tags?: string[] | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_correspondent_id_fkey"
            columns: ["correspondent_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_documents_type"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_activity_log: {
        Row: {
          activity_type: string
          author: string | null
          body: string | null
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          occurred_at: string | null
          title: string | null
        }
        Insert: {
          activity_type: string
          author?: string | null
          body?: string | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          occurred_at?: string | null
          title?: string | null
        }
        Update: {
          activity_type?: string
          author?: string | null
          body?: string | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string | null
          title?: string | null
        }
        Relationships: []
      }
      entity_tags: {
        Row: {
          entity_id: string
          entity_type: string
          tag_id: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          tag_id: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          buffer_after_minutes: number | null
          buffer_before_minutes: number | null
          color: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number
          id: string
          is_hidden: boolean | null
          location_type: string | null
          location_value: string | null
          max_bookings_per_day: number | null
          metadata: Json | null
          minimum_booking_notice_minutes: number | null
          schedule_id: string | null
          slug: string
          title: string
          updated_at: string | null
        }
        Insert: {
          buffer_after_minutes?: number | null
          buffer_before_minutes?: number | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_hidden?: boolean | null
          location_type?: string | null
          location_value?: string | null
          max_bookings_per_day?: number | null
          metadata?: Json | null
          minimum_booking_notice_minutes?: number | null
          schedule_id?: string | null
          slug: string
          title: string
          updated_at?: string | null
        }
        Update: {
          buffer_after_minutes?: number | null
          buffer_before_minutes?: number | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_hidden?: boolean | null
          location_type?: string | null
          location_value?: string | null
          max_bookings_per_day?: number | null
          metadata?: Json | null
          minimum_booking_notice_minutes?: number | null
          schedule_id?: string | null
          slug?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_types_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "availability_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string | null
          equipment: string[] | null
          exercise_type: string
          id: string
          instructions: string | null
          is_custom: boolean | null
          muscle_group: string
          name: string
          secondary_muscles: string[] | null
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          equipment?: string[] | null
          exercise_type: string
          id?: string
          instructions?: string | null
          is_custom?: boolean | null
          muscle_group: string
          name: string
          secondary_muscles?: string[] | null
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          equipment?: string[] | null
          exercise_type?: string
          id?: string
          instructions?: string | null
          is_custom?: boolean | null
          muscle_group?: string
          name?: string
          secondary_muscles?: string[] | null
          video_url?: string | null
        }
        Relationships: []
      }
      extension_connections: {
        Row: {
          access_token: string | null
          api_key: string | null
          created_at: string | null
          extension_id: string
          id: string
          last_error: string | null
          last_sync_at: string | null
          metadata: Json | null
          refresh_token: string | null
          status: string
          sync_enabled: boolean | null
          sync_interval_minutes: number | null
          token_expiry: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          api_key?: string | null
          created_at?: string | null
          extension_id: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          refresh_token?: string | null
          status?: string
          sync_enabled?: boolean | null
          sync_interval_minutes?: number | null
          token_expiry?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          api_key?: string | null
          created_at?: string | null
          extension_id?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          refresh_token?: string | null
          status?: string
          sync_enabled?: boolean | null
          sync_interval_minutes?: number | null
          token_expiry?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      finance_accounts: {
        Row: {
          balance: number | null
          created_at: string | null
          currency: string | null
          enabled: boolean | null
          id: string
          investment_type: string | null
          metadata: Json | null
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          currency?: string | null
          enabled?: boolean | null
          id?: string
          investment_type?: string | null
          metadata?: Json | null
          name: string
          type: string
          updated_at?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          currency?: string | null
          enabled?: boolean | null
          id?: string
          investment_type?: string | null
          metadata?: Json | null
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      finance_budgets: {
        Row: {
          budgeted_amount: number
          carryover_amount: number | null
          category_id: string
          created_at: string | null
          id: string
          month: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          budgeted_amount?: number
          carryover_amount?: number | null
          category_id: string
          created_at?: string | null
          id?: string
          month: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          budgeted_amount?: number
          carryover_amount?: number | null
          category_id?: string
          created_at?: string | null
          id?: string
          month?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_categories: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          metadata: Json | null
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          metadata?: Json | null
          name: string
          type: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      finance_categorization_rules: {
        Row: {
          category_id: string
          condition_field: string
          condition_operator: string
          condition_value: string
          created_at: string | null
          id: string
          is_active: boolean | null
          payee: string | null
          priority: number
        }
        Insert: {
          category_id: string
          condition_field: string
          condition_operator: string
          condition_value: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          payee?: string | null
          priority?: number
        }
        Update: {
          category_id?: string
          condition_field?: string
          condition_operator?: string
          condition_value?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          payee?: string | null
          priority?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_categorization_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_net_worth_snapshots: {
        Row: {
          breakdown: Json | null
          created_at: string | null
          id: string
          net_worth: number | null
          notes: string | null
          snapshot_date: string
          total_assets: number
          total_liabilities: number
        }
        Insert: {
          breakdown?: Json | null
          created_at?: string | null
          id?: string
          net_worth?: number | null
          notes?: string | null
          snapshot_date: string
          total_assets?: number
          total_liabilities?: number
        }
        Update: {
          breakdown?: Json | null
          created_at?: string | null
          id?: string
          net_worth?: number | null
          notes?: string | null
          snapshot_date?: string
          total_assets?: number
          total_liabilities?: number
        }
        Relationships: []
      }
      finance_recurring: {
        Row: {
          account_id: string
          amount: number
          category_id: string
          created_at: string | null
          description: string
          enabled: boolean | null
          end_date: string | null
          frequency: string
          id: string
          metadata: Json | null
          next_due_date: string
          start_date: string
          type: string
          updated_at: string | null
        }
        Insert: {
          account_id: string
          amount: number
          category_id: string
          created_at?: string | null
          description: string
          enabled?: boolean | null
          end_date?: string | null
          frequency: string
          id?: string
          metadata?: Json | null
          next_due_date?: string
          start_date?: string
          type: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string
          created_at?: string | null
          description?: string
          enabled?: boolean | null
          end_date?: string | null
          frequency?: string
          id?: string
          metadata?: Json | null
          next_due_date?: string
          start_date?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_recurring_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_recurring_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transaction_splits: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          parent_transaction_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          parent_transaction_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          parent_transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_transaction_splits_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transaction_splits_parent_transaction_id_fkey"
            columns: ["parent_transaction_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string
          created_at: string | null
          date: string
          description: string | null
          id: string
          metadata: Json | null
          tags: string[] | null
          type: string
          updated_at: string | null
        }
        Insert: {
          account_id: string
          amount: number
          category_id: string
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          tags?: string[] | null
          type: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          tags?: string[] | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      github_pull_requests: {
        Row: {
          author: string | null
          created_at: string | null
          created_at_gh: string | null
          github_id: number
          id: string
          merged_at: string | null
          number: number
          repo_full_name: string
          state: string
          synced_at: string | null
          title: string
          url: string
        }
        Insert: {
          author?: string | null
          created_at?: string | null
          created_at_gh?: string | null
          github_id: number
          id?: string
          merged_at?: string | null
          number: number
          repo_full_name: string
          state: string
          synced_at?: string | null
          title: string
          url: string
        }
        Update: {
          author?: string | null
          created_at?: string | null
          created_at_gh?: string | null
          github_id?: number
          id?: string
          merged_at?: string | null
          number?: number
          repo_full_name?: string
          state?: string
          synced_at?: string | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      github_repos: {
        Row: {
          created_at: string | null
          description: string | null
          full_name: string
          github_id: number
          id: string
          is_fork: boolean | null
          is_private: boolean | null
          language: string | null
          last_pushed_at: string | null
          name: string
          stars: number | null
          synced_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          full_name: string
          github_id: number
          id?: string
          is_fork?: boolean | null
          is_private?: boolean | null
          language?: string | null
          last_pushed_at?: string | null
          name: string
          stars?: number | null
          synced_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          full_name?: string
          github_id?: number
          id?: string
          is_fork?: boolean | null
          is_private?: boolean | null
          language?: string | null
          last_pushed_at?: string | null
          name?: string
          stars?: number | null
          synced_at?: string | null
          url?: string
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          completed: boolean | null
          created_at: string | null
          date: string
          habit_id: string
          id: string
          notes: string | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          date?: string
          habit_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          date?: string
          habit_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          active: boolean | null
          best_streak: number | null
          created_at: string | null
          current_streak: number | null
          description: string | null
          difficulty: string | null
          frequency: string
          icon: string | null
          id: string
          is_positive: boolean | null
          last_completed_date: string | null
          module: string | null
          name: string
          negative_score: number | null
          positive_score: number | null
          streak_freeze_count: number | null
          target_days: number | null
          total_completions: number | null
        }
        Insert: {
          active?: boolean | null
          best_streak?: number | null
          created_at?: string | null
          current_streak?: number | null
          description?: string | null
          difficulty?: string | null
          frequency: string
          icon?: string | null
          id?: string
          is_positive?: boolean | null
          last_completed_date?: string | null
          module?: string | null
          name: string
          negative_score?: number | null
          positive_score?: number | null
          streak_freeze_count?: number | null
          target_days?: number | null
          total_completions?: number | null
        }
        Update: {
          active?: boolean | null
          best_streak?: number | null
          created_at?: string | null
          current_streak?: number | null
          description?: string | null
          difficulty?: string | null
          frequency?: string
          icon?: string | null
          id?: string
          is_positive?: boolean | null
          last_completed_date?: string | null
          module?: string | null
          name?: string
          negative_score?: number | null
          positive_score?: number | null
          streak_freeze_count?: number | null
          target_days?: number | null
          total_completions?: number | null
        }
        Relationships: []
      }
      health_observations: {
        Row: {
          category: string
          code: string
          created_at: string | null
          display: string
          external_id: string | null
          id: string
          notes: string | null
          observed_at: string
          raw_payload: Json | null
          source: string
          unit: string | null
          value_bool: boolean | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          display: string
          external_id?: string | null
          id?: string
          notes?: string | null
          observed_at?: string
          raw_payload?: Json | null
          source?: string
          unit?: string | null
          value_bool?: boolean | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          display?: string
          external_id?: string | null
          id?: string
          notes?: string | null
          observed_at?: string
          raw_payload?: Json | null
          source?: string
          unit?: string | null
          value_bool?: boolean | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: []
      }
      hobby_logs: {
        Row: {
          activity: string
          created_at: string
          duration_min: number | null
          id: string
          logged_at: string
          notes: string | null
        }
        Insert: {
          activity: string
          created_at?: string
          duration_min?: number | null
          id?: string
          logged_at?: string
          notes?: string | null
        }
        Update: {
          activity?: string
          created_at?: string
          duration_min?: number | null
          id?: string
          logged_at?: string
          notes?: string | null
        }
        Relationships: []
      }
      housing_bills: {
        Row: {
          active: boolean | null
          amount: number | null
          auto_debit: boolean | null
          due_day: number | null
          id: string
          metadata: Json | null
          name: string
          notes: string | null
          paid_at: string | null
          reference_month: string | null
          residence_id: string | null
          status: string
        }
        Insert: {
          active?: boolean | null
          amount?: number | null
          auto_debit?: boolean | null
          due_day?: number | null
          id?: string
          metadata?: Json | null
          name: string
          notes?: string | null
          paid_at?: string | null
          reference_month?: string | null
          residence_id?: string | null
          status?: string
        }
        Update: {
          active?: boolean | null
          amount?: number | null
          auto_debit?: boolean | null
          due_day?: number | null
          id?: string
          metadata?: Json | null
          name?: string
          notes?: string | null
          paid_at?: string | null
          reference_month?: string | null
          residence_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "housing_bills_residence_id_fkey"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          channel: string | null
          created_at: string | null
          date: string
          duration_minutes: number | null
          id: string
          metadata: Json | null
          person_id: string
          sentiment: string | null
          summary: string | null
          type: string
        }
        Insert: {
          channel?: string | null
          created_at?: string | null
          date?: string
          duration_minutes?: number | null
          id?: string
          metadata?: Json | null
          person_id: string
          sentiment?: string | null
          summary?: string | null
          type: string
        }
        Update: {
          channel?: string | null
          created_at?: string | null
          date?: string
          duration_minutes?: number | null
          id?: string
          metadata?: Json | null
          person_id?: string
          sentiment?: string | null
          summary?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_labels: {
        Row: {
          color: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          objective_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          objective_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          objective_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issue_labels_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_states: {
        Row: {
          color: string
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          objective_id: string | null
          position: number
          type: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          objective_id?: string | null
          position?: number
          type?: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          objective_id?: string | null
          position?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_states_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          content: string
          created_at: string | null
          date: string
          energy: number | null
          id: string
          metadata: Json | null
          mood: number | null
          tags: string[] | null
          type: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          date?: string
          energy?: number | null
          id?: string
          metadata?: Json | null
          mood?: number | null
          tags?: string[] | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          date?: string
          energy?: number | null
          id?: string
          metadata?: Json | null
          mood?: number | null
          tags?: string[] | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      knowledge_collections: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_public: boolean | null
          name: string
          parent_id: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_collections_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "knowledge_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_note_collections: {
        Row: {
          added_at: string | null
          collection_id: string
          note_id: string
        }
        Insert: {
          added_at?: string | null
          collection_id: string
          note_id: string
        }
        Update: {
          added_at?: string | null
          collection_id?: string
          note_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_note_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "knowledge_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_note_collections_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "knowledge_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_notes: {
        Row: {
          author: string | null
          auto_tagged: boolean | null
          checksum: string | null
          content: string
          created_at: string | null
          favicon_url: string | null
          id: string
          is_archived: boolean | null
          is_read: boolean | null
          is_starred: boolean | null
          metadata: Json | null
          module: string | null
          published_at: string | null
          reading_time_minutes: number | null
          screenshot_url: string | null
          source: string | null
          summary: string | null
          tags: string[] | null
          title: string | null
          type: string
          updated_at: string | null
          url: string | null
          word_count: number | null
        }
        Insert: {
          author?: string | null
          auto_tagged?: boolean | null
          checksum?: string | null
          content: string
          created_at?: string | null
          favicon_url?: string | null
          id?: string
          is_archived?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          metadata?: Json | null
          module?: string | null
          published_at?: string | null
          reading_time_minutes?: number | null
          screenshot_url?: string | null
          source?: string | null
          summary?: string | null
          tags?: string[] | null
          title?: string | null
          type?: string
          updated_at?: string | null
          url?: string | null
          word_count?: number | null
        }
        Update: {
          author?: string | null
          auto_tagged?: boolean | null
          checksum?: string | null
          content?: string
          created_at?: string | null
          favicon_url?: string | null
          id?: string
          is_archived?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          metadata?: Json | null
          module?: string | null
          published_at?: string | null
          reading_time_minutes?: number | null
          screenshot_url?: string | null
          source?: string | null
          summary?: string | null
          tags?: string[] | null
          title?: string | null
          type?: string
          updated_at?: string | null
          url?: string | null
          word_count?: number | null
        }
        Relationships: []
      }
      knowledge_processing_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          error: string | null
          id: string
          note_id: string
          processed_at: string | null
          status: string | null
          tasks: string[]
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error?: string | null
          id?: string
          note_id: string
          processed_at?: string | null
          status?: string | null
          tasks?: string[]
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error?: string | null
          id?: string
          note_id?: string
          processed_at?: string | null
          status?: string | null
          tasks?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_processing_queue_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "knowledge_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_results: {
        Row: {
          collected_at: string
          created_at: string | null
          exam_type: string | null
          id: string
          lab_name: string | null
          name: string
          notes: string | null
          reference_max: number | null
          reference_min: number | null
          status: string | null
          unit: string | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          collected_at: string
          created_at?: string | null
          exam_type?: string | null
          id?: string
          lab_name?: string | null
          name: string
          notes?: string | null
          reference_max?: number | null
          reference_min?: number | null
          status?: string | null
          unit?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          collected_at?: string
          created_at?: string | null
          exam_type?: string | null
          id?: string
          lab_name?: string | null
          name?: string
          notes?: string | null
          reference_max?: number | null
          reference_min?: number | null
          status?: string | null
          unit?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: []
      }
      legal_entities: {
        Row: {
          active: boolean | null
          document: string | null
          id: string
          metadata: Json | null
          name: string
          notes: string | null
          registration_date: string | null
          type: string
        }
        Insert: {
          active?: boolean | null
          document?: string | null
          id?: string
          metadata?: Json | null
          name: string
          notes?: string | null
          registration_date?: string | null
          type: string
        }
        Update: {
          active?: boolean | null
          document?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          notes?: string | null
          registration_date?: string | null
          type?: string
        }
        Relationships: []
      }
      legal_obligations: {
        Row: {
          amount: number | null
          created_at: string | null
          due_date: string
          entity_id: string | null
          frequency: string | null
          id: string
          metadata: Json | null
          name: string
          notes: string | null
          status: string
          type: string
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          due_date: string
          entity_id?: string | null
          frequency?: string | null
          id?: string
          metadata?: Json | null
          name: string
          notes?: string | null
          status?: string
          type: string
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          due_date?: string
          entity_id?: string | null
          frequency?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          notes?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_obligations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_logs: {
        Row: {
          category: string | null
          cost: number | null
          date: string
          description: string
          done_at: string | null
          id: string
          next_due_at: string | null
          notes: string | null
          residence_id: string | null
        }
        Insert: {
          category?: string | null
          cost?: number | null
          date?: string
          description: string
          done_at?: string | null
          id?: string
          next_due_at?: string | null
          notes?: string | null
          residence_id?: string | null
        }
        Update: {
          category?: string | null
          cost?: number | null
          date?: string
          description?: string
          done_at?: string | null
          id?: string
          next_due_at?: string | null
          notes?: string | null
          residence_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_residence_id_fkey"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
        ]
      }
      media_items: {
        Row: {
          created_at: string
          finished_at: string | null
          genre: string | null
          id: string
          notes: string | null
          platform: string | null
          rating: number | null
          started_at: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          genre?: string | null
          id?: string
          notes?: string | null
          platform?: string | null
          rating?: number | null
          started_at?: string | null
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          genre?: string | null
          id?: string
          notes?: string | null
          platform?: string | null
          rating?: number | null
          started_at?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      medication_logs: {
        Row: {
          created_at: string | null
          dose_actual: string | null
          id: string
          medication_id: string
          notes: string | null
          scheduled_at: string
          skipped_reason: string | null
          taken: boolean
          taken_at: string | null
        }
        Insert: {
          created_at?: string | null
          dose_actual?: string | null
          id?: string
          medication_id: string
          notes?: string | null
          scheduled_at?: string
          skipped_reason?: string | null
          taken?: boolean
          taken_at?: string | null
        }
        Update: {
          created_at?: string | null
          dose_actual?: string | null
          id?: string
          medication_id?: string
          notes?: string | null
          scheduled_at?: string
          skipped_reason?: string | null
          taken?: boolean
          taken_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medication_logs_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          active: boolean | null
          active_ingredient: string | null
          created_at: string | null
          dosage: string | null
          end_date: string | null
          frequency: string
          id: string
          indication: string | null
          name: string
          notes: string | null
          prescriber: string | null
          route: string | null
          start_date: string | null
        }
        Insert: {
          active?: boolean | null
          active_ingredient?: string | null
          created_at?: string | null
          dosage?: string | null
          end_date?: string | null
          frequency: string
          id?: string
          indication?: string | null
          name: string
          notes?: string | null
          prescriber?: string | null
          route?: string | null
          start_date?: string | null
        }
        Update: {
          active?: boolean | null
          active_ingredient?: string | null
          created_at?: string | null
          dosage?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          indication?: string | null
          name?: string
          notes?: string | null
          prescriber?: string | null
          route?: string | null
          start_date?: string | null
        }
        Relationships: []
      }
      modules: {
        Row: {
          config: Json | null
          created_at: string | null
          enabled: boolean | null
          id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          enabled?: boolean | null
          id: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
        }
        Relationships: []
      }
      note_relations: {
        Row: {
          created_at: string | null
          id: string
          relation_type: string | null
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          relation_type?: string | null
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          relation_type?: string | null
          source_id?: string
          source_type?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      nutrition_logs: {
        Row: {
          calories: number | null
          carbs_g: number | null
          created_at: string | null
          description: string
          fat_g: number | null
          fiber_g: number | null
          id: string
          logged_at: string
          meal_type: string | null
          notes: string | null
          protein_g: number | null
          source: string
        }
        Insert: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string | null
          description: string
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          logged_at?: string
          meal_type?: string | null
          notes?: string | null
          protein_g?: number | null
          source?: string
        }
        Update: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string | null
          description?: string
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          logged_at?: string
          meal_type?: string | null
          notes?: string | null
          protein_g?: number | null
          source?: string
        }
        Relationships: []
      }
      objectives: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          module: string | null
          parent_id: string | null
          priority: number
          progress: number
          status: string
          target_date: string | null
          timeframe: string
          title: string
          updated_at: string | null
          value_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          module?: string | null
          parent_id?: string | null
          priority?: number
          progress?: number
          status?: string
          target_date?: string | null
          timeframe: string
          title: string
          updated_at?: string | null
          value_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          module?: string | null
          parent_id?: string | null
          priority?: number
          progress?: number
          status?: string
          target_date?: string | null
          timeframe?: string
          title?: string
          updated_at?: string | null
          value_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objectives_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_value_id_fkey"
            columns: ["value_id"]
            isOneToOne: false
            referencedRelation: "personal_values"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_questions: {
        Row: {
          answer_summary: string | null
          answered_at: string | null
          asked_at: string | null
          block: string
          created_at: string | null
          id: string
          modules_affected: string[] | null
          priority: number | null
          question: string
          question_key: string
          reason: string | null
          session_id: string | null
          status: string | null
        }
        Insert: {
          answer_summary?: string | null
          answered_at?: string | null
          asked_at?: string | null
          block: string
          created_at?: string | null
          id?: string
          modules_affected?: string[] | null
          priority?: number | null
          question: string
          question_key: string
          reason?: string | null
          session_id?: string | null
          status?: string | null
        }
        Update: {
          answer_summary?: string | null
          answered_at?: string | null
          asked_at?: string | null
          block?: string
          created_at?: string | null
          id?: string
          modules_affected?: string[] | null
          priority?: number | null
          question?: string
          question_key?: string
          reason?: string | null
          session_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      people: {
        Row: {
          active: boolean | null
          birthday: string | null
          city: string | null
          company: string | null
          company_id: string | null
          contact_frequency: string | null
          created_at: string | null
          email: string | null
          field_schema: Json | null
          first_met_at: string | null
          first_met_location: string | null
          how_we_met: string | null
          id: string
          importance: number
          job_title: string | null
          last_interaction: string | null
          linkedin_url: string | null
          metadata: Json | null
          name: string
          next_contact_reminder: string | null
          notes: string | null
          phone: string | null
          preferred_contact_method: string | null
          relationship: string | null
          role: string | null
          twitter_handle: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          birthday?: string | null
          city?: string | null
          company?: string | null
          company_id?: string | null
          contact_frequency?: string | null
          created_at?: string | null
          email?: string | null
          field_schema?: Json | null
          first_met_at?: string | null
          first_met_location?: string | null
          how_we_met?: string | null
          id?: string
          importance?: number
          job_title?: string | null
          last_interaction?: string | null
          linkedin_url?: string | null
          metadata?: Json | null
          name: string
          next_contact_reminder?: string | null
          notes?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          relationship?: string | null
          role?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          birthday?: string | null
          city?: string | null
          company?: string | null
          company_id?: string | null
          contact_frequency?: string | null
          created_at?: string | null
          email?: string | null
          field_schema?: Json | null
          first_met_at?: string | null
          first_met_location?: string | null
          how_we_met?: string | null
          id?: string
          importance?: number
          job_title?: string | null
          last_interaction?: string | null
          linkedin_url?: string | null
          metadata?: Json | null
          name?: string
          next_contact_reminder?: string | null
          notes?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          relationship?: string | null
          role?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      people_relationships: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          person_a: string
          person_b: string
          relationship_type: string
          since_date: string | null
          strength: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          person_a: string
          person_b: string
          relationship_type: string
          since_date?: string | null
          strength?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          person_a?: string
          person_b?: string
          relationship_type?: string
          since_date?: string | null
          strength?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "people_relationships_person_a_fkey"
            columns: ["person_a"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_relationships_person_b_fkey"
            columns: ["person_b"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_values: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          priority: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          priority?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          priority?: number
        }
        Relationships: []
      }
      portfolio_assets: {
        Row: {
          asset_class: string
          created_at: string | null
          currency: string | null
          exchange: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          metadata: Json | null
          name: string
          sector: string | null
          ticker: string
        }
        Insert: {
          asset_class: string
          created_at?: string | null
          currency?: string | null
          exchange?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          metadata?: Json | null
          name: string
          sector?: string | null
          ticker: string
        }
        Update: {
          asset_class?: string
          created_at?: string | null
          currency?: string | null
          exchange?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          metadata?: Json | null
          name?: string
          sector?: string | null
          ticker?: string
        }
        Relationships: []
      }
      portfolio_quotes: {
        Row: {
          asset_id: string
          change_pct: number | null
          fetched_at: string | null
          id: string
          market_cap: number | null
          price: number
          quote_date: string
        }
        Insert: {
          asset_id: string
          change_pct?: number | null
          fetched_at?: string | null
          id?: string
          market_cap?: number | null
          price: number
          quote_date?: string
        }
        Update: {
          asset_id?: string
          change_pct?: number | null
          fetched_at?: string | null
          id?: string
          market_cap?: number | null
          price?: number
          quote_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_quotes_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "portfolio_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_quotes_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "portfolio_positions"
            referencedColumns: ["asset_id"]
          },
        ]
      }
      portfolio_transactions: {
        Row: {
          account_id: string | null
          asset_id: string
          created_at: string | null
          date: string
          fee: number | null
          id: string
          notes: string | null
          quantity: number
          total_amount: number | null
          type: string
          unit_price: number
        }
        Insert: {
          account_id?: string | null
          asset_id: string
          created_at?: string | null
          date: string
          fee?: number | null
          id?: string
          notes?: string | null
          quantity: number
          total_amount?: number | null
          type: string
          unit_price: number
        }
        Update: {
          account_id?: string | null
          asset_id?: string
          created_at?: string | null
          date?: string
          fee?: number | null
          id?: string
          notes?: string | null
          quantity?: number
          total_amount?: number | null
          type?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "portfolio_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "portfolio_positions"
            referencedColumns: ["asset_id"]
          },
        ]
      }
      profile: {
        Row: {
          birth_date: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          name: string
          updated_at: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          name: string
          updated_at?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          description: string | null
          end_date: string | null
          github_repo: string | null
          id: string
          metadata: Json | null
          name: string
          priority: number
          start_date: string | null
          status: string
          workspace_id: string | null
        }
        Insert: {
          description?: string | null
          end_date?: string | null
          github_repo?: string | null
          id?: string
          metadata?: Json | null
          name: string
          priority?: number
          start_date?: string | null
          status?: string
          workspace_id?: string | null
        }
        Update: {
          description?: string | null
          end_date?: string | null
          github_repo?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          priority?: number
          start_date?: string | null
          status?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reflections: {
        Row: {
          content: string
          created_at: string
          id: string
          logged_at: string
          mood: number | null
          search_vector: unknown
          tags: string[]
          type: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          logged_at?: string
          mood?: number | null
          search_vector?: unknown
          tags?: string[]
          type?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          logged_at?: string
          mood?: number | null
          search_vector?: unknown
          tags?: string[]
          type?: string
        }
        Relationships: []
      }
      residences: {
        Row: {
          active: boolean | null
          address: string | null
          id: string
          is_primary: boolean | null
          metadata: Json | null
          name: string
          rent: number | null
          rent_due_day: number | null
          type: string
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          id?: string
          is_primary?: boolean | null
          metadata?: Json | null
          name: string
          rent?: number | null
          rent_due_day?: number | null
          type: string
        }
        Update: {
          active?: boolean | null
          address?: string | null
          id?: string
          is_primary?: boolean | null
          metadata?: Json | null
          name?: string
          rent?: number | null
          rent_due_day?: number | null
          type?: string
        }
        Relationships: []
      }
      security_items: {
        Row: {
          id: string
          last_verified: string | null
          metadata: Json | null
          name: string
          next_review: string | null
          notes: string | null
          status: string
          type: string
        }
        Insert: {
          id?: string
          last_verified?: string | null
          metadata?: Json | null
          name: string
          next_review?: string | null
          notes?: string | null
          status?: string
          type: string
        }
        Update: {
          id?: string
          last_verified?: string | null
          metadata?: Json | null
          name?: string
          next_review?: string | null
          notes?: string | null
          status?: string
          type?: string
        }
        Relationships: []
      }
      session_archives: {
        Row: {
          abstract: string
          channel: string
          created_at: string | null
          id: string
          memories_extracted: number | null
          message_count: number
          messages: Json
          overview: string
          session_id: string
          token_count: number | null
        }
        Insert: {
          abstract: string
          channel?: string
          created_at?: string | null
          id?: string
          memories_extracted?: number | null
          message_count: number
          messages: Json
          overview: string
          session_id: string
          token_count?: number | null
        }
        Update: {
          abstract?: string
          channel?: string
          created_at?: string | null
          id?: string
          memories_extracted?: number | null
          message_count?: number
          messages?: Json
          overview?: string
          session_id?: string
          token_count?: number | null
        }
        Relationships: []
      }
      session_memories: {
        Row: {
          content: string
          created_at: string | null
          id: string
          memory_type: string | null
          session_id: string
          template_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          memory_type?: string | null
          session_id: string
          template_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          memory_type?: string | null
          session_id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_memories_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "agent_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sleep_sessions: {
        Row: {
          created_at: string | null
          date: string
          deep_pct: number | null
          duration_h: number | null
          external_id: string | null
          hr_avg: number | null
          id: string
          interruptions: number | null
          light_pct: number | null
          notes: string | null
          quality: number | null
          raw_payload: Json | null
          rem_pct: number | null
          sleep_end: string | null
          sleep_start: string | null
          source: string
        }
        Insert: {
          created_at?: string | null
          date?: string
          deep_pct?: number | null
          duration_h?: number | null
          external_id?: string | null
          hr_avg?: number | null
          id?: string
          interruptions?: number | null
          light_pct?: number | null
          notes?: string | null
          quality?: number | null
          raw_payload?: Json | null
          rem_pct?: number | null
          sleep_end?: string | null
          sleep_start?: string | null
          source?: string
        }
        Update: {
          created_at?: string | null
          date?: string
          deep_pct?: number | null
          duration_h?: number | null
          external_id?: string | null
          hr_avg?: number | null
          id?: string
          interruptions?: number | null
          light_pct?: number | null
          notes?: string | null
          quality?: number | null
          raw_payload?: Json | null
          rem_pct?: number | null
          sleep_end?: string | null
          sleep_start?: string | null
          source?: string
        }
        Relationships: []
      }
      social_goals: {
        Row: {
          created_at: string
          current: number
          id: string
          metric: string
          notes: string | null
          period: string
          platform: string
          target: number
        }
        Insert: {
          created_at?: string
          current?: number
          id?: string
          metric: string
          notes?: string | null
          period?: string
          platform: string
          target: number
        }
        Update: {
          created_at?: string
          current?: number
          id?: string
          metric?: string
          notes?: string | null
          period?: string
          platform?: string
          target?: number
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          content: string | null
          created_at: string
          engagement_comments: number | null
          engagement_likes: number | null
          engagement_shares: number | null
          id: string
          notes: string | null
          objective_id: string | null
          person_id: string | null
          platform: string
          project_id: string | null
          published_at: string | null
          scheduled_at: string | null
          status: string
          tags: string[]
          task_id: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          engagement_comments?: number | null
          engagement_likes?: number | null
          engagement_shares?: number | null
          id?: string
          notes?: string | null
          objective_id?: string | null
          person_id?: string | null
          platform: string
          project_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          tags?: string[]
          task_id?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          engagement_comments?: number | null
          engagement_likes?: number | null
          engagement_shares?: number | null
          id?: string
          notes?: string | null
          objective_id?: string | null
          person_id?: string | null
          platform?: string
          project_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          tags?: string[]
          task_id?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      special_dates: {
        Row: {
          created_at: string | null
          date: string
          description: string | null
          id: string
          is_year_unknown: boolean | null
          label: string
          person_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          is_year_unknown?: boolean | null
          label: string
          person_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          is_year_unknown?: boolean | null
          label?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_dates_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      substance_logs: {
        Row: {
          context: string | null
          cost_brl: number | null
          created_at: string | null
          id: string
          logged_at: string
          notes: string | null
          quantity: number | null
          route: string | null
          substance: string
          unit: string | null
        }
        Insert: {
          context?: string | null
          cost_brl?: number | null
          created_at?: string | null
          id?: string
          logged_at?: string
          notes?: string | null
          quantity?: number | null
          route?: string | null
          substance: string
          unit?: string | null
        }
        Update: {
          context?: string | null
          cost_brl?: number | null
          created_at?: string | null
          id?: string
          logged_at?: string
          notes?: string | null
          quantity?: number | null
          route?: string | null
          substance?: string
          unit?: string | null
        }
        Relationships: []
      }
      tags: {
        Row: {
          category: string | null
          color: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          color?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      task_objectives: {
        Row: {
          created_at: string | null
          objective_id: string
          task_id: string
        }
        Insert: {
          created_at?: string | null
          objective_id: string
          task_id: string
        }
        Update: {
          created_at?: string | null
          objective_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_objectives_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_objectives_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_people_ids: string[] | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          estimate_points: number | null
          id: string
          labels: string[] | null
          metadata: Json | null
          module: string | null
          objective_id: string | null
          parent_id: string | null
          priority: string
          sequence_id: number
          sort_order: number | null
          started_at: string | null
          state_id: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assignee_people_ids?: string[] | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          estimate_points?: number | null
          id?: string
          labels?: string[] | null
          metadata?: Json | null
          module?: string | null
          objective_id?: string | null
          parent_id?: string | null
          priority?: string
          sequence_id?: number
          sort_order?: number | null
          started_at?: string | null
          state_id?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assignee_people_ids?: string[] | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          estimate_points?: number | null
          id?: string
          labels?: string[] | null
          metadata?: Json | null
          module?: string | null
          objective_id?: string | null
          parent_id?: string | null
          priority?: string
          sequence_id?: number
          sort_order?: number | null
          started_at?: string | null
          state_id?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "issue_states"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_configs: {
        Row: {
          description: string | null
          enabled: boolean
          module_name: string
          parameters: Json | null
          tool_name: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          module_name: string
          parameters?: Json | null
          tool_name: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          module_name?: string
          parameters?: Json | null
          tool_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      work_logs: {
        Row: {
          billable: boolean | null
          created_at: string | null
          date: string
          description: string | null
          duration_minutes: number
          id: string
          metadata: Json | null
          project_id: string | null
          workspace_id: string | null
        }
        Insert: {
          billable?: boolean | null
          created_at?: string | null
          date?: string
          description?: string | null
          duration_minutes: number
          id?: string
          metadata?: Json | null
          project_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          billable?: boolean | null
          created_at?: string | null
          date?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          metadata?: Json | null
          project_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          avg_hr: number | null
          calories: number | null
          created_at: string | null
          date: string
          distance_km: number | null
          duration_m: number | null
          ended_at: string | null
          external_id: string | null
          id: string
          max_hr: number | null
          notes: string | null
          raw_payload: Json | null
          source: string
          started_at: string | null
          type: string
        }
        Insert: {
          avg_hr?: number | null
          calories?: number | null
          created_at?: string | null
          date?: string
          distance_km?: number | null
          duration_m?: number | null
          ended_at?: string | null
          external_id?: string | null
          id?: string
          max_hr?: number | null
          notes?: string | null
          raw_payload?: Json | null
          source?: string
          started_at?: string | null
          type: string
        }
        Update: {
          avg_hr?: number | null
          calories?: number | null
          created_at?: string | null
          date?: string
          distance_km?: number | null
          duration_m?: number | null
          ended_at?: string | null
          external_id?: string | null
          id?: string
          max_hr?: number | null
          notes?: string | null
          raw_payload?: Json | null
          source?: string
          started_at?: string | null
          type?: string
        }
        Relationships: []
      }
      workout_sets: {
        Row: {
          duration_s: number | null
          exercise_name: string
          id: string
          notes: string | null
          reps: number | null
          rpe: number | null
          set_number: number
          weight_kg: number | null
          workout_id: string
        }
        Insert: {
          duration_s?: number | null
          exercise_name: string
          id?: string
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          set_number: number
          weight_kg?: number | null
          workout_id: string
        }
        Update: {
          duration_s?: number | null
          exercise_name?: string
          id?: string
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          set_number?: number
          weight_kg?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_template_sets: {
        Row: {
          exercise_id: string
          id: string
          notes: string | null
          rest_seconds: number | null
          set_order: number
          target_reps: string
          target_sets: number
          target_weight_kg: number | null
          template_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          notes?: string | null
          rest_seconds?: number | null
          set_order?: number
          target_reps: string
          target_sets?: number
          target_weight_kg?: number | null
          template_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          notes?: string | null
          rest_seconds?: number | null
          set_order?: number
          target_reps?: string
          target_sets?: number
          target_weight_kg?: number | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_template_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_template_sets_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          created_at: string | null
          description: string | null
          estimated_duration_m: number | null
          frequency: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          estimated_duration_m?: number | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          estimated_duration_m?: number | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          active: boolean | null
          hourly_rate: number | null
          id: string
          metadata: Json | null
          monthly_income: number | null
          name: string
          type: string
        }
        Insert: {
          active?: boolean | null
          hourly_rate?: number | null
          id?: string
          metadata?: Json | null
          monthly_income?: number | null
          name: string
          type: string
        }
        Update: {
          active?: boolean | null
          hourly_rate?: number | null
          id?: string
          metadata?: Json | null
          monthly_income?: number | null
          name?: string
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      daily_health_summary: {
        Row: {
          calories_total: number | null
          cannabis_g: number | null
          date: string | null
          energy: number | null
          exercised: boolean | null
          meds_skipped: number | null
          meds_taken: number | null
          mood: number | null
          sleep_hours: number | null
          sleep_quality: number | null
          substance_cost: number | null
          tobacco_qty: number | null
          weight_kg: number | null
          workout_min: number | null
          workout_type: string | null
        }
        Relationships: []
      }
      finance_budget_vs_actual: {
        Row: {
          available_amount: number | null
          budget_id: string | null
          budgeted_amount: number | null
          carryover_amount: number | null
          category_id: string | null
          category_name: string | null
          category_type: string | null
          month: string | null
          remaining_amount: number | null
          spent_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_positions: {
        Row: {
          asset_class: string | null
          asset_id: string | null
          average_price: number | null
          currency: string | null
          current_price: number | null
          current_value: number | null
          name: string | null
          price_date: string | null
          quantity: number | null
          sector: string | null
          ticker: string | null
          today_change_pct: number | null
          total_cost: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_habit_score: { Args: { p_habit_id: string }; Returns: Json }
      get_habits_at_risk: {
        Args: never
        Returns: {
          current_streak: number
          difficulty: string
          frequency: string
          habit_id: string
          habit_name: string
          last_completed_date: string
        }[]
      }
      increment_memory_access: {
        Args: { memory_ids: string[] }
        Returns: undefined
      }
      match_memories: {
        Args: {
          filter_type?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          memory_type: string
          similarity: number
        }[]
      }
      update_habit_streak: { Args: { p_habit_id: string }; Returns: Json }
      update_memory_embedding: {
        Args: { embedding_vector: string; memory_id: string }
        Returns: undefined
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
