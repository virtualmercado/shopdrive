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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          details: string | null
          id: string
          ip_address: string | null
          merchant_id: string
          reason: string
          rejection_reason: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          ticket_id: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          merchant_id: string
          reason: string
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          ticket_id?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          merchant_id?: string
          reason?: string
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          ticket_id?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      ai_product_logs: {
        Row: {
          benefits: string | null
          category: string | null
          channel: string
          channel_variants: Json | null
          created_at: string
          description_generated: string | null
          differentiators: string | null
          error_message: string | null
          id: string
          materials: string | null
          product_id: string | null
          product_type: string | null
          status: string
          store_id: string
          target_audience: string | null
          title_generated: string | null
          tone: string
          usage_instructions: string | null
          user_id: string
          variations_info: string | null
          warranty_info: string | null
        }
        Insert: {
          benefits?: string | null
          category?: string | null
          channel: string
          channel_variants?: Json | null
          created_at?: string
          description_generated?: string | null
          differentiators?: string | null
          error_message?: string | null
          id?: string
          materials?: string | null
          product_id?: string | null
          product_type?: string | null
          status?: string
          store_id: string
          target_audience?: string | null
          title_generated?: string | null
          tone: string
          usage_instructions?: string | null
          user_id: string
          variations_info?: string | null
          warranty_info?: string | null
        }
        Update: {
          benefits?: string | null
          category?: string | null
          channel?: string
          channel_variants?: Json | null
          created_at?: string
          description_generated?: string | null
          differentiators?: string | null
          error_message?: string | null
          id?: string
          materials?: string | null
          product_id?: string | null
          product_type?: string | null
          status?: string
          store_id?: string
          target_audience?: string | null
          title_generated?: string | null
          tone?: string
          usage_instructions?: string | null
          user_id?: string
          variations_info?: string | null
          warranty_info?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_store_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_alert_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      boleto_payments: {
        Row: {
          amount: number
          barcode: string | null
          boleto_url: string | null
          created_at: string
          digitable_line: string | null
          expires_at: string | null
          external_payment_id: string | null
          gateway: string
          id: string
          order_id: string
          paid_at: string | null
          status: string
          store_owner_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          barcode?: string | null
          boleto_url?: string | null
          created_at?: string
          digitable_line?: string | null
          expires_at?: string | null
          external_payment_id?: string | null
          gateway?: string
          id?: string
          order_id: string
          paid_at?: string | null
          status?: string
          store_owner_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          barcode?: string | null
          boleto_url?: string | null
          created_at?: string
          digitable_line?: string | null
          expires_at?: string | null
          external_payment_id?: string | null
          gateway?: string
          id?: string
          order_id?: string
          paid_at?: string | null
          status?: string
          store_owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boleto_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_template_categories: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_template_categories_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "brand_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_template_pages: {
        Row: {
          content: string | null
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean | null
          slug: string
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          slug: string
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          slug?: string
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_template_pages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "brand_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_template_products: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          images: string[] | null
          is_active: boolean | null
          name: string
          price: number
          sku: string | null
          template_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          name: string
          price?: number
          sku?: string | null
          template_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          name?: string
          price?: number
          sku?: string | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_template_products_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "brand_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_templates: {
        Row: {
          banner_desktop_urls: Json | null
          banner_mobile_urls: Json | null
          button_bg_color: string | null
          button_text_color: string | null
          created_at: string
          description: string | null
          facebook_url: string | null
          font_family: string | null
          footer_bg_color: string | null
          footer_text_color: string | null
          id: string
          instagram_url: string | null
          is_link_active: boolean
          link_clicks: number
          link_created_at: string | null
          logo_url: string | null
          max_products: number
          name: string
          paid_conversions: number
          primary_color: string | null
          products_count: number
          secondary_color: string | null
          show_whatsapp_button: boolean | null
          signups_started: number
          source_profile_id: string | null
          status: Database["public"]["Enums"]["brand_template_status"]
          store_name: string | null
          stores_created: number
          template_password: string | null
          template_slug: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          banner_desktop_urls?: Json | null
          banner_mobile_urls?: Json | null
          button_bg_color?: string | null
          button_text_color?: string | null
          created_at?: string
          description?: string | null
          facebook_url?: string | null
          font_family?: string | null
          footer_bg_color?: string | null
          footer_text_color?: string | null
          id?: string
          instagram_url?: string | null
          is_link_active?: boolean
          link_clicks?: number
          link_created_at?: string | null
          logo_url?: string | null
          max_products?: number
          name: string
          paid_conversions?: number
          primary_color?: string | null
          products_count?: number
          secondary_color?: string | null
          show_whatsapp_button?: boolean | null
          signups_started?: number
          source_profile_id?: string | null
          status?: Database["public"]["Enums"]["brand_template_status"]
          store_name?: string | null
          stores_created?: number
          template_password?: string | null
          template_slug?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          banner_desktop_urls?: Json | null
          banner_mobile_urls?: Json | null
          button_bg_color?: string | null
          button_text_color?: string | null
          created_at?: string
          description?: string | null
          facebook_url?: string | null
          font_family?: string | null
          footer_bg_color?: string | null
          footer_text_color?: string | null
          id?: string
          instagram_url?: string | null
          is_link_active?: boolean
          link_clicks?: number
          link_created_at?: string | null
          logo_url?: string | null
          max_products?: number
          name?: string
          paid_conversions?: number
          primary_color?: string | null
          products_count?: number
          secondary_color?: string | null
          show_whatsapp_button?: boolean | null
          signups_started?: number
          source_profile_id?: string | null
          status?: Database["public"]["Enums"]["brand_template_status"]
          store_name?: string | null
          stores_created?: number
          template_password?: string | null
          template_slug?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_templates_source_profile_id_fkey"
            columns: ["source_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_templates_source_profile_id_fkey"
            columns: ["source_profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_templates_source_profile_id_fkey"
            columns: ["source_profile_id"]
            isOneToOne: false
            referencedRelation: "public_store_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_banners: {
        Row: {
          banner_key: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          media_id: string | null
          media_type: string | null
          media_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          banner_key: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          media_id?: string | null
          media_type?: string | null
          media_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          banner_key?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          media_id?: string | null
          media_type?: string | null
          media_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cms_banners_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_files"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_billing_alerts: {
        Row: {
          alert_key: string
          created_at: string
          cta_text: string
          cta_url: string
          id: string
          is_active: boolean
          message: string
          title: string
          updated_at: string
        }
        Insert: {
          alert_key: string
          created_at?: string
          cta_text: string
          cta_url?: string
          id?: string
          is_active?: boolean
          message: string
          title: string
          updated_at?: string
        }
        Update: {
          alert_key?: string
          created_at?: string
          cta_text?: string
          cta_url?: string
          id?: string
          is_active?: boolean
          message?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_landing_content: {
        Row: {
          content: Json
          created_at: string
          id: string
          is_active: boolean | null
          section_key: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          is_active?: boolean | null
          section_key: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          is_active?: boolean | null
          section_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          company: string | null
          contact_type: string
          cpf_cnpj: string | null
          created_at: string
          email: string
          id: string
          ip_address: string | null
          message: string
          name: string
          problem_type: string | null
          status: string
          store_url: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          contact_type: string
          cpf_cnpj?: string | null
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          message: string
          name: string
          problem_type?: string | null
          status?: string
          store_url?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          contact_type?: string
          cpf_cnpj?: string | null
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          message?: string
          name?: string
          problem_type?: string | null
          status?: string
          store_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      correios_settings: {
        Row: {
          contract_code: string | null
          contract_password: string | null
          created_at: string
          id: string
          is_active: boolean
          origin_zipcode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_code?: string | null
          contract_password?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          origin_zipcode: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_code?: string | null
          contract_password?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          origin_zipcode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coupon_usage: {
        Row: {
          coupon_id: string
          customer_email: string
          id: string
          order_id: string | null
          used_at: string
        }
        Insert: {
          coupon_id: string
          customer_email: string
          id?: string
          order_id?: string | null
          used_at?: string
        }
        Update: {
          coupon_id?: string
          customer_email?: string
          id?: string
          order_id?: string | null
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          min_order_value: number | null
          single_use: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean
          min_order_value?: number | null
          single_use?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          min_order_value?: number | null
          single_use?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          address_type: string | null
          cep: string
          city: string
          complement: string | null
          created_at: string
          customer_id: string
          id: string
          is_default: boolean | null
          neighborhood: string
          number: string
          recipient_name: string
          state: string
          store_owner_id: string | null
          street: string
          updated_at: string
        }
        Insert: {
          address_type?: string | null
          cep: string
          city: string
          complement?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean | null
          neighborhood: string
          number: string
          recipient_name: string
          state: string
          store_owner_id?: string | null
          street: string
          updated_at?: string
        }
        Update: {
          address_type?: string | null
          cep?: string
          city?: string
          complement?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean | null
          neighborhood?: string
          number?: string
          recipient_name?: string
          state?: string
          store_owner_id?: string | null
          street?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_favorites: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          product_id: string
          store_owner_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          product_id: string
          store_owner_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          product_id?: string
          store_owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_group_assignments: {
        Row: {
          created_at: string
          customer_id: string
          group_id: string
          id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          group_id: string
          id?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_group_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_group_assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "customer_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          birth_date: string | null
          cpf: string | null
          created_at: string
          email: string
          full_name: string
          gender: string | null
          home_phone: string | null
          id: string
          person_type: string | null
          phone: string | null
          receive_promotions: boolean | null
          registered_store_id: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          full_name: string
          gender?: string | null
          home_phone?: string | null
          id: string
          person_type?: string | null
          phone?: string | null
          receive_promotions?: boolean | null
          registered_store_id?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          full_name?: string
          gender?: string | null
          home_phone?: string | null
          id?: string
          person_type?: string | null
          phone?: string | null
          receive_promotions?: boolean | null
          registered_store_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      data_exports: {
        Row: {
          completed_at: string | null
          created_at: string
          download_count: number
          error_message: string | null
          expires_at: string | null
          file_path: string | null
          file_size: number | null
          format: string
          id: string
          include_audit: boolean
          include_cadastral: boolean
          include_consents: boolean
          include_financial: boolean
          last_downloaded_at: string | null
          merchant_id: string
          requested_by: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          download_count?: number
          error_message?: string | null
          expires_at?: string | null
          file_path?: string | null
          file_size?: number | null
          format?: string
          id?: string
          include_audit?: boolean
          include_cadastral?: boolean
          include_consents?: boolean
          include_financial?: boolean
          last_downloaded_at?: string | null
          merchant_id: string
          requested_by: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          download_count?: number
          error_message?: string | null
          expires_at?: string | null
          file_path?: string | null
          file_size?: number | null
          format?: string
          id?: string
          include_audit?: boolean
          include_cadastral?: boolean
          include_consents?: boolean
          include_financial?: boolean
          last_downloaded_at?: string | null
          merchant_id?: string
          requested_by?: string
          status?: string
        }
        Relationships: []
      }
      domain_provider_tutorials: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          provider_name: string
          provider_slug: string
          tutorial_content: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          provider_name: string
          provider_slug: string
          tutorial_content?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          provider_name?: string
          provider_slug?: string
          tutorial_content?: Json
          updated_at?: string
        }
        Relationships: []
      }
      domain_verification_logs: {
        Row: {
          created_at: string
          domain_id: string
          error_message: string | null
          expected_value: string | null
          found_value: string | null
          id: string
          status: string
          verification_type: string
        }
        Insert: {
          created_at?: string
          domain_id: string
          error_message?: string | null
          expected_value?: string | null
          found_value?: string | null
          id?: string
          status: string
          verification_type: string
        }
        Update: {
          created_at?: string
          domain_id?: string
          error_message?: string | null
          expected_value?: string | null
          found_value?: string | null
          id?: string
          status?: string
          verification_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_verification_logs_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "merchant_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      dunning_settings: {
        Row: {
          auto_block_enabled: boolean
          banner_enabled: boolean
          email_notifications_enabled: boolean
          grace_period_days: number
          id: string
          max_retry_attempts: number
          updated_at: string
        }
        Insert: {
          auto_block_enabled?: boolean
          banner_enabled?: boolean
          email_notifications_enabled?: boolean
          grace_period_days?: number
          id?: string
          max_retry_attempts?: number
          updated_at?: string
        }
        Update: {
          auto_block_enabled?: boolean
          banner_enabled?: boolean
          email_notifications_enabled?: boolean
          grace_period_days?: number
          id?: string
          max_retry_attempts?: number
          updated_at?: string
        }
        Relationships: []
      }
      faq_items: {
        Row: {
          answer: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      help_articles: {
        Row: {
          category_id: string
          content: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          category_id: string
          content: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          content?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "help_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      help_categories: {
        Row: {
          created_at: string
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          config: Json | null
          created_at: string
          id: string
          is_active: boolean
          last_sync: string | null
          name: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync?: string | null
          name: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync?: string | null
          name?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_link: string | null
          reference_period_end: string
          reference_period_start: string
          status: string
          subscriber_id: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_link?: string | null
          reference_period_end: string
          reference_period_start: string
          status?: string
          subscriber_id: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_link?: string | null
          reference_period_end?: string
          reference_period_start?: string
          status?: string
          subscriber_id?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "public_store_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_response_templates: {
        Row: {
          assunto: string
          categoria: string
          created_at: string
          id: string
          mensagem: string
          updated_at: string
        }
        Insert: {
          assunto: string
          categoria: string
          created_at?: string
          id?: string
          mensagem: string
          updated_at?: string
        }
        Update: {
          assunto?: string
          categoria?: string
          created_at?: string
          id?: string
          mensagem?: string
          updated_at?: string
        }
        Relationships: []
      }
      legal_archive_accounts: {
        Row: {
          billing_history: Json | null
          cpf_cnpj_hash: string | null
          created_at: string
          deleted_at: string
          deletion_audit: Json
          deletion_details: string | null
          deletion_reason: string | null
          export_available: boolean
          export_file_path: string | null
          id: string
          last_export_at: string | null
          merchant_id: string
          plan_history: Json | null
          primary_email: string | null
          privacy_acceptance_logs: Json | null
          retention_policy_version: string
          retention_until: string
          store_name: string | null
          terms_acceptance_logs: Json | null
          ticket_id: string | null
        }
        Insert: {
          billing_history?: Json | null
          cpf_cnpj_hash?: string | null
          created_at: string
          deleted_at?: string
          deletion_audit?: Json
          deletion_details?: string | null
          deletion_reason?: string | null
          export_available?: boolean
          export_file_path?: string | null
          id?: string
          last_export_at?: string | null
          merchant_id: string
          plan_history?: Json | null
          primary_email?: string | null
          privacy_acceptance_logs?: Json | null
          retention_policy_version?: string
          retention_until: string
          store_name?: string | null
          terms_acceptance_logs?: Json | null
          ticket_id?: string | null
        }
        Update: {
          billing_history?: Json | null
          cpf_cnpj_hash?: string | null
          created_at?: string
          deleted_at?: string
          deletion_audit?: Json
          deletion_details?: string | null
          deletion_reason?: string | null
          export_available?: boolean
          export_file_path?: string | null
          id?: string
          last_export_at?: string | null
          merchant_id?: string
          plan_history?: Json | null
          primary_email?: string | null
          privacy_acceptance_logs?: Json | null
          retention_policy_version?: string
          retention_until?: string
          store_name?: string | null
          terms_acceptance_logs?: Json | null
          ticket_id?: string | null
        }
        Relationships: []
      }
      marketing_settings: {
        Row: {
          created_at: string
          domain_verification_code: string | null
          domain_verified: boolean
          google_ads_enabled: boolean
          google_ads_id: string | null
          gtm_enabled: boolean
          gtm_id: string | null
          id: string
          instagram_shopping_connected_at: string | null
          instagram_shopping_status: string
          meta_pixel_enabled: boolean
          meta_pixel_id: string | null
          tiktok_pixel_enabled: boolean
          tiktok_pixel_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain_verification_code?: string | null
          domain_verified?: boolean
          google_ads_enabled?: boolean
          google_ads_id?: string | null
          gtm_enabled?: boolean
          gtm_id?: string | null
          id?: string
          instagram_shopping_connected_at?: string | null
          instagram_shopping_status?: string
          meta_pixel_enabled?: boolean
          meta_pixel_id?: string | null
          tiktok_pixel_enabled?: boolean
          tiktok_pixel_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain_verification_code?: string | null
          domain_verified?: boolean
          google_ads_enabled?: boolean
          google_ads_id?: string | null
          gtm_enabled?: boolean
          gtm_id?: string | null
          id?: string
          instagram_shopping_connected_at?: string | null
          instagram_shopping_status?: string
          meta_pixel_enabled?: boolean
          meta_pixel_id?: string | null
          tiktok_pixel_enabled?: boolean
          tiktok_pixel_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      master_payment_gateways: {
        Row: {
          created_at: string
          display_name: string
          environment: string
          gateway_name: string
          id: string
          is_active: boolean
          is_default: boolean
          mercadopago_access_token: string | null
          mercadopago_public_key: string | null
          pagbank_email: string | null
          pagbank_token: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          environment?: string
          gateway_name: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          mercadopago_access_token?: string | null
          mercadopago_public_key?: string | null
          pagbank_email?: string | null
          pagbank_token?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          environment?: string
          gateway_name?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          mercadopago_access_token?: string | null
          mercadopago_public_key?: string | null
          pagbank_email?: string | null
          pagbank_token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      master_plans: {
        Row: {
          annual_discount_percent: number | null
          created_at: string | null
          display_name: string
          features: Json | null
          id: string
          is_active: boolean | null
          monthly_price: number
          plan_id: string
          updated_at: string | null
        }
        Insert: {
          annual_discount_percent?: number | null
          created_at?: string | null
          display_name: string
          features?: Json | null
          id?: string
          is_active?: boolean | null
          monthly_price: number
          plan_id: string
          updated_at?: string | null
        }
        Update: {
          annual_discount_percent?: number | null
          created_at?: string | null
          display_name?: string
          features?: Json | null
          id?: string
          is_active?: boolean | null
          monthly_price?: number
          plan_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      master_subscription_logs: {
        Row: {
          created_at: string
          event_description: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          payment_id: string | null
          subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_description?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          payment_id?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_description?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          payment_id?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_subscription_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "master_subscription_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_subscription_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "master_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      master_subscription_payments: {
        Row: {
          amount: number
          attempt_number: number | null
          boleto_barcode: string | null
          boleto_digitable_line: string | null
          boleto_expires_at: string | null
          boleto_url: string | null
          created_at: string
          decline_code: string | null
          decline_type: string | null
          gateway: string
          gateway_payment_id: string | null
          gateway_response: Json | null
          gateway_status: string | null
          id: string
          idempotency_key: string | null
          paid_at: string | null
          payment_method: string
          pix_expires_at: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          refunded_at: string | null
          status: string
          subscription_id: string
          updated_at: string
          user_id: string
          user_message: string | null
        }
        Insert: {
          amount: number
          attempt_number?: number | null
          boleto_barcode?: string | null
          boleto_digitable_line?: string | null
          boleto_expires_at?: string | null
          boleto_url?: string | null
          created_at?: string
          decline_code?: string | null
          decline_type?: string | null
          gateway: string
          gateway_payment_id?: string | null
          gateway_response?: Json | null
          gateway_status?: string | null
          id?: string
          idempotency_key?: string | null
          paid_at?: string | null
          payment_method: string
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          refunded_at?: string | null
          status?: string
          subscription_id: string
          updated_at?: string
          user_id: string
          user_message?: string | null
        }
        Update: {
          amount?: number
          attempt_number?: number | null
          boleto_barcode?: string | null
          boleto_digitable_line?: string | null
          boleto_expires_at?: string | null
          boleto_url?: string | null
          created_at?: string
          decline_code?: string | null
          decline_type?: string | null
          gateway?: string
          gateway_payment_id?: string | null
          gateway_response?: Json | null
          gateway_status?: string | null
          id?: string
          idempotency_key?: string | null
          paid_at?: string | null
          payment_method?: string
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          refunded_at?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string
          user_id?: string
          user_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "master_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      master_subscriptions: {
        Row: {
          billing_cycle: string
          cancelled_at: string | null
          card_brand: string | null
          card_last_four: string | null
          card_token: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          decline_type: string | null
          discount_percent: number | null
          downgrade_reason: string | null
          downgraded_at: string | null
          gateway: string
          gateway_customer_id: string | null
          gateway_subscription_id: string | null
          grace_period_ends_at: string | null
          id: string
          last_decline_code: string | null
          last_decline_message: string | null
          last_retry_at: string | null
          monthly_price: number
          next_retry_at: string | null
          no_charge: boolean | null
          origin: string | null
          plan_id: string
          previous_plan_id: string | null
          recurring_consent_accepted: boolean | null
          recurring_consent_accepted_at: string | null
          recurring_consent_ip: string | null
          requires_card_update: boolean | null
          retry_count: number | null
          started_at: string | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle: string
          cancelled_at?: string | null
          card_brand?: string | null
          card_last_four?: string | null
          card_token?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          decline_type?: string | null
          discount_percent?: number | null
          downgrade_reason?: string | null
          downgraded_at?: string | null
          gateway: string
          gateway_customer_id?: string | null
          gateway_subscription_id?: string | null
          grace_period_ends_at?: string | null
          id?: string
          last_decline_code?: string | null
          last_decline_message?: string | null
          last_retry_at?: string | null
          monthly_price: number
          next_retry_at?: string | null
          no_charge?: boolean | null
          origin?: string | null
          plan_id: string
          previous_plan_id?: string | null
          recurring_consent_accepted?: boolean | null
          recurring_consent_accepted_at?: string | null
          recurring_consent_ip?: string | null
          requires_card_update?: boolean | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle?: string
          cancelled_at?: string | null
          card_brand?: string | null
          card_last_four?: string | null
          card_token?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          decline_type?: string | null
          discount_percent?: number | null
          downgrade_reason?: string | null
          downgraded_at?: string | null
          gateway?: string
          gateway_customer_id?: string | null
          gateway_subscription_id?: string | null
          grace_period_ends_at?: string | null
          id?: string
          last_decline_code?: string | null
          last_decline_message?: string | null
          last_retry_at?: string | null
          monthly_price?: number
          next_retry_at?: string | null
          no_charge?: boolean | null
          origin?: string | null
          plan_id?: string
          previous_plan_id?: string | null
          recurring_consent_accepted?: boolean | null
          recurring_consent_accepted_at?: string | null
          recurring_consent_ip?: string | null
          requires_card_update?: boolean | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      media_files: {
        Row: {
          created_at: string
          file_path: string
          file_type: string
          height: number | null
          id: string
          mime_type: string | null
          name: string
          size: number
          updated_at: string
          uploaded_by: string | null
          url: string
          usage_count: number
          width: number | null
        }
        Insert: {
          created_at?: string
          file_path: string
          file_type: string
          height?: number | null
          id?: string
          mime_type?: string | null
          name: string
          size: number
          updated_at?: string
          uploaded_by?: string | null
          url: string
          usage_count?: number
          width?: number | null
        }
        Update: {
          created_at?: string
          file_path?: string
          file_type?: string
          height?: number | null
          id?: string
          mime_type?: string | null
          name?: string
          size?: number
          updated_at?: string
          uploaded_by?: string | null
          url?: string
          usage_count?: number
          width?: number | null
        }
        Relationships: []
      }
      melhor_envio_settings: {
        Row: {
          api_key: string
          created_at: string
          environment: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
          user_id_melhor_envio: string | null
        }
        Insert: {
          api_key: string
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
          user_id_melhor_envio?: string | null
        }
        Update: {
          api_key?: string
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
          user_id_melhor_envio?: string | null
        }
        Relationships: []
      }
      merchant_domains: {
        Row: {
          created_at: string
          dns_a_verified: boolean
          dns_cname_verified: boolean
          dns_error_message: string | null
          domain: string
          domain_type: string
          expected_cname: string | null
          expected_ip: string | null
          id: string
          is_active: boolean
          last_dns_check: string | null
          last_ssl_check: string | null
          merchant_id: string
          redirect_old_link: boolean
          ssl_error_message: string | null
          ssl_status: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dns_a_verified?: boolean
          dns_cname_verified?: boolean
          dns_error_message?: string | null
          domain: string
          domain_type?: string
          expected_cname?: string | null
          expected_ip?: string | null
          id?: string
          is_active?: boolean
          last_dns_check?: string | null
          last_ssl_check?: string | null
          merchant_id: string
          redirect_old_link?: boolean
          ssl_error_message?: string | null
          ssl_status?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dns_a_verified?: boolean
          dns_cname_verified?: boolean
          dns_error_message?: string | null
          domain?: string
          domain_type?: string
          expected_cname?: string | null
          expected_ip?: string | null
          id?: string
          is_active?: boolean
          last_dns_check?: string | null
          last_ssl_check?: string | null
          merchant_id?: string
          redirect_old_link?: boolean
          ssl_error_message?: string | null
          ssl_status?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_domains_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_domains_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_domains_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "public_store_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_support_tickets: {
        Row: {
          answered_at: string | null
          category: string | null
          created_at: string
          deleted_by_admin: boolean
          deleted_by_merchant: boolean
          id: string
          merchant_id: string
          message: string
          read_at: string | null
          response: string | null
          status: string
          updated_at: string
        }
        Insert: {
          answered_at?: string | null
          category?: string | null
          created_at?: string
          deleted_by_admin?: boolean
          deleted_by_merchant?: boolean
          id?: string
          merchant_id: string
          message: string
          read_at?: string | null
          response?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          answered_at?: string | null
          category?: string | null
          created_at?: string
          deleted_by_admin?: boolean
          deleted_by_merchant?: boolean
          id?: string
          merchant_id?: string
          message?: string
          read_at?: string | null
          response?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          product_name: string
          product_price: number
          quantity: number
          subtotal: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          product_name: string
          product_price: number
          quantity: number
          subtotal: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          product_price?: number
          quantity?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_rate_limit: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          order_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          order_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          order_count?: number
          window_start?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          boleto_barcode: string | null
          boleto_digitable_line: string | null
          boleto_expires_at: string | null
          boleto_payment_id: string | null
          boleto_payment_status: string | null
          boleto_url: string | null
          created_at: string
          customer_address: string | null
          customer_email: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          delivery_fee: number | null
          delivery_method: string | null
          id: string
          notes: string | null
          order_number: string | null
          order_source: string
          payment_method: string | null
          pix_expires_at: string | null
          pix_payment_id: string | null
          pix_payment_status: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          status: string
          store_owner_id: string
          subtotal: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          boleto_barcode?: string | null
          boleto_digitable_line?: string | null
          boleto_expires_at?: string | null
          boleto_payment_id?: string | null
          boleto_payment_status?: string | null
          boleto_url?: string | null
          created_at?: string
          customer_address?: string | null
          customer_email: string
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          delivery_fee?: number | null
          delivery_method?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          order_source?: string
          payment_method?: string | null
          pix_expires_at?: string | null
          pix_payment_id?: string | null
          pix_payment_status?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          status?: string
          store_owner_id: string
          subtotal?: number | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          boleto_barcode?: string | null
          boleto_digitable_line?: string | null
          boleto_expires_at?: string | null
          boleto_payment_id?: string | null
          boleto_payment_status?: string | null
          boleto_url?: string | null
          created_at?: string
          customer_address?: string | null
          customer_email?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivery_fee?: number | null
          delivery_method?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          order_source?: string
          payment_method?: string | null
          pix_expires_at?: string | null
          pix_payment_id?: string | null
          pix_payment_status?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          status?: string
          store_owner_id?: string
          subtotal?: number | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_boleto_payment_id_fkey"
            columns: ["boleto_payment_id"]
            isOneToOne: false
            referencedRelation: "boleto_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          boleto_enabled: boolean | null
          boleto_provider: string | null
          created_at: string
          credit_card_enabled: boolean | null
          credit_card_installments_no_interest: number | null
          credit_card_provider: string | null
          id: string
          mercadopago_accepts_credit: boolean | null
          mercadopago_accepts_pix: boolean | null
          mercadopago_access_token: string | null
          mercadopago_enabled: boolean
          mercadopago_installments_free: number | null
          mercadopago_pix_discount: number | null
          mercadopago_public_key: string | null
          mercadopago_webhook_secret: string | null
          pagbank_accepts_credit: boolean | null
          pagbank_accepts_pix: boolean | null
          pagbank_email: string | null
          pagbank_enabled: boolean
          pagbank_token: string | null
          pagbank_webhook_secret: string | null
          pix_discount_percent: number | null
          pix_enabled: boolean | null
          pix_provider: string | null
          updated_at: string
          user_id: string
          whatsapp_accepts_cash: boolean | null
          whatsapp_accepts_credit: boolean | null
          whatsapp_accepts_debit: boolean | null
          whatsapp_accepts_pix: boolean | null
          whatsapp_accepts_transfer: boolean | null
          whatsapp_enabled: boolean
          whatsapp_number: string | null
        }
        Insert: {
          boleto_enabled?: boolean | null
          boleto_provider?: string | null
          created_at?: string
          credit_card_enabled?: boolean | null
          credit_card_installments_no_interest?: number | null
          credit_card_provider?: string | null
          id?: string
          mercadopago_accepts_credit?: boolean | null
          mercadopago_accepts_pix?: boolean | null
          mercadopago_access_token?: string | null
          mercadopago_enabled?: boolean
          mercadopago_installments_free?: number | null
          mercadopago_pix_discount?: number | null
          mercadopago_public_key?: string | null
          mercadopago_webhook_secret?: string | null
          pagbank_accepts_credit?: boolean | null
          pagbank_accepts_pix?: boolean | null
          pagbank_email?: string | null
          pagbank_enabled?: boolean
          pagbank_token?: string | null
          pagbank_webhook_secret?: string | null
          pix_discount_percent?: number | null
          pix_enabled?: boolean | null
          pix_provider?: string | null
          updated_at?: string
          user_id: string
          whatsapp_accepts_cash?: boolean | null
          whatsapp_accepts_credit?: boolean | null
          whatsapp_accepts_debit?: boolean | null
          whatsapp_accepts_pix?: boolean | null
          whatsapp_accepts_transfer?: boolean | null
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
        }
        Update: {
          boleto_enabled?: boolean | null
          boleto_provider?: string | null
          created_at?: string
          credit_card_enabled?: boolean | null
          credit_card_installments_no_interest?: number | null
          credit_card_provider?: string | null
          id?: string
          mercadopago_accepts_credit?: boolean | null
          mercadopago_accepts_pix?: boolean | null
          mercadopago_access_token?: string | null
          mercadopago_enabled?: boolean
          mercadopago_installments_free?: number | null
          mercadopago_pix_discount?: number | null
          mercadopago_public_key?: string | null
          mercadopago_webhook_secret?: string | null
          pagbank_accepts_credit?: boolean | null
          pagbank_accepts_pix?: boolean | null
          pagbank_email?: string | null
          pagbank_enabled?: boolean
          pagbank_token?: string | null
          pagbank_webhook_secret?: string | null
          pix_discount_percent?: number | null
          pix_enabled?: boolean | null
          pix_provider?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_accepts_cash?: boolean | null
          whatsapp_accepts_credit?: boolean | null
          whatsapp_accepts_debit?: boolean | null
          whatsapp_accepts_pix?: boolean | null
          whatsapp_accepts_transfer?: boolean | null
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          gateway: string
          gateway_fee: number
          id: string
          invoice_id: string
          metadata: Json | null
          net_amount: number
          paid_at: string | null
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          gateway: string
          gateway_fee?: number
          id?: string
          invoice_id: string
          metadata?: Json | null
          net_amount: number
          paid_at?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          gateway?: string
          gateway_fee?: number
          id?: string
          invoice_id?: string
          metadata?: Json | null
          net_amount?: number
          paid_at?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      pix_payments: {
        Row: {
          amount: number
          created_at: string
          expires_at: string | null
          external_payment_id: string | null
          gateway: string
          id: string
          order_id: string
          paid_at: string | null
          qr_code: string | null
          qr_code_base64: string | null
          status: string
          store_owner_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at?: string | null
          external_payment_id?: string | null
          gateway: string
          id?: string
          order_id: string
          paid_at?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          status?: string
          store_owner_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          external_payment_id?: string | null
          gateway?: string
          id?: string
          order_id?: string
          paid_at?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          status?: string
          store_owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pix_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_events: {
        Row: {
          created_at: string
          description: string
          event_type: string
          id: string
          metadata: Json | null
          severity: string
          subscriber_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          event_type: string
          id?: string
          metadata?: Json | null
          severity?: string
          subscriber_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          severity?: string
          subscriber_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_events_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_events_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_events_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "public_store_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_stats: {
        Row: {
          active_subscriptions: number
          created_at: string
          id: string
          monthly_revenue: number
          snapshot_date: string
          total_revenue: number
          total_stores: number
          total_users: number
        }
        Insert: {
          active_subscriptions?: number
          created_at?: string
          id?: string
          monthly_revenue?: number
          snapshot_date?: string
          total_revenue?: number
          total_stores?: number
          total_users?: number
        }
        Update: {
          active_subscriptions?: number
          created_at?: string
          id?: string
          monthly_revenue?: number
          snapshot_date?: string
          total_revenue?: number
          total_stores?: number
          total_users?: number
        }
        Relationships: []
      }
      product_brands: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string
          product_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url: string
          product_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string | null
          category_id: string | null
          created_at: string
          description: string | null
          height: number | null
          id: string
          image_url: string | null
          images: Json | null
          is_featured: boolean | null
          is_new: boolean | null
          length: number | null
          name: string
          price: number
          promotional_price: number | null
          stock: number
          updated_at: string
          user_id: string
          variations: Json | null
          weight: number | null
          width: number | null
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          images?: Json | null
          is_featured?: boolean | null
          is_new?: boolean | null
          length?: number | null
          name: string
          price: number
          promotional_price?: number | null
          stock?: number
          updated_at?: string
          user_id: string
          variations?: Json | null
          weight?: number | null
          width?: number | null
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          images?: Json | null
          is_featured?: boolean | null
          is_new?: boolean | null
          length?: number | null
          name?: string
          price?: number
          promotional_price?: number | null
          stock?: number
          updated_at?: string
          user_id?: string
          variations?: Json | null
          weight?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "product_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          about_us_text: string | null
          account_status: string
          account_status_updated_at: string | null
          address: string | null
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_zip_code: string | null
          banner_desktop_url: string | null
          banner_desktop_urls: Json | null
          banner_mobile_url: string | null
          banner_mobile_urls: Json | null
          banner_rect_1_url: string | null
          banner_rect_2_url: string | null
          button_bg_color: string | null
          button_border_style: string | null
          button_text_color: string | null
          checkout_require_address: boolean | null
          checkout_require_cpf: boolean | null
          checkout_require_email: boolean | null
          checkout_require_payment_method: boolean | null
          checkout_require_personal_info: boolean | null
          cpf_cnpj: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          delivery_option: string | null
          display_name: string | null
          email: string | null
          facebook_url: string | null
          font_family: string | null
          font_weight: number | null
          footer_bg_color: string | null
          footer_text_color: string | null
          free_shipping_minimum: number | null
          free_shipping_scope: string | null
          full_name: string
          header_logo_position: string | null
          home_video_description: string | null
          home_video_enabled: boolean | null
          home_video_id: string | null
          home_video_provider: string | null
          home_video_title: string | null
          home_video_url_original: string | null
          id: string
          instagram_url: string | null
          is_maintenance_mode: boolean | null
          is_template_profile: boolean | null
          last_activity: string | null
          merchant_city: string | null
          merchant_reference_cep: string | null
          merchant_state: string | null
          minibanner_1_img2_url: string | null
          minibanner_2_img2_url: string | null
          minimum_order_value: number | null
          phone: string | null
          pickup_address: string | null
          pickup_hours_saturday_end: string | null
          pickup_hours_saturday_start: string | null
          pickup_hours_weekday_end: string | null
          pickup_hours_weekday_start: string | null
          primary_color: string | null
          product_border_style: string | null
          product_button_display: string | null
          product_image_format: string | null
          product_text_alignment: string | null
          return_policy_text: string | null
          secondary_color: string | null
          shipping_fixed_fee: number | null
          shipping_free_minimum: number | null
          show_whatsapp_button: boolean | null
          source_template_id: string | null
          store_description: string | null
          store_logo_url: string | null
          store_name: string | null
          store_slug: string | null
          topbar_bg_color: string | null
          topbar_enabled: boolean | null
          topbar_link_target: string | null
          topbar_link_type: string | null
          topbar_text: string | null
          topbar_text_color: string | null
          updated_at: string
          use_account_address_for_pickup: boolean | null
          whatsapp_number: string | null
          x_url: string | null
          youtube_url: string | null
        }
        Insert: {
          about_us_text?: string | null
          account_status?: string
          account_status_updated_at?: string | null
          address?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_zip_code?: string | null
          banner_desktop_url?: string | null
          banner_desktop_urls?: Json | null
          banner_mobile_url?: string | null
          banner_mobile_urls?: Json | null
          banner_rect_1_url?: string | null
          banner_rect_2_url?: string | null
          button_bg_color?: string | null
          button_border_style?: string | null
          button_text_color?: string | null
          checkout_require_address?: boolean | null
          checkout_require_cpf?: boolean | null
          checkout_require_email?: boolean | null
          checkout_require_payment_method?: boolean | null
          checkout_require_personal_info?: boolean | null
          cpf_cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          delivery_option?: string | null
          display_name?: string | null
          email?: string | null
          facebook_url?: string | null
          font_family?: string | null
          font_weight?: number | null
          footer_bg_color?: string | null
          footer_text_color?: string | null
          free_shipping_minimum?: number | null
          free_shipping_scope?: string | null
          full_name: string
          header_logo_position?: string | null
          home_video_description?: string | null
          home_video_enabled?: boolean | null
          home_video_id?: string | null
          home_video_provider?: string | null
          home_video_title?: string | null
          home_video_url_original?: string | null
          id: string
          instagram_url?: string | null
          is_maintenance_mode?: boolean | null
          is_template_profile?: boolean | null
          last_activity?: string | null
          merchant_city?: string | null
          merchant_reference_cep?: string | null
          merchant_state?: string | null
          minibanner_1_img2_url?: string | null
          minibanner_2_img2_url?: string | null
          minimum_order_value?: number | null
          phone?: string | null
          pickup_address?: string | null
          pickup_hours_saturday_end?: string | null
          pickup_hours_saturday_start?: string | null
          pickup_hours_weekday_end?: string | null
          pickup_hours_weekday_start?: string | null
          primary_color?: string | null
          product_border_style?: string | null
          product_button_display?: string | null
          product_image_format?: string | null
          product_text_alignment?: string | null
          return_policy_text?: string | null
          secondary_color?: string | null
          shipping_fixed_fee?: number | null
          shipping_free_minimum?: number | null
          show_whatsapp_button?: boolean | null
          source_template_id?: string | null
          store_description?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          store_slug?: string | null
          topbar_bg_color?: string | null
          topbar_enabled?: boolean | null
          topbar_link_target?: string | null
          topbar_link_type?: string | null
          topbar_text?: string | null
          topbar_text_color?: string | null
          updated_at?: string
          use_account_address_for_pickup?: boolean | null
          whatsapp_number?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          about_us_text?: string | null
          account_status?: string
          account_status_updated_at?: string | null
          address?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_zip_code?: string | null
          banner_desktop_url?: string | null
          banner_desktop_urls?: Json | null
          banner_mobile_url?: string | null
          banner_mobile_urls?: Json | null
          banner_rect_1_url?: string | null
          banner_rect_2_url?: string | null
          button_bg_color?: string | null
          button_border_style?: string | null
          button_text_color?: string | null
          checkout_require_address?: boolean | null
          checkout_require_cpf?: boolean | null
          checkout_require_email?: boolean | null
          checkout_require_payment_method?: boolean | null
          checkout_require_personal_info?: boolean | null
          cpf_cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          delivery_option?: string | null
          display_name?: string | null
          email?: string | null
          facebook_url?: string | null
          font_family?: string | null
          font_weight?: number | null
          footer_bg_color?: string | null
          footer_text_color?: string | null
          free_shipping_minimum?: number | null
          free_shipping_scope?: string | null
          full_name?: string
          header_logo_position?: string | null
          home_video_description?: string | null
          home_video_enabled?: boolean | null
          home_video_id?: string | null
          home_video_provider?: string | null
          home_video_title?: string | null
          home_video_url_original?: string | null
          id?: string
          instagram_url?: string | null
          is_maintenance_mode?: boolean | null
          is_template_profile?: boolean | null
          last_activity?: string | null
          merchant_city?: string | null
          merchant_reference_cep?: string | null
          merchant_state?: string | null
          minibanner_1_img2_url?: string | null
          minibanner_2_img2_url?: string | null
          minimum_order_value?: number | null
          phone?: string | null
          pickup_address?: string | null
          pickup_hours_saturday_end?: string | null
          pickup_hours_saturday_start?: string | null
          pickup_hours_weekday_end?: string | null
          pickup_hours_weekday_start?: string | null
          primary_color?: string | null
          product_border_style?: string | null
          product_button_display?: string | null
          product_image_format?: string | null
          product_text_alignment?: string | null
          return_policy_text?: string | null
          secondary_color?: string | null
          shipping_fixed_fee?: number | null
          shipping_free_minimum?: number | null
          show_whatsapp_button?: boolean | null
          source_template_id?: string | null
          store_description?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          store_slug?: string | null
          topbar_bg_color?: string | null
          topbar_enabled?: boolean | null
          topbar_link_target?: string | null
          topbar_link_type?: string | null
          topbar_text?: string | null
          topbar_text_color?: string | null
          updated_at?: string
          use_account_address_for_pickup?: boolean | null
          whatsapp_number?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "brand_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          rule_name: string
          scope_type: string
          scope_value: string
          shipping_fee: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          rule_name: string
          scope_type: string
          scope_value: string
          shipping_fee?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          rule_name?: string
          scope_type?: string
          scope_value?: string
          shipping_fee?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      store_customers: {
        Row: {
          created_at: string
          customer_code: string | null
          customer_id: string
          id: string
          is_active: boolean
          origin: string
          store_owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_code?: string | null
          customer_id: string
          id?: string
          is_active?: boolean
          origin?: string
          store_owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_code?: string | null
          customer_id?: string
          id?: string
          is_active?: boolean
          origin?: string
          store_owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json | null
          id: string
          interval: string
          is_active: boolean
          name: string
          order_limit: number
          price: number
          product_limit: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          interval: string
          is_active?: boolean
          name: string
          order_limit?: number
          price: number
          product_limit?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          interval?: string
          is_active?: boolean
          name?: string
          order_limit?: number
          price?: number
          product_limit?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          internal_notes: string | null
          no_charge: boolean | null
          plan_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end: string
          current_period_start?: string
          id?: string
          internal_notes?: string | null
          no_charge?: boolean | null
          plan_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          internal_notes?: string | null
          no_charge?: boolean | null
          plan_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          closed_at: string | null
          created_at: string
          customer_id: string
          description: string
          id: string
          priority: string
          status: string
          subject: string
          ticket_number: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          closed_at?: string | null
          created_at?: string
          customer_id: string
          description: string
          id?: string
          priority?: string
          status?: string
          subject: string
          ticket_number: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          customer_id?: string
          description?: string
          id?: string
          priority?: string
          status?: string
          subject?: string
          ticket_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "public_store_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "public_store_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_landing_responses: {
        Row: {
          assunto: string
          created_at: string
          email_destinatario: string | null
          enviado_por: string | null
          id: string
          mensagem: string
          status_envio: string | null
          ticket_id: string
          tipo: string
        }
        Insert: {
          assunto: string
          created_at?: string
          email_destinatario?: string | null
          enviado_por?: string | null
          id?: string
          mensagem: string
          status_envio?: string | null
          ticket_id: string
          tipo?: string
        }
        Update: {
          assunto?: string
          created_at?: string
          email_destinatario?: string | null
          enviado_por?: string | null
          id?: string
          mensagem?: string
          status_envio?: string | null
          ticket_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_landing_responses_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_landing_page"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          attachments: Json | null
          created_at: string
          id: string
          is_internal: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          attachments?: Json | null
          created_at?: string
          id?: string
          is_internal?: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          attachments?: Json | null
          created_at?: string
          id?: string
          is_internal?: boolean
          message?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_store_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets_landing_page: {
        Row: {
          canal_origem: string
          categoria: string
          cpf_cnpj: string | null
          created_at: string
          email: string
          empresa: string | null
          id: string
          ip_address: string | null
          loja_url_ou_nome: string | null
          mensagem: string
          nome: string
          notas_internas: string | null
          prioridade: string
          protocolo: string
          responsavel: string | null
          status: string
          tipo_problema: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          canal_origem?: string
          categoria: string
          cpf_cnpj?: string | null
          created_at?: string
          email: string
          empresa?: string | null
          id?: string
          ip_address?: string | null
          loja_url_ou_nome?: string | null
          mensagem: string
          nome: string
          notas_internas?: string | null
          prioridade?: string
          protocolo: string
          responsavel?: string | null
          status?: string
          tipo_problema?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          canal_origem?: string
          categoria?: string
          cpf_cnpj?: string | null
          created_at?: string
          email?: string
          empresa?: string | null
          id?: string
          ip_address?: string | null
          loja_url_ou_nome?: string | null
          mensagem?: string
          nome?: string
          notas_internas?: string | null
          prioridade?: string
          protocolo?: string
          responsavel?: string | null
          status?: string
          tipo_problema?: string | null
          updated_at?: string
          user_agent?: string | null
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
      vm_dashboard_banner_events: {
        Row: {
          banner_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["banner_event_type"]
          id: string
          merchant_id: string
          meta: Json | null
        }
        Insert: {
          banner_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["banner_event_type"]
          id?: string
          merchant_id: string
          meta?: Json | null
        }
        Update: {
          banner_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["banner_event_type"]
          id?: string
          merchant_id?: string
          meta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "vm_dashboard_banner_events_banner_id_fkey"
            columns: ["banner_id"]
            isOneToOne: false
            referencedRelation: "vm_dashboard_banners"
            referencedColumns: ["id"]
          },
        ]
      }
      vm_dashboard_banners: {
        Row: {
          badge_text: string | null
          badge_type: Database["public"]["Enums"]["banner_badge_type"] | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          external_url: string | null
          id: string
          image_desktop_url: string
          image_mobile_url: string | null
          internal_route: string | null
          is_sponsored: boolean
          link_type: Database["public"]["Enums"]["banner_link_type"]
          open_in_new_tab: boolean
          priority: number
          starts_at: string | null
          status: Database["public"]["Enums"]["banner_status"]
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          badge_text?: string | null
          badge_type?: Database["public"]["Enums"]["banner_badge_type"] | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          external_url?: string | null
          id?: string
          image_desktop_url: string
          image_mobile_url?: string | null
          internal_route?: string | null
          is_sponsored?: boolean
          link_type?: Database["public"]["Enums"]["banner_link_type"]
          open_in_new_tab?: boolean
          priority?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["banner_status"]
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          badge_text?: string | null
          badge_type?: Database["public"]["Enums"]["banner_badge_type"] | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          external_url?: string | null
          id?: string
          image_desktop_url?: string
          image_mobile_url?: string | null
          internal_route?: string | null
          is_sponsored?: boolean
          link_type?: Database["public"]["Enums"]["banner_link_type"]
          open_in_new_tab?: boolean
          priority?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["banner_status"]
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          created_at: string | null
          customer_name: string
          customer_phone: string
          id: string
          message: string
          store_owner_id: string
        }
        Insert: {
          created_at?: string | null
          customer_name: string
          customer_phone: string
          id?: string
          message: string
          store_owner_id: string
        }
        Update: {
          created_at?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          message?: string
          store_owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_store_owner_id_fkey"
            columns: ["store_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_store_owner_id_fkey"
            columns: ["store_owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_store_owner_id_fkey"
            columns: ["store_owner_id"]
            isOneToOne: false
            referencedRelation: "public_store_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      correios_settings_public: {
        Row: {
          is_active: boolean | null
          origin_zipcode: string | null
          user_id: string | null
        }
        Insert: {
          is_active?: boolean | null
          origin_zipcode?: string | null
          user_id?: string | null
        }
        Update: {
          is_active?: boolean | null
          origin_zipcode?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      melhor_envio_settings_public: {
        Row: {
          environment: string | null
          is_active: boolean | null
          user_id: string | null
        }
        Insert: {
          environment?: string | null
          is_active?: boolean | null
          user_id?: string | null
        }
        Update: {
          environment?: string | null
          is_active?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      payment_settings_public: {
        Row: {
          boleto_enabled: boolean | null
          boleto_provider: string | null
          credit_card_enabled: boolean | null
          credit_card_installments_no_interest: number | null
          credit_card_provider: string | null
          mercadopago_accepts_credit: boolean | null
          mercadopago_accepts_pix: boolean | null
          mercadopago_enabled: boolean | null
          mercadopago_installments_free: number | null
          mercadopago_pix_discount: number | null
          pagbank_accepts_credit: boolean | null
          pagbank_accepts_pix: boolean | null
          pagbank_enabled: boolean | null
          pix_discount_percent: number | null
          pix_enabled: boolean | null
          pix_provider: string | null
          user_id: string | null
          whatsapp_accepts_cash: boolean | null
          whatsapp_accepts_credit: boolean | null
          whatsapp_accepts_debit: boolean | null
          whatsapp_accepts_pix: boolean | null
          whatsapp_accepts_transfer: boolean | null
          whatsapp_enabled: boolean | null
          whatsapp_number: string | null
        }
        Insert: {
          boleto_enabled?: boolean | null
          boleto_provider?: string | null
          credit_card_enabled?: boolean | null
          credit_card_installments_no_interest?: number | null
          credit_card_provider?: string | null
          mercadopago_accepts_credit?: boolean | null
          mercadopago_accepts_pix?: boolean | null
          mercadopago_enabled?: boolean | null
          mercadopago_installments_free?: number | null
          mercadopago_pix_discount?: number | null
          pagbank_accepts_credit?: boolean | null
          pagbank_accepts_pix?: boolean | null
          pagbank_enabled?: boolean | null
          pix_discount_percent?: number | null
          pix_enabled?: boolean | null
          pix_provider?: string | null
          user_id?: string | null
          whatsapp_accepts_cash?: boolean | null
          whatsapp_accepts_credit?: boolean | null
          whatsapp_accepts_debit?: boolean | null
          whatsapp_accepts_pix?: boolean | null
          whatsapp_accepts_transfer?: boolean | null
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Update: {
          boleto_enabled?: boolean | null
          boleto_provider?: string | null
          credit_card_enabled?: boolean | null
          credit_card_installments_no_interest?: number | null
          credit_card_provider?: string | null
          mercadopago_accepts_credit?: boolean | null
          mercadopago_accepts_pix?: boolean | null
          mercadopago_enabled?: boolean | null
          mercadopago_installments_free?: number | null
          mercadopago_pix_discount?: number | null
          pagbank_accepts_credit?: boolean | null
          pagbank_accepts_pix?: boolean | null
          pagbank_enabled?: boolean | null
          pix_discount_percent?: number | null
          pix_enabled?: boolean | null
          pix_provider?: string | null
          user_id?: string | null
          whatsapp_accepts_cash?: boolean | null
          whatsapp_accepts_credit?: boolean | null
          whatsapp_accepts_debit?: boolean | null
          whatsapp_accepts_pix?: boolean | null
          whatsapp_accepts_transfer?: boolean | null
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string | null
          primary_color: string | null
          secondary_color: string | null
          store_description: string | null
          store_logo_url: string | null
          store_name: string | null
          store_slug: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          store_description?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          store_slug?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          store_description?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          store_slug?: string | null
        }
        Relationships: []
      }
      public_store_products: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string | null
          image_url: string | null
          images: Json | null
          name: string | null
          price: number | null
          promotional_price: number | null
          stock: number | null
          store_slug: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      public_store_profiles: {
        Row: {
          about_us_text: string | null
          banner_desktop_url: string | null
          banner_desktop_urls: Json | null
          banner_mobile_url: string | null
          banner_mobile_urls: Json | null
          banner_rect_1_url: string | null
          banner_rect_2_url: string | null
          button_bg_color: string | null
          button_border_style: string | null
          button_text_color: string | null
          checkout_require_address: boolean | null
          checkout_require_cpf: boolean | null
          checkout_require_email: boolean | null
          checkout_require_payment_method: boolean | null
          checkout_require_personal_info: boolean | null
          delivery_option: string | null
          display_name: string | null
          facebook_url: string | null
          font_family: string | null
          font_weight: number | null
          footer_bg_color: string | null
          footer_text_color: string | null
          free_shipping_minimum: number | null
          free_shipping_scope: string | null
          id: string | null
          instagram_url: string | null
          is_maintenance_mode: boolean | null
          merchant_city: string | null
          merchant_reference_cep: string | null
          merchant_state: string | null
          minimum_order_value: number | null
          pickup_address: string | null
          pickup_hours_saturday_end: string | null
          pickup_hours_saturday_start: string | null
          pickup_hours_weekday_end: string | null
          pickup_hours_weekday_start: string | null
          primary_color: string | null
          product_border_style: string | null
          product_button_display: string | null
          product_image_format: string | null
          product_text_alignment: string | null
          return_policy_text: string | null
          secondary_color: string | null
          shipping_fixed_fee: number | null
          store_description: string | null
          store_logo_url: string | null
          store_name: string | null
          store_slug: string | null
          use_account_address_for_pickup: boolean | null
          whatsapp_number: string | null
          x_url: string | null
          youtube_url: string | null
        }
        Insert: {
          about_us_text?: string | null
          banner_desktop_url?: string | null
          banner_desktop_urls?: Json | null
          banner_mobile_url?: string | null
          banner_mobile_urls?: Json | null
          banner_rect_1_url?: string | null
          banner_rect_2_url?: string | null
          button_bg_color?: string | null
          button_border_style?: string | null
          button_text_color?: string | null
          checkout_require_address?: boolean | null
          checkout_require_cpf?: boolean | null
          checkout_require_email?: boolean | null
          checkout_require_payment_method?: boolean | null
          checkout_require_personal_info?: boolean | null
          delivery_option?: string | null
          display_name?: string | null
          facebook_url?: string | null
          font_family?: string | null
          font_weight?: number | null
          footer_bg_color?: string | null
          footer_text_color?: string | null
          free_shipping_minimum?: number | null
          free_shipping_scope?: string | null
          id?: string | null
          instagram_url?: string | null
          is_maintenance_mode?: boolean | null
          merchant_city?: string | null
          merchant_reference_cep?: string | null
          merchant_state?: string | null
          minimum_order_value?: number | null
          pickup_address?: never
          pickup_hours_saturday_end?: never
          pickup_hours_saturday_start?: never
          pickup_hours_weekday_end?: never
          pickup_hours_weekday_start?: never
          primary_color?: string | null
          product_border_style?: string | null
          product_button_display?: string | null
          product_image_format?: string | null
          product_text_alignment?: string | null
          return_policy_text?: string | null
          secondary_color?: string | null
          shipping_fixed_fee?: number | null
          store_description?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          store_slug?: string | null
          use_account_address_for_pickup?: never
          whatsapp_number?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          about_us_text?: string | null
          banner_desktop_url?: string | null
          banner_desktop_urls?: Json | null
          banner_mobile_url?: string | null
          banner_mobile_urls?: Json | null
          banner_rect_1_url?: string | null
          banner_rect_2_url?: string | null
          button_bg_color?: string | null
          button_border_style?: string | null
          button_text_color?: string | null
          checkout_require_address?: boolean | null
          checkout_require_cpf?: boolean | null
          checkout_require_email?: boolean | null
          checkout_require_payment_method?: boolean | null
          checkout_require_personal_info?: boolean | null
          delivery_option?: string | null
          display_name?: string | null
          facebook_url?: string | null
          font_family?: string | null
          font_weight?: number | null
          footer_bg_color?: string | null
          footer_text_color?: string | null
          free_shipping_minimum?: number | null
          free_shipping_scope?: string | null
          id?: string | null
          instagram_url?: string | null
          is_maintenance_mode?: boolean | null
          merchant_city?: string | null
          merchant_reference_cep?: string | null
          merchant_state?: string | null
          minimum_order_value?: number | null
          pickup_address?: never
          pickup_hours_saturday_end?: never
          pickup_hours_saturday_start?: never
          pickup_hours_weekday_end?: never
          pickup_hours_weekday_start?: never
          primary_color?: string | null
          product_border_style?: string | null
          product_button_display?: string | null
          product_image_format?: string | null
          product_text_alignment?: string | null
          return_policy_text?: string | null
          secondary_color?: string | null
          shipping_fixed_fee?: number | null
          store_description?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          store_slug?: string | null
          use_account_address_for_pickup?: never
          whatsapp_number?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_media_file_usage: { Args: { file_id: string }; Returns: boolean }
      check_order_rate_limit: { Args: { client_ip: string }; Returns: boolean }
      clone_template_to_store: {
        Args: { p_template_id: string; p_user_id: string }
        Returns: undefined
      }
      copy_template_products_to_store: {
        Args: { p_template_id: string; p_user_id: string }
        Returns: number
      }
      generate_customer_code: { Args: { merchant_id: string }; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      generate_template_slug: {
        Args: { template_name: string }
        Returns: string
      }
      generate_ticket_number: { Args: never; Returns: string }
      get_active_banners_count: {
        Args: never
        Returns: {
          sponsored_active: number
          total_active: number
        }[]
      }
      get_banner_metrics: {
        Args: { p_banner_id: string; p_days?: number }
        Returns: {
          clicks: number
          ctr: number
          impressions: number
        }[]
      }
      get_template_by_slug: {
        Args: { p_slug: string }
        Returns: {
          id: string
          is_link_active: boolean
          logo_url: string
          name: string
          status: Database["public"]["Enums"]["brand_template_status"]
        }[]
      }
      get_template_credentials: {
        Args: { p_template_id: string }
        Returns: {
          email: string
          password: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_template_link_clicks: {
        Args: { p_template_slug: string }
        Returns: boolean
      }
      is_active_store: { Args: { store_id: string }; Returns: boolean }
      is_public_store: { Args: { store_user_id: string }; Returns: boolean }
      link_template_to_profile:
        | {
            Args: { p_profile_id: string; p_template_id: string }
            Returns: boolean
          }
        | {
            Args: {
              p_profile_id: string
              p_template_id: string
              p_template_password?: string
            }
            Returns: boolean
          }
      log_audit_event: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type: string
          p_ip_address?: string
          p_metadata?: Json
        }
        Returns: string
      }
      reset_template_password: {
        Args: { p_template_id: string }
        Returns: string
      }
      sync_template_from_profile: {
        Args: { p_template_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user" | "financeiro" | "suporte" | "tecnico"
      banner_badge_type:
        | "default"
        | "info"
        | "success"
        | "warning"
        | "sponsored"
      banner_event_type: "impression" | "click"
      banner_link_type: "internal" | "external"
      banner_status: "draft" | "active" | "paused" | "archived"
      brand_template_status: "draft" | "active" | "inactive"
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
      app_role: ["admin", "user", "financeiro", "suporte", "tecnico"],
      banner_badge_type: ["default", "info", "success", "warning", "sponsored"],
      banner_event_type: ["impression", "click"],
      banner_link_type: ["internal", "external"],
      banner_status: ["draft", "active", "paused", "archived"],
      brand_template_status: ["draft", "active", "inactive"],
    },
  },
} as const
