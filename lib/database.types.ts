/**
 * GENERATED FILE — do not edit by hand.
 *
 * Source of truth: supabase/sql/*.sql
 * Regenerate with: npm run db:types
 *
 * Every table, column, enum and RPC below comes from the SQL you run in the
 * Supabase SQL Editor, so the app and the database cannot drift apart.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      access_codes: {
      Row: {
        id: string
        code: string
        plan_id: string | null
        user_id: string | null
        subscription_id: string | null
        status: Database["public"]["Enums"]["access_code_status"]
        issued_at: string
        used_at: string | null
        expires_at: string | null
        note: string | null
        meta: Json
        created_at: string
      }
      Insert: {
        id?: string
        code: string
        plan_id?: string | null
        user_id?: string | null
        subscription_id?: string | null
        status?: Database["public"]["Enums"]["access_code_status"]
        issued_at?: string
        used_at?: string | null
        expires_at?: string | null
        note?: string | null
        meta?: Json
        created_at?: string
      }
      Update: {
        id?: string
        code?: string
        plan_id?: string | null
        user_id?: string | null
        subscription_id?: string | null
        status?: Database["public"]["Enums"]["access_code_status"]
        issued_at?: string
        used_at?: string | null
        expires_at?: string | null
        note?: string | null
        meta?: Json
        created_at?: string
      }
      Relationships: []
    }
      addresses: {
      Row: {
        id: string
        user_id: string
        label: string
        full_name: string
        phone: string
        division: string
        district: string
        upazila: string
        address: string
        is_default: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        user_id: string
        label?: string
        full_name: string
        phone: string
        division: string
        district: string
        upazila: string
        address: string
        is_default?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        user_id?: string
        label?: string
        full_name?: string
        phone?: string
        division?: string
        district?: string
        upazila?: string
        address?: string
        is_default?: boolean
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      audit_log: {
      Row: {
        id: number
        actor_id: string | null
        actor_email: string | null
        actor_role: string | null
        action: string
        entity: string | null
        entity_id: string | null
        diff: Json | null
        meta: Json
        ip: string | null
        user_agent: string | null
        created_at: string
      }
      Insert: {
        id?: number
        actor_id?: string | null
        actor_email?: string | null
        actor_role?: string | null
        action: string
        entity?: string | null
        entity_id?: string | null
        diff?: Json | null
        meta?: Json
        ip?: string | null
        user_agent?: string | null
        created_at?: string
      }
      Update: {
        id?: number
        actor_id?: string | null
        actor_email?: string | null
        actor_role?: string | null
        action?: string
        entity?: string | null
        entity_id?: string | null
        diff?: Json | null
        meta?: Json
        ip?: string | null
        user_agent?: string | null
        created_at?: string
      }
      Relationships: []
    }
      banners: {
      Row: {
        id: string
        title_bn: string
        title_en: string | null
        subtitle_bn: string | null
        image: string | null
        link: string
        placement: string
        is_active: boolean
        sort_order: number
        starts_at: string | null
        ends_at: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        title_bn: string
        title_en?: string | null
        subtitle_bn?: string | null
        image?: string | null
        link?: string
        placement?: string
        is_active?: boolean
        sort_order?: number
        starts_at?: string | null
        ends_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        title_bn?: string
        title_en?: string | null
        subtitle_bn?: string | null
        image?: string | null
        link?: string
        placement?: string
        is_active?: boolean
        sort_order?: number
        starts_at?: string | null
        ends_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      blog_posts: {
      Row: {
        id: string
        slug: string
        title_bn: string
        title_en: string | null
        excerpt_bn: string | null
        content_bn: string
        cover: string | null
        author_bn: string
        tag_bn: string
        read_minutes: number
        published_at: string
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        slug: string
        title_bn: string
        title_en?: string | null
        excerpt_bn?: string | null
        content_bn?: string
        cover?: string | null
        author_bn?: string
        tag_bn?: string
        read_minutes?: number
        published_at?: string
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        slug?: string
        title_bn?: string
        title_en?: string | null
        excerpt_bn?: string | null
        content_bn?: string
        cover?: string | null
        author_bn?: string
        tag_bn?: string
        read_minutes?: number
        published_at?: string
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      camera_requests: {
      Row: {
        id: string
        seller_id: string | null
        farm_id: string | null
        user_id: string | null
        contact_name: string | null
        contact_phone: string | null
        note_bn: string | null
        camera_count: number
        status: string
        admin_note: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        seller_id?: string | null
        farm_id?: string | null
        user_id?: string | null
        contact_name?: string | null
        contact_phone?: string | null
        note_bn?: string | null
        camera_count?: number
        status?: string
        admin_note?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        seller_id?: string | null
        farm_id?: string | null
        user_id?: string | null
        contact_name?: string | null
        contact_phone?: string | null
        note_bn?: string | null
        camera_count?: number
        status?: string
        admin_note?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      camera_view_logs: {
      Row: {
        id: number
        camera_id: string | null
        user_id: string | null
        fingerprint: string | null
        minutes: number | null
        created_at: string
      }
      Insert: {
        id?: number
        camera_id?: string | null
        user_id?: string | null
        fingerprint?: string | null
        minutes?: number | null
        created_at?: string
      }
      Update: {
        id?: number
        camera_id?: string | null
        user_id?: string | null
        fingerprint?: string | null
        minutes?: number | null
        created_at?: string
      }
      Relationships: []
    }
      cameras: {
      Row: {
        id: string
        farm_id: string
        name_bn: string
        zone_bn: string
        protocol: Database["public"]["Enums"]["camera_protocol"]
        stream_key: string | null
        stream_url: string | null
        cloud_provider: string
        cloud_serial: string | null
        cloud_channel: number
        poster: string | null
        location_lat: number | null
        location_lng: number | null
        status: Database["public"]["Enums"]["camera_status"]
        last_heartbeat: string | null
        is_active: boolean
        is_premium: boolean
        max_viewers: number
        sort_order: number
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        farm_id: string
        name_bn: string
        zone_bn?: string
        protocol?: Database["public"]["Enums"]["camera_protocol"]
        stream_key?: string | null
        stream_url?: string | null
        cloud_provider?: string
        cloud_serial?: string | null
        cloud_channel?: number
        poster?: string | null
        location_lat?: number | null
        location_lng?: number | null
        status?: Database["public"]["Enums"]["camera_status"]
        last_heartbeat?: string | null
        is_active?: boolean
        is_premium?: boolean
        max_viewers?: number
        sort_order?: number
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        farm_id?: string
        name_bn?: string
        zone_bn?: string
        protocol?: Database["public"]["Enums"]["camera_protocol"]
        stream_key?: string | null
        stream_url?: string | null
        cloud_provider?: string
        cloud_serial?: string | null
        cloud_channel?: number
        poster?: string | null
        location_lat?: number | null
        location_lng?: number | null
        status?: Database["public"]["Enums"]["camera_status"]
        last_heartbeat?: string | null
        is_active?: boolean
        is_premium?: boolean
        max_viewers?: number
        sort_order?: number
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      cart_items: {
      Row: {
        id: string
        user_id: string
        item_id: string
        kind: string
        slug: string | null
        name_bn: string | null
        quantity: number
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        user_id: string
        item_id: string
        kind?: string
        slug?: string | null
        name_bn?: string | null
        quantity?: number
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        user_id?: string
        item_id?: string
        kind?: string
        slug?: string | null
        name_bn?: string | null
        quantity?: number
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      categories: {
      Row: {
        id: string
        parent_id: string | null
        slug: string
        name_bn: string
        name_en: string
        description_bn: string | null
        icon: string | null
        image: string | null
        sort_order: number
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        parent_id?: string | null
        slug: string
        name_bn: string
        name_en?: string
        description_bn?: string | null
        icon?: string | null
        image?: string | null
        sort_order?: number
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        parent_id?: string | null
        slug?: string
        name_bn?: string
        name_en?: string
        description_bn?: string | null
        icon?: string | null
        image?: string | null
        sort_order?: number
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      combo_items: {
      Row: {
        id: string
        combo_id: string
        product_id: string
        quantity: number
        sort_order: number
        created_at: string
      }
      Insert: {
        id?: string
        combo_id: string
        product_id: string
        quantity?: number
        sort_order?: number
        created_at?: string
      }
      Update: {
        id?: string
        combo_id?: string
        product_id?: string
        quantity?: number
        sort_order?: number
        created_at?: string
      }
      Relationships: []
    }
      combos: {
      Row: {
        id: string
        slug: string
        name_bn: string
        name_en: string | null
        description_bn: string | null
        kind: Database["public"]["Enums"]["combo_kind"]
        price: number
        original_price: number | null
        contents: Json
        image: string | null
        is_active: boolean
        sort_order: number
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        slug: string
        name_bn: string
        name_en?: string | null
        description_bn?: string | null
        kind?: Database["public"]["Enums"]["combo_kind"]
        price?: number
        original_price?: number | null
        contents?: Json
        image?: string | null
        is_active?: boolean
        sort_order?: number
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        slug?: string
        name_bn?: string
        name_en?: string | null
        description_bn?: string | null
        kind?: Database["public"]["Enums"]["combo_kind"]
        price?: number
        original_price?: number | null
        contents?: Json
        image?: string | null
        is_active?: boolean
        sort_order?: number
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      complaint_messages: {
      Row: {
        id: string
        complaint_id: string
        author_role: string
        author_id: string | null
        body: string
        is_internal: boolean
        created_at: string
      }
      Insert: {
        id?: string
        complaint_id: string
        author_role?: string
        author_id?: string | null
        body: string
        is_internal?: boolean
        created_at?: string
      }
      Update: {
        id?: string
        complaint_id?: string
        author_role?: string
        author_id?: string | null
        body?: string
        is_internal?: boolean
        created_at?: string
      }
      Relationships: []
    }
      complaints: {
      Row: {
        id: string
        ticket_no: string
        order_id: string
        sub_order_id: string | null
        order_item_id: string | null
        product_id: string | null
        seller_id: string | null
        user_id: string
        problem_type: Database["public"]["Enums"]["complaint_problem"]
        description: string
        photos: string[]
        preferred_resolution: Database["public"]["Enums"]["resolution_type"]
        status: Database["public"]["Enums"]["complaint_status"]
        resolution: Database["public"]["Enums"]["resolution_type"] | null
        resolution_note: string | null
        resolved_by: string | null
        resolved_at: string | null
        rejected_by: string | null
        rejected_at: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        ticket_no: string
        order_id: string
        sub_order_id?: string | null
        order_item_id?: string | null
        product_id?: string | null
        seller_id?: string | null
        user_id: string
        problem_type?: Database["public"]["Enums"]["complaint_problem"]
        description: string
        photos?: string[]
        preferred_resolution?: Database["public"]["Enums"]["resolution_type"]
        status?: Database["public"]["Enums"]["complaint_status"]
        resolution?: Database["public"]["Enums"]["resolution_type"] | null
        resolution_note?: string | null
        resolved_by?: string | null
        resolved_at?: string | null
        rejected_by?: string | null
        rejected_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        ticket_no?: string
        order_id?: string
        sub_order_id?: string | null
        order_item_id?: string | null
        product_id?: string | null
        seller_id?: string | null
        user_id?: string
        problem_type?: Database["public"]["Enums"]["complaint_problem"]
        description?: string
        photos?: string[]
        preferred_resolution?: Database["public"]["Enums"]["resolution_type"]
        status?: Database["public"]["Enums"]["complaint_status"]
        resolution?: Database["public"]["Enums"]["resolution_type"] | null
        resolution_note?: string | null
        resolved_by?: string | null
        resolved_at?: string | null
        rejected_by?: string | null
        rejected_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      contact_messages: {
      Row: {
        id: string
        name: string
        email: string | null
        phone: string | null
        message: string
        status: string
        created_at: string
      }
      Insert: {
        id?: string
        name: string
        email?: string | null
        phone?: string | null
        message: string
        status?: string
        created_at?: string
      }
      Update: {
        id?: string
        name?: string
        email?: string | null
        phone?: string | null
        message?: string
        status?: string
        created_at?: string
      }
      Relationships: []
    }
      coupon_audiences: {
      Row: {
        coupon_id: string
        user_id: string
        added_at: string
      }
      Insert: {
        coupon_id: string
        user_id: string
        added_at?: string
      }
      Update: {
        coupon_id?: string
        user_id?: string
        added_at?: string
      }
      Relationships: []
    }
      coupon_redemptions: {
      Row: {
        id: string
        coupon_id: string
        user_id: string | null
        order_id: string | null
        order_no: string | null
        amount: number
        created_at: string
      }
      Insert: {
        id?: string
        coupon_id: string
        user_id?: string | null
        order_id?: string | null
        order_no?: string | null
        amount?: number
        created_at?: string
      }
      Update: {
        id?: string
        coupon_id?: string
        user_id?: string | null
        order_id?: string | null
        order_no?: string | null
        amount?: number
        created_at?: string
      }
      Relationships: []
    }
      coupons: {
      Row: {
        id: string
        code: string
        description_bn: string | null
        type: Database["public"]["Enums"]["coupon_type"]
        value: number
        min_order: number
        max_discount: number | null
        usage_limit: number | null
        used_count: number
        per_user_limit: number
        starts_at: string | null
        expires_at: string | null
        is_active: boolean
        created_at: string
        updated_at: string
        audience: string
        funder_user_id: string | null
        funder_note: string | null
        is_referral: boolean
        share_token: string | null
      }
      Insert: {
        id?: string
        code: string
        description_bn?: string | null
        type?: Database["public"]["Enums"]["coupon_type"]
        value?: number
        min_order?: number
        max_discount?: number | null
        usage_limit?: number | null
        used_count?: number
        per_user_limit?: number
        starts_at?: string | null
        expires_at?: string | null
        is_active?: boolean
        created_at?: string
        updated_at?: string
        audience?: string
        funder_user_id?: string | null
        funder_note?: string | null
        is_referral?: boolean
        share_token?: string | null
      }
      Update: {
        id?: string
        code?: string
        description_bn?: string | null
        type?: Database["public"]["Enums"]["coupon_type"]
        value?: number
        min_order?: number
        max_discount?: number | null
        usage_limit?: number | null
        used_count?: number
        per_user_limit?: number
        starts_at?: string | null
        expires_at?: string | null
        is_active?: boolean
        created_at?: string
        updated_at?: string
        audience?: string
        funder_user_id?: string | null
        funder_note?: string | null
        is_referral?: boolean
        share_token?: string | null
      }
      Relationships: []
    }
      custom_combos: {
      Row: {
        id: string
        user_id: string
        name_bn: string
        items: Json
        item_count: number
        price_cached: number
        repeat_interval: string
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        user_id: string
        name_bn: string
        items?: Json
        item_count?: number
        price_cached?: number
        repeat_interval?: string
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        user_id?: string
        name_bn?: string
        items?: Json
        item_count?: number
        price_cached?: number
        repeat_interval?: string
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      delivery_charges: {
      Row: {
        id: string
        district: string
        district_en: string | null
        division: string
        scope: string
        charge: number
        free_over: number | null
        eta_days: string
        is_active: boolean
        sort_order: number
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        district: string
        district_en?: string | null
        division: string
        scope?: string
        charge?: number
        free_over?: number | null
        eta_days?: string
        is_active?: boolean
        sort_order?: number
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        district?: string
        district_en?: string | null
        division?: string
        scope?: string
        charge?: number
        free_over?: number | null
        eta_days?: string
        is_active?: boolean
        sort_order?: number
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      faq_items: {
      Row: {
        id: string
        group_bn: string
        question_bn: string
        answer_bn: string
        sort_order: number
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        group_bn?: string
        question_bn: string
        answer_bn: string
        sort_order?: number
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        group_bn?: string
        question_bn?: string
        answer_bn?: string
        sort_order?: number
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      farms: {
      Row: {
        id: string
        slug: string
        name_bn: string
        name_en: string | null
        type: Database["public"]["Enums"]["farm_type"]
        owner_user_id: string | null
        owner_name_bn: string | null
        owner_phone: string | null
        owner_photo: string | null
        owner_bio_bn: string | null
        division: string
        district: string
        upazila: string | null
        address_bn: string | null
        lat: number | null
        lng: number | null
        boundary: Json | null
        harvest_calendar: Json | null
        description_bn: string | null
        story_bn: string | null
        cover: string | null
        images: string[]
        daily_output: Json | null
        established_year: number | null
        certifications: string[]
        is_active: boolean
        is_premium: boolean
        sort_order: number
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        slug: string
        name_bn: string
        name_en?: string | null
        type?: Database["public"]["Enums"]["farm_type"]
        owner_user_id?: string | null
        owner_name_bn?: string | null
        owner_phone?: string | null
        owner_photo?: string | null
        owner_bio_bn?: string | null
        division: string
        district: string
        upazila?: string | null
        address_bn?: string | null
        lat?: number | null
        lng?: number | null
        boundary?: Json | null
        harvest_calendar?: Json | null
        description_bn?: string | null
        story_bn?: string | null
        cover?: string | null
        images?: string[]
        daily_output?: Json | null
        established_year?: number | null
        certifications?: string[]
        is_active?: boolean
        is_premium?: boolean
        sort_order?: number
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        slug?: string
        name_bn?: string
        name_en?: string | null
        type?: Database["public"]["Enums"]["farm_type"]
        owner_user_id?: string | null
        owner_name_bn?: string | null
        owner_phone?: string | null
        owner_photo?: string | null
        owner_bio_bn?: string | null
        division?: string
        district?: string
        upazila?: string | null
        address_bn?: string | null
        lat?: number | null
        lng?: number | null
        boundary?: Json | null
        harvest_calendar?: Json | null
        description_bn?: string | null
        story_bn?: string | null
        cover?: string | null
        images?: string[]
        daily_output?: Json | null
        established_year?: number | null
        certifications?: string[]
        is_active?: boolean
        is_premium?: boolean
        sort_order?: number
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      fcm_tokens: {
      Row: {
        id: string
        user_id: string
        token: string
        platform: string
        created_at: string
      }
      Insert: {
        id?: string
        user_id: string
        token: string
        platform?: string
        created_at?: string
      }
      Update: {
        id?: string
        user_id?: string
        token?: string
        platform?: string
        created_at?: string
      }
      Relationships: []
    }
      hero_slides: {
      Row: {
        id: string
        title_bn: string
        subtitle_bn: string | null
        image_url: string | null
        image_mobile_url: string | null
        video_url: string | null
        alt_bn: string | null
        cta_label_bn: string | null
        cta_href: string | null
        secondary_label_bn: string | null
        secondary_href: string | null
        text_position: string
        text_tone: string
        overlay_opacity: number
        starts_at: string | null
        ends_at: string | null
        sort_order: number
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        title_bn: string
        subtitle_bn?: string | null
        image_url?: string | null
        image_mobile_url?: string | null
        video_url?: string | null
        alt_bn?: string | null
        cta_label_bn?: string | null
        cta_href?: string | null
        secondary_label_bn?: string | null
        secondary_href?: string | null
        text_position?: string
        text_tone?: string
        overlay_opacity?: number
        starts_at?: string | null
        ends_at?: string | null
        sort_order?: number
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        title_bn?: string
        subtitle_bn?: string | null
        image_url?: string | null
        image_mobile_url?: string | null
        video_url?: string | null
        alt_bn?: string | null
        cta_label_bn?: string | null
        cta_href?: string | null
        secondary_label_bn?: string | null
        secondary_href?: string | null
        text_position?: string
        text_tone?: string
        overlay_opacity?: number
        starts_at?: string | null
        ends_at?: string | null
        sort_order?: number
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      homepage_sections: {
      Row: {
        id: string
        key: string
        label_bn: string
        is_visible: boolean
        sort_order: number
        config: Json
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        key: string
        label_bn: string
        is_visible?: boolean
        sort_order?: number
        config?: Json
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        key?: string
        label_bn?: string
        is_visible?: boolean
        sort_order?: number
        config?: Json
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      login_attempts: {
      Row: {
        id: number
        email: string | null
        ip: string | null
        ok: boolean
        created_at: string
      }
      Insert: {
        id?: number
        email?: string | null
        ip?: string | null
        ok?: boolean
        created_at?: string
      }
      Update: {
        id?: number
        email?: string | null
        ip?: string | null
        ok?: boolean
        created_at?: string
      }
      Relationships: []
    }
      media_assets: {
      Row: {
        id: string
        bucket: string
        path: string
        url: string
        mime: string | null
        bytes: number | null
        alt_bn: string | null
        title_bn: string | null
        tags: string[]
        uploaded_by: string | null
        created_at: string
      }
      Insert: {
        id?: string
        bucket: string
        path: string
        url: string
        mime?: string | null
        bytes?: number | null
        alt_bn?: string | null
        title_bn?: string | null
        tags?: string[]
        uploaded_by?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        bucket?: string
        path?: string
        url?: string
        mime?: string | null
        bytes?: number | null
        alt_bn?: string | null
        title_bn?: string | null
        tags?: string[]
        uploaded_by?: string | null
        created_at?: string
      }
      Relationships: []
    }
      menu_items: {
      Row: {
        id: string
        menu_id: string
        parent_id: string | null
        label_bn: string
        href: string
        icon: string | null
        sort_order: number
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        menu_id: string
        parent_id?: string | null
        label_bn: string
        href?: string
        icon?: string | null
        sort_order?: number
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        menu_id?: string
        parent_id?: string | null
        label_bn?: string
        href?: string
        icon?: string | null
        sort_order?: number
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      menus: {
      Row: {
        id: string
        key: string
        label_bn: string
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        key: string
        label_bn: string
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        key?: string
        label_bn?: string
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      newsletter_subscribers: {
      Row: {
        id: string
        email: string
        is_active: boolean
        created_at: string
      }
      Insert: {
        id?: string
        email: string
        is_active?: boolean
        created_at?: string
      }
      Update: {
        id?: string
        email?: string
        is_active?: boolean
        created_at?: string
      }
      Relationships: []
    }
      notifications: {
      Row: {
        id: string
        user_id: string
        audience: Database["public"]["Enums"]["notification_audience"]
        kind: Database["public"]["Enums"]["notification_kind"]
        title_bn: string
        body_bn: string | null
        link: string | null
        meta: Json
        is_read: boolean
        created_at: string
      }
      Insert: {
        id?: string
        user_id: string
        audience?: Database["public"]["Enums"]["notification_audience"]
        kind?: Database["public"]["Enums"]["notification_kind"]
        title_bn: string
        body_bn?: string | null
        link?: string | null
        meta?: Json
        is_read?: boolean
        created_at?: string
      }
      Update: {
        id?: string
        user_id?: string
        audience?: Database["public"]["Enums"]["notification_audience"]
        kind?: Database["public"]["Enums"]["notification_kind"]
        title_bn?: string
        body_bn?: string | null
        link?: string | null
        meta?: Json
        is_read?: boolean
        created_at?: string
      }
      Relationships: []
    }
      order_items: {
      Row: {
        id: string
        order_id: string
        sub_order_id: string | null
        product_id: string | null
        seller_id: string | null
        name_bn: string
        unit: string | null
        price: number
        quantity: number
        image: string | null
        created_at: string
      }
      Insert: {
        id?: string
        order_id: string
        sub_order_id?: string | null
        product_id?: string | null
        seller_id?: string | null
        name_bn: string
        unit?: string | null
        price?: number
        quantity?: number
        image?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        order_id?: string
        sub_order_id?: string | null
        product_id?: string | null
        seller_id?: string | null
        name_bn?: string
        unit?: string | null
        price?: number
        quantity?: number
        image?: string | null
        created_at?: string
      }
      Relationships: []
    }
      orders: {
      Row: {
        id: string
        order_no: string
        user_id: string | null
        customer_name: string
        customer_phone: string
        customer_email: string | null
        division: string
        district: string
        upazila: string
        address: string
        delivery_note: string | null
        subtotal: number
        delivery_charge: number
        discount: number
        total: number
        coupon_code: string | null
        payment_method: string
        payment_status: Database["public"]["Enums"]["payment_status"]
        payment_ref: string | null
        status: Database["public"]["Enums"]["order_status"]
        eta_days: string | null
        admin_note: string | null
        cancel_reason: string | null
        delivered_at: string | null
        delivered_by: string | null
        created_at: string
        updated_at: string
        wallet_used: number
      }
      Insert: {
        id?: string
        order_no: string
        user_id?: string | null
        customer_name: string
        customer_phone: string
        customer_email?: string | null
        division: string
        district: string
        upazila: string
        address: string
        delivery_note?: string | null
        subtotal?: number
        delivery_charge?: number
        discount?: number
        total?: number
        coupon_code?: string | null
        payment_method?: string
        payment_status?: Database["public"]["Enums"]["payment_status"]
        payment_ref?: string | null
        status?: Database["public"]["Enums"]["order_status"]
        eta_days?: string | null
        admin_note?: string | null
        cancel_reason?: string | null
        delivered_at?: string | null
        delivered_by?: string | null
        created_at?: string
        updated_at?: string
        wallet_used?: number
      }
      Update: {
        id?: string
        order_no?: string
        user_id?: string | null
        customer_name?: string
        customer_phone?: string
        customer_email?: string | null
        division?: string
        district?: string
        upazila?: string
        address?: string
        delivery_note?: string | null
        subtotal?: number
        delivery_charge?: number
        discount?: number
        total?: number
        coupon_code?: string | null
        payment_method?: string
        payment_status?: Database["public"]["Enums"]["payment_status"]
        payment_ref?: string | null
        status?: Database["public"]["Enums"]["order_status"]
        eta_days?: string | null
        admin_note?: string | null
        cancel_reason?: string | null
        delivered_at?: string | null
        delivered_by?: string | null
        created_at?: string
        updated_at?: string
        wallet_used?: number
      }
      Relationships: []
    }
      parcels: {
      Row: {
        id: string
        order_id: string
        sub_order_id: string | null
        order_no: string
        qr_token: string
        label: Json
        printed_count: number
        delivered_at: string | null
        delivered_by: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        order_id: string
        sub_order_id?: string | null
        order_no: string
        qr_token: string
        label?: Json
        printed_count?: number
        delivered_at?: string | null
        delivered_by?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        order_id?: string
        sub_order_id?: string | null
        order_no?: string
        qr_token?: string
        label?: Json
        printed_count?: number
        delivered_at?: string | null
        delivered_by?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      payment_methods: {
      Row: {
        id: string
        code: string
        name_bn: string
        name_en: string | null
        kind: Database["public"]["Enums"]["payment_method_kind"]
        logo_url: string | null
        account_type: Database["public"]["Enums"]["payment_account_type"] | null
        account_number: string | null
        account_name: string | null
        bank_name: string | null
        branch_name: string | null
        routing_number: string | null
        instruction_bn: string | null
        min_amount: number
        max_amount: number | null
        trx_pattern: string | null
        requires_trx: boolean
        requires_sender: boolean
        is_active: boolean
        sort_order: number
        created_at: string
        updated_at: string
        show_on_checkout: boolean
      }
      Insert: {
        id?: string
        code: string
        name_bn: string
        name_en?: string | null
        kind?: Database["public"]["Enums"]["payment_method_kind"]
        logo_url?: string | null
        account_type?: Database["public"]["Enums"]["payment_account_type"] | null
        account_number?: string | null
        account_name?: string | null
        bank_name?: string | null
        branch_name?: string | null
        routing_number?: string | null
        instruction_bn?: string | null
        min_amount?: number
        max_amount?: number | null
        trx_pattern?: string | null
        requires_trx?: boolean
        requires_sender?: boolean
        is_active?: boolean
        sort_order?: number
        created_at?: string
        updated_at?: string
        show_on_checkout?: boolean
      }
      Update: {
        id?: string
        code?: string
        name_bn?: string
        name_en?: string | null
        kind?: Database["public"]["Enums"]["payment_method_kind"]
        logo_url?: string | null
        account_type?: Database["public"]["Enums"]["payment_account_type"] | null
        account_number?: string | null
        account_name?: string | null
        bank_name?: string | null
        branch_name?: string | null
        routing_number?: string | null
        instruction_bn?: string | null
        min_amount?: number
        max_amount?: number | null
        trx_pattern?: string | null
        requires_trx?: boolean
        requires_sender?: boolean
        is_active?: boolean
        sort_order?: number
        created_at?: string
        updated_at?: string
        show_on_checkout?: boolean
      }
      Relationships: []
    }
      payment_refs: {
      Row: {
        id: string
        ref: string
        kind: string
        target_id: string
        user_id: string | null
        created_at: string
      }
      Insert: {
        id?: string
        ref: string
        kind: string
        target_id: string
        user_id?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        ref?: string
        kind?: string
        target_id?: string
        user_id?: string | null
        created_at?: string
      }
      Relationships: []
    }
      permission_catalog: {
      Row: {
        permission: string
        group_key: string
        group_bn: string
        label_bn: string
        hint_bn: string | null
        is_sensitive: boolean
        sort_order: number
      }
      Insert: {
        permission: string
        group_key: string
        group_bn: string
        label_bn: string
        hint_bn?: string | null
        is_sensitive?: boolean
        sort_order?: number
      }
      Update: {
        permission?: string
        group_key?: string
        group_bn?: string
        label_bn?: string
        hint_bn?: string | null
        is_sensitive?: boolean
        sort_order?: number
      }
      Relationships: []
    }
      plans: {
      Row: {
        id: string
        slug: string
        name_bn: string
        name_en: string | null
        tier: Database["public"]["Enums"]["premium_tier"]
        interval: Database["public"]["Enums"]["premium_interval"]
        price: number
        compare_price: number | null
        duration_days: number
        max_devices: number
        features: string[]
        is_active: boolean
        is_popular: boolean
        sort_order: number
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        slug: string
        name_bn: string
        name_en?: string | null
        tier?: Database["public"]["Enums"]["premium_tier"]
        interval?: Database["public"]["Enums"]["premium_interval"]
        price?: number
        compare_price?: number | null
        duration_days?: number
        max_devices?: number
        features?: string[]
        is_active?: boolean
        is_popular?: boolean
        sort_order?: number
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        slug?: string
        name_bn?: string
        name_en?: string | null
        tier?: Database["public"]["Enums"]["premium_tier"]
        interval?: Database["public"]["Enums"]["premium_interval"]
        price?: number
        compare_price?: number | null
        duration_days?: number
        max_devices?: number
        features?: string[]
        is_active?: boolean
        is_popular?: boolean
        sort_order?: number
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      premium_devices: {
      Row: {
        id: string
        user_id: string
        subscription_id: string | null
        fingerprint: string
        label: string | null
        user_agent: string | null
        last_seen: string
        created_at: string
      }
      Insert: {
        id?: string
        user_id: string
        subscription_id?: string | null
        fingerprint: string
        label?: string | null
        user_agent?: string | null
        last_seen?: string
        created_at?: string
      }
      Update: {
        id?: string
        user_id?: string
        subscription_id?: string | null
        fingerprint?: string
        label?: string | null
        user_agent?: string | null
        last_seen?: string
        created_at?: string
      }
      Relationships: []
    }
      product_images: {
      Row: {
        id: string
        product_id: string
        url: string
        alt_bn: string | null
        sort_order: number
        is_primary: boolean
        created_at: string
      }
      Insert: {
        id?: string
        product_id: string
        url: string
        alt_bn?: string | null
        sort_order?: number
        is_primary?: boolean
        created_at?: string
      }
      Update: {
        id?: string
        product_id?: string
        url?: string
        alt_bn?: string | null
        sort_order?: number
        is_primary?: boolean
        created_at?: string
      }
      Relationships: []
    }
      products: {
      Row: {
        id: string
        slug: string
        category_id: string | null
        seller_id: string | null
        farm_id: string | null
        name_bn: string
        name_en: string
        description_bn: string | null
        description_en: string | null
        unit: string
        unit_en: string
        price: number
        compare_price: number | null
        stock: number
        weight_grams: number | null
        image: string | null
        images: string[]
        farm_source_bn: string | null
        harvest_date: string | null
        badge_bn: string | null
        rating: number
        review_count: number
        is_featured: boolean
        is_active: boolean
        approval_status: Database["public"]["Enums"]["product_approval"]
        rejection_reason: string | null
        sort_order: number
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        slug: string
        category_id?: string | null
        seller_id?: string | null
        farm_id?: string | null
        name_bn: string
        name_en?: string
        description_bn?: string | null
        description_en?: string | null
        unit?: string
        unit_en?: string
        price?: number
        compare_price?: number | null
        stock?: number
        weight_grams?: number | null
        image?: string | null
        images?: string[]
        farm_source_bn?: string | null
        harvest_date?: string | null
        badge_bn?: string | null
        rating?: number
        review_count?: number
        is_featured?: boolean
        is_active?: boolean
        approval_status?: Database["public"]["Enums"]["product_approval"]
        rejection_reason?: string | null
        sort_order?: number
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        slug?: string
        category_id?: string | null
        seller_id?: string | null
        farm_id?: string | null
        name_bn?: string
        name_en?: string
        description_bn?: string | null
        description_en?: string | null
        unit?: string
        unit_en?: string
        price?: number
        compare_price?: number | null
        stock?: number
        weight_grams?: number | null
        image?: string | null
        images?: string[]
        farm_source_bn?: string | null
        harvest_date?: string | null
        badge_bn?: string | null
        rating?: number
        review_count?: number
        is_featured?: boolean
        is_active?: boolean
        approval_status?: Database["public"]["Enums"]["product_approval"]
        rejection_reason?: string | null
        sort_order?: number
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      profiles: {
      Row: {
        id: string
        full_name: string | null
        email: string | null
        phone: string | null
        bio: string | null
        avatar_url: string | null
        role: Database["public"]["Enums"]["user_role"]
        is_active: boolean
        is_seller: boolean
        premium_until: string | null
        phone_verified: boolean
        language: string
        theme: string
        notification_preferences: Json
        onboarded: boolean
        mfa_enrolled: boolean
        last_login_at: string | null
        created_at: string
        updated_at: string
        referral_code: string | null
        referred_by: string | null
        referred_at: string | null
        wallet_balance: number
        wallet_earned: number
        wallet_spent: number
      }
      Insert: {
        id: string
        full_name?: string | null
        email?: string | null
        phone?: string | null
        bio?: string | null
        avatar_url?: string | null
        role?: Database["public"]["Enums"]["user_role"]
        is_active?: boolean
        is_seller?: boolean
        premium_until?: string | null
        phone_verified?: boolean
        language?: string
        theme?: string
        notification_preferences?: Json
        onboarded?: boolean
        mfa_enrolled?: boolean
        last_login_at?: string | null
        created_at?: string
        updated_at?: string
        referral_code?: string | null
        referred_by?: string | null
        referred_at?: string | null
        wallet_balance?: number
        wallet_earned?: number
        wallet_spent?: number
      }
      Update: {
        id?: string
        full_name?: string | null
        email?: string | null
        phone?: string | null
        bio?: string | null
        avatar_url?: string | null
        role?: Database["public"]["Enums"]["user_role"]
        is_active?: boolean
        is_seller?: boolean
        premium_until?: string | null
        phone_verified?: boolean
        language?: string
        theme?: string
        notification_preferences?: Json
        onboarded?: boolean
        mfa_enrolled?: boolean
        last_login_at?: string | null
        created_at?: string
        updated_at?: string
        referral_code?: string | null
        referred_by?: string | null
        referred_at?: string | null
        wallet_balance?: number
        wallet_earned?: number
        wallet_spent?: number
      }
      Relationships: []
    }
      push_subscriptions: {
      Row: {
        id: string
        user_id: string
        endpoint: string
        p256dh: string
        auth: string
        user_agent: string | null
        created_at: string
      }
      Insert: {
        id?: string
        user_id: string
        endpoint: string
        p256dh: string
        auth: string
        user_agent?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        user_id?: string
        endpoint?: string
        p256dh?: string
        auth?: string
        user_agent?: string | null
        created_at?: string
      }
      Relationships: []
    }
      recently_viewed: {
      Row: {
        id: string
        user_id: string
        product_id: string
        viewed_at: string
      }
      Insert: {
        id?: string
        user_id: string
        product_id: string
        viewed_at?: string
      }
      Update: {
        id?: string
        user_id?: string
        product_id?: string
        viewed_at?: string
      }
      Relationships: []
    }
      review_photos: {
      Row: {
        id: string
        review_id: string
        url: string
        sort_order: number
        created_at: string
      }
      Insert: {
        id?: string
        review_id: string
        url: string
        sort_order?: number
        created_at?: string
      }
      Update: {
        id?: string
        review_id?: string
        url?: string
        sort_order?: number
        created_at?: string
      }
      Relationships: []
    }
      review_tags: {
      Row: {
        slug: string
        label_bn: string
        label_en: string
        sentiment: string
        sort_order: number
      }
      Insert: {
        slug: string
        label_bn: string
        label_en?: string
        sentiment?: string
        sort_order?: number
      }
      Update: {
        slug?: string
        label_bn?: string
        label_en?: string
        sentiment?: string
        sort_order?: number
      }
      Relationships: []
    }
      reviews: {
      Row: {
        id: string
        order_id: string | null
        sub_order_id: string | null
        product_id: string | null
        seller_id: string | null
        user_id: string | null
        rating: number
        seller_rating: number | null
        title_bn: string | null
        comment: string | null
        author_name: string | null
        author_location: string | null
        photos: string[]
        tags: string[]
        is_verified_purchase: boolean
        status: Database["public"]["Enums"]["review_status"]
        hidden_reason: string | null
        seller_reply: string | null
        seller_replied_at: string | null
        edited_at: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        order_id?: string | null
        sub_order_id?: string | null
        product_id?: string | null
        seller_id?: string | null
        user_id?: string | null
        rating?: number
        seller_rating?: number | null
        title_bn?: string | null
        comment?: string | null
        author_name?: string | null
        author_location?: string | null
        photos?: string[]
        tags?: string[]
        is_verified_purchase?: boolean
        status?: Database["public"]["Enums"]["review_status"]
        hidden_reason?: string | null
        seller_reply?: string | null
        seller_replied_at?: string | null
        edited_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        order_id?: string | null
        sub_order_id?: string | null
        product_id?: string | null
        seller_id?: string | null
        user_id?: string | null
        rating?: number
        seller_rating?: number | null
        title_bn?: string | null
        comment?: string | null
        author_name?: string | null
        author_location?: string | null
        photos?: string[]
        tags?: string[]
        is_verified_purchase?: boolean
        status?: Database["public"]["Enums"]["review_status"]
        hidden_reason?: string | null
        seller_reply?: string | null
        seller_replied_at?: string | null
        edited_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      role_permissions: {
      Row: {
        role: string
        permission: string
        is_granted: boolean
        updated_by: string | null
        updated_at: string
      }
      Insert: {
        role: string
        permission: string
        is_granted: boolean
        updated_by?: string | null
        updated_at?: string
      }
      Update: {
        role?: string
        permission?: string
        is_granted?: boolean
        updated_by?: string | null
        updated_at?: string
      }
      Relationships: []
    }
      seller_applications: {
      Row: {
        id: string
        user_id: string
        shop_name: string
        phone: string
        address: string
        farm_photos: string[]
        product_types: string
        nid_number: string
        payout_details: string
        status: string
        rejection_reason: string | null
        reviewed_by: string | null
        reviewed_at: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        user_id: string
        shop_name: string
        phone: string
        address: string
        farm_photos?: string[]
        product_types?: string
        nid_number: string
        payout_details: string
        status?: string
        rejection_reason?: string | null
        reviewed_by?: string | null
        reviewed_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        user_id?: string
        shop_name?: string
        phone?: string
        address?: string
        farm_photos?: string[]
        product_types?: string
        nid_number?: string
        payout_details?: string
        status?: string
        rejection_reason?: string | null
        reviewed_by?: string | null
        reviewed_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      seller_payouts: {
      Row: {
        id: string
        seller_id: string
        amount: number
        method: string | null
        reference: string | null
        status: string
        note: string | null
        paid_at: string | null
        created_by: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        seller_id: string
        amount: number
        method?: string | null
        reference?: string | null
        status?: string
        note?: string | null
        paid_at?: string | null
        created_by?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        seller_id?: string
        amount?: number
        method?: string | null
        reference?: string | null
        status?: string
        note?: string | null
        paid_at?: string | null
        created_by?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      seller_warnings: {
      Row: {
        id: string
        seller_id: string
        reason: string
        severity: string
        issued_by: string | null
        created_at: string
      }
      Insert: {
        id?: string
        seller_id: string
        reason: string
        severity?: string
        issued_by?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        seller_id?: string
        reason?: string
        severity?: string
        issued_by?: string | null
        created_at?: string
      }
      Relationships: []
    }
      sellers: {
      Row: {
        id: string
        user_id: string | null
        slug: string
        farm_id: string | null
        name_bn: string
        phone: string
        email: string | null
        nid: string | null
        farm_address_bn: string | null
        division: string
        district: string
        upazila: string | null
        farm_photos: string[]
        product_types: string[]
        logo: string | null
        banner: string | null
        payout_method: string
        payout_number: string | null
        bank_name: string | null
        bank_account: string | null
        commission_percent: number
        status: Database["public"]["Enums"]["seller_status"]
        rejection_reason: string | null
        approved_at: string | null
        created_at: string
        updated_at: string
        panel_path: string | null
        auto_approve_products: boolean
      }
      Insert: {
        id?: string
        user_id?: string | null
        slug: string
        farm_id?: string | null
        name_bn: string
        phone: string
        email?: string | null
        nid?: string | null
        farm_address_bn?: string | null
        division?: string
        district?: string
        upazila?: string | null
        farm_photos?: string[]
        product_types?: string[]
        logo?: string | null
        banner?: string | null
        payout_method?: string
        payout_number?: string | null
        bank_name?: string | null
        bank_account?: string | null
        commission_percent?: number
        status?: Database["public"]["Enums"]["seller_status"]
        rejection_reason?: string | null
        approved_at?: string | null
        created_at?: string
        updated_at?: string
        panel_path?: string | null
        auto_approve_products?: boolean
      }
      Update: {
        id?: string
        user_id?: string | null
        slug?: string
        farm_id?: string | null
        name_bn?: string
        phone?: string
        email?: string | null
        nid?: string | null
        farm_address_bn?: string | null
        division?: string
        district?: string
        upazila?: string | null
        farm_photos?: string[]
        product_types?: string[]
        logo?: string | null
        banner?: string | null
        payout_method?: string
        payout_number?: string | null
        bank_name?: string | null
        bank_account?: string | null
        commission_percent?: number
        status?: Database["public"]["Enums"]["seller_status"]
        rejection_reason?: string | null
        approved_at?: string | null
        created_at?: string
        updated_at?: string
        panel_path?: string | null
        auto_approve_products?: boolean
      }
      Relationships: []
    }
      seo_meta: {
      Row: {
        path: string
        title_bn: string | null
        title_en: string | null
        description_bn: string | null
        description_en: string | null
        keywords_bn: string[]
        og_title: string | null
        og_description: string | null
        og_image: string | null
        canonical: string | null
        noindex: boolean
        updated_at: string
      }
      Insert: {
        path: string
        title_bn?: string | null
        title_en?: string | null
        description_bn?: string | null
        description_en?: string | null
        keywords_bn?: string[]
        og_title?: string | null
        og_description?: string | null
        og_image?: string | null
        canonical?: string | null
        noindex?: boolean
        updated_at?: string
      }
      Update: {
        path?: string
        title_bn?: string | null
        title_en?: string | null
        description_bn?: string | null
        description_en?: string | null
        keywords_bn?: string[]
        og_title?: string | null
        og_description?: string | null
        og_image?: string | null
        canonical?: string | null
        noindex?: boolean
        updated_at?: string
      }
      Relationships: []
    }
      site_settings: {
      Row: {
        key: string
        value: Json
        updated_at: string
        seller_panel_path: string
      }
      Insert: {
        key: string
        value?: Json
        updated_at?: string
        seller_panel_path?: string
      }
      Update: {
        key?: string
        value?: Json
        updated_at?: string
        seller_panel_path?: string
      }
      Relationships: []
    }
      social_links: {
      Row: {
        id: string
        platform: string
        label_bn: string | null
        url: string
        icon: string | null
        color: string | null
        sort_order: number
        is_active: boolean
        show_header: boolean
        show_footer: boolean
        show_contact: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        platform: string
        label_bn?: string | null
        url: string
        icon?: string | null
        color?: string | null
        sort_order?: number
        is_active?: boolean
        show_header?: boolean
        show_footer?: boolean
        show_contact?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        platform?: string
        label_bn?: string | null
        url?: string
        icon?: string | null
        color?: string | null
        sort_order?: number
        is_active?: boolean
        show_header?: boolean
        show_footer?: boolean
        show_contact?: boolean
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      static_pages: {
      Row: {
        id: string
        slug: string
        title_bn: string
        title_en: string | null
        blocks: Json
        seo_title: string | null
        seo_description: string | null
        is_published: boolean
        show_in_footer: boolean
        sort_order: number
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        slug: string
        title_bn: string
        title_en?: string | null
        blocks?: Json
        seo_title?: string | null
        seo_description?: string | null
        is_published?: boolean
        show_in_footer?: boolean
        sort_order?: number
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        slug?: string
        title_bn?: string
        title_en?: string | null
        blocks?: Json
        seo_title?: string | null
        seo_description?: string | null
        is_published?: boolean
        show_in_footer?: boolean
        sort_order?: number
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      stream_tokens: {
      Row: {
        jti: string
        camera_id: string | null
        user_id: string | null
        fingerprint: string | null
        expires_at: string
        created_at: string
      }
      Insert: {
        jti?: string
        camera_id?: string | null
        user_id?: string | null
        fingerprint?: string | null
        expires_at: string
        created_at?: string
      }
      Update: {
        jti?: string
        camera_id?: string | null
        user_id?: string | null
        fingerprint?: string | null
        expires_at?: string
        created_at?: string
      }
      Relationships: []
    }
      sub_orders: {
      Row: {
        id: string
        order_id: string
        sub_no: string
        seller_id: string | null
        farm_id: string | null
        seller_name: string | null
        seller_phone: string | null
        subtotal: number
        commission: number
        seller_earning: number
        status: Database["public"]["Enums"]["order_status"]
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        order_id: string
        sub_no: string
        seller_id?: string | null
        farm_id?: string | null
        seller_name?: string | null
        seller_phone?: string | null
        subtotal?: number
        commission?: number
        seller_earning?: number
        status?: Database["public"]["Enums"]["order_status"]
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        order_id?: string
        sub_no?: string
        seller_id?: string | null
        farm_id?: string | null
        seller_name?: string | null
        seller_phone?: string | null
        subtotal?: number
        commission?: number
        seller_earning?: number
        status?: Database["public"]["Enums"]["order_status"]
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      subscription_plans: {
      Row: {
        id: string
        slug: string
        name_bn: string
        name_en: string | null
        members_label: string
        members_min: number
        members_max: number
        price_monthly: number
        saving_label: string | null
        features: string[]
        image: string | null
        is_popular: boolean
        is_active: boolean
        sort_order: number
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        slug: string
        name_bn: string
        name_en?: string | null
        members_label?: string
        members_min?: number
        members_max?: number
        price_monthly?: number
        saving_label?: string | null
        features?: string[]
        image?: string | null
        is_popular?: boolean
        is_active?: boolean
        sort_order?: number
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        slug?: string
        name_bn?: string
        name_en?: string | null
        members_label?: string
        members_min?: number
        members_max?: number
        price_monthly?: number
        saving_label?: string | null
        features?: string[]
        image?: string | null
        is_popular?: boolean
        is_active?: boolean
        sort_order?: number
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      subscriptions: {
      Row: {
        id: string
        sub_no: string
        user_id: string | null
        plan_id: string | null
        package_name: string
        customer_name: string
        phone: string
        division: string
        district: string
        upazila: string
        address: string
        members: number
        start_date: string
        frequency: Database["public"]["Enums"]["subscription_frequency"]
        price_monthly: number
        status: Database["public"]["Enums"]["subscription_status"]
        paused_until: string | null
        cancelled_at: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        sub_no: string
        user_id?: string | null
        plan_id?: string | null
        package_name: string
        customer_name: string
        phone: string
        division: string
        district: string
        upazila: string
        address: string
        members?: number
        start_date?: string
        frequency?: Database["public"]["Enums"]["subscription_frequency"]
        price_monthly?: number
        status?: Database["public"]["Enums"]["subscription_status"]
        paused_until?: string | null
        cancelled_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        sub_no?: string
        user_id?: string | null
        plan_id?: string | null
        package_name?: string
        customer_name?: string
        phone?: string
        division?: string
        district?: string
        upazila?: string
        address?: string
        members?: number
        start_date?: string
        frequency?: Database["public"]["Enums"]["subscription_frequency"]
        price_monthly?: number
        status?: Database["public"]["Enums"]["subscription_status"]
        paused_until?: string | null
        cancelled_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      support_chats: {
      Row: {
        id: string
        user_id: string | null
        guest_key: string | null
        customer_name: string | null
        customer_phone: string | null
        customer_email: string | null
        page_path: string | null
        subject: string | null
        status: string
        claimed_by: string | null
        claimed_at: string | null
        closed_by: string | null
        closed_at: string | null
        closed_reason: string | null
        last_customer_at: string
        last_staff_at: string | null
        reply_window_min: number
        message_count: number
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        user_id?: string | null
        guest_key?: string | null
        customer_name?: string | null
        customer_phone?: string | null
        customer_email?: string | null
        page_path?: string | null
        subject?: string | null
        status?: string
        claimed_by?: string | null
        claimed_at?: string | null
        closed_by?: string | null
        closed_at?: string | null
        closed_reason?: string | null
        last_customer_at?: string
        last_staff_at?: string | null
        reply_window_min?: number
        message_count?: number
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        user_id?: string | null
        guest_key?: string | null
        customer_name?: string | null
        customer_phone?: string | null
        customer_email?: string | null
        page_path?: string | null
        subject?: string | null
        status?: string
        claimed_by?: string | null
        claimed_at?: string | null
        closed_by?: string | null
        closed_at?: string | null
        closed_reason?: string | null
        last_customer_at?: string
        last_staff_at?: string | null
        reply_window_min?: number
        message_count?: number
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      support_messages: {
      Row: {
        id: string
        chat_id: string
        author_role: string
        author_id: string | null
        author_name: string | null
        body: string
        is_system: boolean
        created_at: string
      }
      Insert: {
        id?: string
        chat_id: string
        author_role?: string
        author_id?: string | null
        author_name?: string | null
        body: string
        is_system?: boolean
        created_at?: string
      }
      Update: {
        id?: string
        chat_id?: string
        author_role?: string
        author_id?: string | null
        author_name?: string | null
        body?: string
        is_system?: boolean
        created_at?: string
      }
      Relationships: []
    }
      team_members: {
      Row: {
        id: string
        user_id: string | null
        name_bn: string
        name_en: string | null
        role_bn: string
        role_en: string | null
        bio_bn: string | null
        photo: string | null
        email: string | null
        phone: string | null
        sort_order: number
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        user_id?: string | null
        name_bn: string
        name_en?: string | null
        role_bn?: string
        role_en?: string | null
        bio_bn?: string | null
        photo?: string | null
        email?: string | null
        phone?: string | null
        sort_order?: number
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        user_id?: string | null
        name_bn?: string
        name_en?: string | null
        role_bn?: string
        role_en?: string | null
        bio_bn?: string | null
        photo?: string | null
        email?: string | null
        phone?: string | null
        sort_order?: number
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      trials: {
      Row: {
        id: string
        fingerprint: string
        user_id: string | null
        minutes: number
        ip_hash: string | null
        started_at: string
        expires_at: string
        created_at: string
        device_hash: string | null
      }
      Insert: {
        id?: string
        fingerprint: string
        user_id?: string | null
        minutes?: number
        ip_hash?: string | null
        started_at?: string
        expires_at: string
        created_at?: string
        device_hash?: string | null
      }
      Update: {
        id?: string
        fingerprint?: string
        user_id?: string | null
        minutes?: number
        ip_hash?: string | null
        started_at?: string
        expires_at?: string
        created_at?: string
        device_hash?: string | null
      }
      Relationships: []
    }
      user_subscriptions: {
      Row: {
        id: string
        sub_no: string
        user_id: string
        plan_id: string | null
        plan_name_bn: string
        tier: Database["public"]["Enums"]["premium_tier"]
        amount: number
        status: Database["public"]["Enums"]["premium_status"]
        started_at: string | null
        expires_at: string | null
        grace_until: string | null
        platform: string
        payment_method: string | null
        payment_ref: string | null
        auto_renew: boolean
        device_limit: number
        cancelled_at: string | null
        cancel_reason: string | null
        reviewed_at: string | null
        reviewed_by: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        sub_no: string
        user_id: string
        plan_id?: string | null
        plan_name_bn?: string
        tier?: Database["public"]["Enums"]["premium_tier"]
        amount?: number
        status?: Database["public"]["Enums"]["premium_status"]
        started_at?: string | null
        expires_at?: string | null
        grace_until?: string | null
        platform?: string
        payment_method?: string | null
        payment_ref?: string | null
        auto_renew?: boolean
        device_limit?: number
        cancelled_at?: string | null
        cancel_reason?: string | null
        reviewed_at?: string | null
        reviewed_by?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        sub_no?: string
        user_id?: string
        plan_id?: string | null
        plan_name_bn?: string
        tier?: Database["public"]["Enums"]["premium_tier"]
        amount?: number
        status?: Database["public"]["Enums"]["premium_status"]
        started_at?: string | null
        expires_at?: string | null
        grace_until?: string | null
        platform?: string
        payment_method?: string | null
        payment_ref?: string | null
        auto_renew?: boolean
        device_limit?: number
        cancelled_at?: string | null
        cancel_reason?: string | null
        reviewed_at?: string | null
        reviewed_by?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
      wallet_transactions: {
      Row: {
        id: string
        user_id: string
        kind: string
        amount: number
        balance_after: number
        order_id: string | null
        order_no: string | null
        note_bn: string | null
        created_by: string | null
        created_at: string
      }
      Insert: {
        id?: string
        user_id: string
        kind: string
        amount: number
        balance_after: number
        order_id?: string | null
        order_no?: string | null
        note_bn?: string | null
        created_by?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        user_id?: string
        kind?: string
        amount?: number
        balance_after?: number
        order_id?: string | null
        order_no?: string | null
        note_bn?: string | null
        created_by?: string | null
        created_at?: string
      }
      Relationships: []
    }
      wishlist: {
      Row: {
        id: string
        user_id: string
        product_id: string
        created_at: string
      }
      Insert: {
        id?: string
        user_id: string
        product_id: string
        created_at?: string
      }
      Update: {
        id?: string
        user_id?: string
        product_id?: string
        created_at?: string
      }
      Relationships: []
    }
    }
    Views: {
      public_cameras: {
      Row: {
        id: string | null
        farm_id: string | null
        name_bn: string | null
        zone_bn: string | null
        protocol: Database["public"]["Enums"]["camera_protocol"] | null
        poster: string | null
        status: Database["public"]["Enums"]["camera_status"] | null
        is_active: boolean | null
        is_premium: boolean | null
        max_viewers: number | null
        sort_order: number | null
        last_heartbeat: string | null
        farm_slug: string | null
        farm_name_bn: string | null
        farm_district: string | null
      }
      Relationships: []
    }
      public_sellers: {
      Row: {
        id: string | null
        slug: string | null
        name_bn: string | null
        farm_id: string | null
        division: string | null
        district: string | null
        farm_address_bn: string | null
        farm_photos: string[] | null
        product_types: string[] | null
        logo: string | null
        banner: string | null
        commission_percent: number | null
        status: Database["public"]["Enums"]["seller_status"] | null
        approved_at: string | null
        created_at: string | null
        farm_slug: string | null
        farm_name_bn: string | null
        farm_cover: string | null
        certifications: string[] | null
      }
      Relationships: []
    }
      v_farm_stats: {
      Row: {
        farm_id: string | null
        camera_count: number | null
        online_cameras: number | null
        product_count: number | null
      }
      Relationships: []
    }
      v_premium_revenue: {
      Row: {
        month: string | null
        plan_name_bn: string | null
        subscriptions: number | null
        revenue: number | null
      }
      Relationships: []
    }
      v_product_rating_breakdown: {
      Row: {
        product_id: string | null
        total: number | null
        r5: number | null
        r4: number | null
        r3: number | null
        r2: number | null
        r1: number | null
        avg_rating: number | null
      }
      Relationships: []
    }
      v_product_supplier: {
      Row: {
        product_id: string | null
        seller_id: string | null
        seller_slug: string | null
        seller_name_bn: string | null
        farm_id: string | null
        farm_slug: string | null
        farm_name_bn: string | null
        farm_photo: string | null
        farm_bio_bn: string | null
        farm_description_bn: string | null
        farm_cover: string | null
        farm_images: string[] | null
        division: string | null
        district: string | null
        farm_upazila: string | null
        farm_address_bn: string | null
        farm_lat: number | null
        farm_lng: number | null
        established_year: number | null
        certifications: string[] | null
        product_count: number | null
        camera_count: number | null
      }
      Relationships: []
    }
      v_seller_leaderboard: {
      Row: {
        seller_id: string | null
        slug: string | null
        name_bn: string | null
        orders: number | null
        gross: number | null
        commission: number | null
        earnings: number | null
      }
      Relationships: []
    }
      v_supplier_quality: {
      Row: {
        seller_id: string | null
        slug: string | null
        name_bn: string | null
        status: Database["public"]["Enums"]["seller_status"] | null
        review_count: number | null
        avg_rating: number | null
        avg_seller_rating: number | null
        low_rating_count: number | null
        complaint_count: number | null
        resolved_count: number | null
        sub_order_count: number | null
        delivered_count: number | null
        complaint_rate: number | null
        on_time_rate: number | null
        quality_score: number | null
      }
      Relationships: []
    }
      v_team_members: {
      Row: {
        member_id: string | null
        user_id: string | null
        full_name: string | null
        email: string | null
        phone: string | null
        photo: string | null
        role: Database["public"]["Enums"]["user_role"] | null
        is_active: boolean | null
        last_login_at: string | null
        created_at: string | null
        public_member_id: string | null
      }
      Relationships: []
    }
    }
    Functions: {
      apply_referral: {
      Args: { p_user: string; p_code: string }
      Returns: Json
    }
      assign_referral_code: {
      Args: {  }
      Returns: Json
    }
      chat_claim: {
      Args: { p_chat: string; p_actor: string }
      Returns: Json
    }
      chat_close: {
      Args: { p_chat: string; p_reason: string; p_actor: string }
      Returns: Json
    }
      chat_sweep: {
      Args: {  }
      Returns: Json
    }
      coupon_allows_user: {
      Args: { p_coupon: string; p_user: string }
      Returns: boolean
    }
      coupon_refusal: {
      Args: { p_coupon: string; p_user: string }
      Returns: string
    }
      credit_referral: {
      Args: { p_order: string }
      Returns: undefined
    }
      gen_order_no: {
      Args: {  }
      Returns: string
    }
      gen_referral_code: {
      Args: {  }
      Returns: string
    }
      guard_profile_role: {
      Args: {  }
      Returns: Json
    }
      handle_new_user: {
      Args: {  }
      Returns: Json
    }
      has_role: {
      Args: { p_roles: string[] }
      Returns: boolean
    }
      is_admin: {
      Args: {  }
      Returns: boolean
    }
      is_my_seller: {
      Args: { p_seller: string }
      Returns: boolean
    }
      is_seller: {
      Args: {  }
      Returns: boolean
    }
      is_service_request: {
      Args: {  }
      Returns: boolean
    }
      is_staff: {
      Args: {  }
      Returns: boolean
    }
      log_audit: {
      Args: { p_actor: string; p_action: string; p_entity: string; p_entity_id: string; p_meta: Json; p_diff: Json }
      Returns: undefined
    }
      login_help: {
      Args: { p_email: string }
      Returns: Json
    }
      move_payment_method: {
      Args: { p_id: string; p_direction: number }
      Returns: Json
    }
      notify_admins_on_new_order: {
      Args: {  }
      Returns: Json
    }
      notify_seller_on_new_sub_order: {
      Args: {  }
      Returns: Json
    }
      on_order_delivered: {
      Args: {  }
      Returns: Json
    }
      order_cancel: {
      Args: { p_order: string; p_reason: string; p_actor: string }
      Returns: Json
    }
      order_delete: {
      Args: { p_order: string; p_actor: string }
      Returns: Json
    }
      order_release_order: {
      Args: { p_order: string; p_actor: string }
      Returns: Json
    }
      payment_claim: {
      Args: { p_ref: string; p_kind: string; p_target: string; p_user: string }
      Returns: Json
    }
      payment_ref_key: {
      Args: { p_ref: string }
      Returns: string
    }
      payment_submit: {
      Args: { p_kind: string; p_target: string; p_ref: string; p_user: string }
      Returns: Json
    }
      place_order: {
      Args: { p_user: string; p_customer: Json; p_items: Json; p_payment_method: string; p_coupon: string; p_wallet: number }
      Returns: Json
    }
      premium_device_register: {
      Args: { p_user: string; p_sub: string; p_fp: string; p_limit: number; p_label: string; p_ua: string }
      Returns: Json
    }
      recalc_product_rating: {
      Args: { p_product: string }
      Returns: undefined
    }
      referrer_for_token: {
      Args: { p_code: string; p_user: string }
      Returns: string
    }
      resolve_ref: {
      Args: { p_code: string; p_user: string }
      Returns: Json
    }
      role_permission_defaults: {
      Args: {  }
      Returns: Json[]
    }
      role_permissions_effective: {
      Args: { p_role: string }
      Returns: string[]
    }
      role_permissions_reset: {
      Args: { p_role: string; p_actor: string }
      Returns: Json
    }
      role_permissions_set: {
      Args: { p_role: string; p_grants: string[]; p_revokes: string[]; p_actor: string }
      Returns: Json
    }
      set_complaint_ticket: {
      Args: {  }
      Returns: Json
    }
      set_updated_at: {
      Args: {  }
      Returns: Json
    }
      stream_prune_tokens: {
      Args: {  }
      Returns: number
    }
      stream_reserve_slot: {
      Args: { p_camera: string; p_user: string; p_fingerprint: string; p_ttl_seconds: number }
      Returns: Json
    }
      support_touch_chat: {
      Args: {  }
      Returns: Json
    }
      sync_product_images: {
      Args: { p_product: string }
      Returns: undefined
    }
      touch_updated_at: {
      Args: {  }
      Returns: Json
    }
      trg_product_images_sync: {
      Args: {  }
      Returns: Json
    }
      trg_review_photos_sync: {
      Args: {  }
      Returns: Json
    }
      trg_reviews_recalc: {
      Args: {  }
      Returns: Json
    }
      wallet_apply: {
      Args: { p_user: string; p_kind: string; p_amount: number; p_order: string; p_order_no: string; p_note: string; p_by: string }
      Returns: number
    }
    }
    Enums: {
      access_code_status: "unused" | "used" | "revoked" | "expired"
      camera_protocol: "hls" | "webrtc" | "cloud"
      camera_status: "online" | "offline" | "maintenance"
      combo_kind: "daily" | "weekly" | "monthly"
      complaint_problem: "spoiled" | "short_weight" | "wrong_item" | "late" | "other"
      complaint_status: "open" | "in_review" | "resolved" | "rejected"
      coupon_type: "percent" | "fixed"
      farm_type: "vegetables" | "dairy" | "poultry" | "fish" | "fruits"
      notification_audience: "user" | "seller" | "admin"
      notification_kind: "order" | "status" | "premium" | "seller" | "product" | "camera" | "payment" | "system"
      order_status: "received" | "packing" | "shipped" | "delivered" | "cancelled"
      payment_account_type: "personal" | "agent" | "merchant" | "account"
      payment_method_kind: "mfs" | "bank" | "cod" | "gateway" | "other"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      premium_interval: "monthly" | "half_yearly" | "yearly"
      premium_status: "pending" | "active" | "grace" | "expired" | "cancelled"
      premium_tier: "basic" | "full"
      product_approval: "pending" | "approved" | "rejected"
      resolution_type: "refund" | "replacement" | "inform"
      review_status: "published" | "hidden"
      seller_status: "pending" | "approved" | "rejected" | "suspended"
      subscription_frequency: "weekly" | "biweekly" | "monthly"
      subscription_status: "active" | "paused" | "cancelled"
      user_role: "customer" | "premium" | "seller" | "staff" | "manager" | "admin"
    }
    CompositeTypes: {}
  }
}

/* ------------------------------------------------------------------ helpers */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]
export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"]
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T]
export type Functions<T extends keyof Database["public"]["Functions"]> =
  Database["public"]["Functions"][T]
