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
        ]
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
          street: string
          updated_at: string
        }
        Insert: {
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
          street: string
          updated_at?: string
        }
        Update: {
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
      customer_profiles: {
        Row: {
          cpf: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          receive_promotions: boolean | null
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          phone?: string | null
          receive_promotions?: boolean | null
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          receive_promotions?: boolean | null
          updated_at?: string
        }
        Relationships: []
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
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
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
          payment_method: string | null
          status: string
          store_owner_id: string
          subtotal: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
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
          payment_method?: string | null
          status?: string
          store_owner_id: string
          subtotal?: number | null
          total_amount: number
          updated_at?: string
        }
        Update: {
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
          payment_method?: string | null
          status?: string
          store_owner_id?: string
          subtotal?: number | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
        ]
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
          cpf_cnpj: string | null
          created_at: string
          delivery_option: string | null
          display_name: string | null
          email: string | null
          facebook_url: string | null
          font_family: string | null
          font_weight: number | null
          footer_bg_color: string | null
          footer_text_color: string | null
          free_shipping_minimum: number | null
          full_name: string
          id: string
          instagram_url: string | null
          last_activity: string | null
          phone: string | null
          pickup_address: string | null
          primary_color: string | null
          product_border_style: string | null
          product_button_display: string | null
          product_image_format: string | null
          product_text_alignment: string | null
          return_policy_text: string | null
          secondary_color: string | null
          shipping_fixed_fee: number | null
          shipping_free_minimum: number | null
          store_description: string | null
          store_logo_url: string | null
          store_name: string | null
          store_slug: string | null
          updated_at: string
          use_account_address_for_pickup: boolean | null
          whatsapp_number: string | null
          x_url: string | null
          youtube_url: string | null
        }
        Insert: {
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
          cpf_cnpj?: string | null
          created_at?: string
          delivery_option?: string | null
          display_name?: string | null
          email?: string | null
          facebook_url?: string | null
          font_family?: string | null
          font_weight?: number | null
          footer_bg_color?: string | null
          footer_text_color?: string | null
          free_shipping_minimum?: number | null
          full_name: string
          id: string
          instagram_url?: string | null
          last_activity?: string | null
          phone?: string | null
          pickup_address?: string | null
          primary_color?: string | null
          product_border_style?: string | null
          product_button_display?: string | null
          product_image_format?: string | null
          product_text_alignment?: string | null
          return_policy_text?: string | null
          secondary_color?: string | null
          shipping_fixed_fee?: number | null
          shipping_free_minimum?: number | null
          store_description?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          store_slug?: string | null
          updated_at?: string
          use_account_address_for_pickup?: boolean | null
          whatsapp_number?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Update: {
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
          cpf_cnpj?: string | null
          created_at?: string
          delivery_option?: string | null
          display_name?: string | null
          email?: string | null
          facebook_url?: string | null
          font_family?: string | null
          font_weight?: number | null
          footer_bg_color?: string | null
          footer_text_color?: string | null
          free_shipping_minimum?: number | null
          full_name?: string
          id?: string
          instagram_url?: string | null
          last_activity?: string | null
          phone?: string | null
          pickup_address?: string | null
          primary_color?: string | null
          product_border_style?: string | null
          product_button_display?: string | null
          product_image_format?: string | null
          product_text_alignment?: string | null
          return_policy_text?: string | null
          secondary_color?: string | null
          shipping_fixed_fee?: number | null
          shipping_free_minimum?: number | null
          store_description?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          store_slug?: string | null
          updated_at?: string
          use_account_address_for_pickup?: boolean | null
          whatsapp_number?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
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
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
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
        ]
      }
    }
    Views: {
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
    }
    Functions: {
      check_order_rate_limit: { Args: { client_ip: string }; Returns: boolean }
      generate_order_number: { Args: never; Returns: string }
      generate_ticket_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_store: { Args: { store_id: string }; Returns: boolean }
      is_public_store: { Args: { store_user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "financeiro" | "suporte" | "tecnico"
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
    },
  },
} as const
