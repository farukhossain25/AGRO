export type Category = {
  id: string;
  slug: string;
  name_bn: string;
  name_en: string;
  description_bn: string | null;
  icon: string | null;
  image: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type Product = {
  id: string;
  slug: string;
  category_id: string | null;
  name_bn: string;
  name_en: string;
  description_bn: string | null;
  unit: string;
  unit_en: string | null;
  price: number;
  compare_price: number | null;
  stock: number;
  image: string | null;
  images: string[] | null;
  farm_source_bn: string | null;
  harvest_date: string | null;
  badge_bn: string | null;
  rating: number;
  review_count: number;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

export type ComboContent = { name: string; qty: string };

export type Combo = {
  id: string;
  slug: string;
  name_bn: string;
  name_en: string | null;
  description_bn: string | null;
  kind: "daily" | "weekly" | "monthly";
  price: number;
  original_price: number | null;
  contents: ComboContent[];
  image: string | null;
  is_active: boolean;
  sort_order: number;
};

export type Package = {
  id: string;
  slug: string;
  name_bn: string;
  name_en: string | null;
  members_label: string;
  members_min: number;
  members_max: number;
  price_monthly: number;
  saving_label: string | null;
  features: string[];
  image: string | null;
  is_popular: boolean;
  is_active: boolean;
  sort_order: number;
};

export type DeliveryZone = {
  id: string;
  district: string;
  district_en: string | null;
  division: string;
  scope: "inside_dhaka" | "outside_dhaka";
  charge: number;
  free_over: number | null;
  eta_days: string;
  is_active: boolean;
};

export type Coupon = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
};

export type OrderStatus = "received" | "packing" | "shipped" | "delivered" | "cancelled";
export type PaymentMethod = "cod" | "bkash" | "nagad" | "sslcommerz";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  name_bn: string;
  unit: string | null;
  price: number;
  quantity: number;
  image: string | null;
};

export type Order = {
  id: string;
  order_no: string;
  user_id: string | null;
  customer_name: string;
  phone: string;
  email: string | null;
  division: string;
  district: string;
  upazila: string;
  address: string;
  delivery_note: string | null;
  subtotal: number;
  delivery_charge: number;
  discount: number;
  total: number;
  coupon_code: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_ref: string | null;
  status: OrderStatus;
  created_at: string;
  updated_at: string | null;
  order_items?: OrderItem[];
};

/* ==========================================================================
   Manual payments (section A) — added by migration 0009
   --------------------------------------------------------------------------
   `PaymentMethod` above is the legacy union used by `orders.payment_method`;
   `PaymentMethodRow` is the admin-managed table. The column keeps the legacy
   union for backwards compatibility and gains a free-text fallback so a custom
   method (e.g. "upay") can be stored without a migration.
   ========================================================================== */

export type PaymentMethodKind = "mfs" | "bank" | "cod" | "gateway" | "other";
export type PaymentAccountType = "personal" | "agent" | "merchant" | "account";

export type PaymentMethodRow = {
  id: string;
  code: string;
  name_bn: string;
  name_en: string | null;
  kind: PaymentMethodKind;
  logo_url: string | null;
  account_type: PaymentAccountType | null;
  account_number: string | null;
  account_name: string | null;
  bank_name: string | null;
  branch_name: string | null;
  routing_number: string | null;
  instruction_bn: string | null;
  min_amount: number;
  max_amount: number | null;
  trx_pattern: string | null;
  requires_trx: boolean;
  requires_sender: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** Everything the storefront needs to render "send money to this number". */
export type PublicPaymentMethod = Pick<
  PaymentMethodRow,
  | "id"
  | "code"
  | "name_bn"
  | "name_en"
  | "kind"
  | "logo_url"
  | "account_type"
  | "account_number"
  | "account_name"
  | "bank_name"
  | "branch_name"
  | "instruction_bn"
  | "min_amount"
  | "max_amount"
  | "requires_trx"
  | "requires_sender"
>;

export type PaymentStatusManual = "pending" | "verified" | "rejected" | "needs_info";
export type PaymentPurpose = "order" | "premium";

export type PaymentRow = {
  id: string;
  payment_no: string;
  user_id: string | null;
  purpose: PaymentPurpose;
  order_id: string | null;
  subscription_id: string | null;
  method_id: string | null;
  method_code: string;
  method_name_bn: string | null;
  expected_amount: number;
  amount: number;
  sender_number: string | null;
  trx_id: string | null;
  trx_norm: string | null;
  paid_at: string | null;
  screenshot_url: string | null;
  status: PaymentStatusManual;
  reject_reason: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_ip: string | null;
  submitted_agent: string | null;
  attempt_no: number;
  created_at: string;
  updated_at: string | null;
};

/** One row of the admin queue — the view adds these computed fields. */
export type PaymentQueueRow = PaymentRow & {
  amount_delta: number;
  amount_matches: boolean;
  trx_collision: boolean;
  order_no: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  sub_no: string | null;
  plan_name_bn: string | null;
};

export type PaymentLog = {
  id: string;
  payment_id: string;
  actor_id: string | null;
  actor_role: string | null;
  action:
    | "submitted"
    | "resubmitted"
    | "approved"
    | "rejected"
    | "needs_info"
    | "reopened"
    | "bulk_approved"
    | "note";
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  ip: string | null;
  created_at: string;
};

/* ------------------------------------------------------------ site content */

export type SocialLink = {
  id: string;
  platform: string;
  label_bn: string | null;
  url: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  show_header: boolean;
  show_footer: boolean;
  show_contact: boolean;
  created_at: string;
};

export type HeroSlide = {
  id: string;
  title_bn: string;
  subtitle_bn: string | null;
  image_url: string | null;
  image_mobile_url: string | null;
  video_url: string | null;
  alt_bn: string | null;
  cta_label_bn: string | null;
  cta_href: string | null;
  secondary_label_bn: string | null;
  secondary_href: string | null;
  text_position: "left" | "center" | "right";
  text_tone: "light" | "dark";
  overlay_opacity: number;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type HomepageSection = {
  id: string;
  key: string;
  label_bn: string;
  is_visible: boolean;
  sort_order: number;
  config: Record<string, unknown>;
  updated_at: string | null;
};

export type Subscription = {
  id: string;
  sub_no: string;
  user_id: string | null;
  package_id: string | null;
  package_name: string;
  customer_name: string;
  phone: string;
  division: string;
  district: string;
  upazila: string;
  address: string;
  members: number;
  start_date: string;
  frequency: "weekly" | "biweekly" | "monthly";
  price_monthly: number;
  status: "active" | "paused" | "cancelled";
  paused_until: string | null;
  created_at: string;
};

export type Review = {
  id: string;
  product_id: string | null;
  user_id: string | null;
  name_bn: string;
  location_bn: string | null;
  rating: number;
  comment: string;
  is_approved: boolean;
  created_at: string;
};

/* ------------------------------------------------------- reviews (0005) */

export type ReviewStatus = "published" | "hidden";

/** A single verified-purchase review of one product inside one order. */
export type OrderReview = {
  id: string;
  order_id: string;
  sub_order_id: string | null;
  product_id: string;
  seller_id: string | null;
  user_id: string;
  rating: number;
  seller_rating: number | null;
  title_bn: string | null;
  comment: string | null;
  photos: string[];
  tags: string[];
  is_verified_purchase: boolean;
  status: ReviewStatus;
  hidden_reason: string | null;
  seller_reply: string | null;
  seller_replied_at: string | null;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
};

/** Review row joined with the display fields the product page needs. */
export type ReviewWithProfile = OrderReview & {
  products: { name_bn: string; slug: string; image: string | null } | null;
  sellers: { name_bn: string; slug: string } | null;
  reviewer: { full_name: string | null; avatar_url: string | null } | null;
};

export type RatingBreakdown = {
  total: number;
  r5: number;
  r4: number;
  r3: number;
  r2: number;
  r1: number;
  avg_rating: number;
};

export type ReviewSort = "newest" | "highest" | "lowest";

export type ProblemType = "spoiled" | "short_weight" | "wrong_item" | "late" | "other";
export type Resolution = "refund" | "replacement" | "inform";
export type ComplaintStatus = "open" | "in_review" | "resolved" | "rejected";

export type Complaint = {
  id: string;
  ticket_no: string;
  order_id: string;
  sub_order_id: string | null;
  order_item_id: string | null;
  product_id: string | null;
  seller_id: string | null;
  user_id: string;
  problem_type: ProblemType;
  description: string;
  photos: string[];
  preferred_resolution: Resolution;
  status: ComplaintStatus;
  /** what was actually granted once resolved */
  resolution: Resolution | "none" | null;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ComplaintMessage = {
  id: string;
  complaint_id: string;
  author_role: "customer" | "seller" | "admin";
  author_id: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
};

export type SupplierQuality = {
  seller_id: string;
  slug: string;
  name_bn: string;
  status: SellerStatus;
  review_count: number;
  avg_rating: number;
  avg_seller_rating: number;
  low_rating_count: number;
  complaint_count: number;
  resolved_count: number;
  sub_order_count: number;
  delivered_count: number;
  complaint_rate: number;
  on_time_rate: number;
  quality_score: number;
};

export type ReviewTag = {
  slug: string;
  label_bn: string;
  label_en: string;
  sentiment: "positive" | "negative";
  sort_order: number;
};

export type BlogPost = {
  id: string;
  slug: string;
  title_bn: string;
  excerpt_bn: string | null;
  content_bn: string;
  cover: string | null;
  author_bn: string;
  tag_bn: string;
  read_minutes: number;
  published_at: string;
  is_active: boolean;
};

export type Farmer = {
  id: string;
  name_bn: string;
  location_bn: string | null;
  specialty_bn: string | null;
  story_bn: string | null;
  years: number;
  image: string | null;
  is_active: boolean;
  sort_order: number;
};

export type Banner = {
  id: string;
  title_bn: string;
  subtitle_bn: string | null;
  image: string | null;
  link: string;
  placement: string;
  is_active: boolean;
  sort_order: number;
};

export type UserRole = "customer" | "premium" | "seller" | "staff" | "manager" | "admin";

export type User = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  phone_verified: boolean;
  is_active: boolean;
  premium_until?: string | null;
  is_seller?: boolean;
  created_at: string;
};

export type Address = {
  id: string;
  user_id: string;
  label: string;
  full_name: string;
  phone: string;
  division: string;
  district: string;
  upazila: string;
  address: string;
  is_default: boolean;
  created_at: string;
};

/* ==========================================================================
   Premium multi-vendor platform
   ========================================================================== */

export type FarmType = "vegetables" | "dairy" | "poultry" | "fish" | "fruits";

/** Calendar month + what is harvested — shown on the farm detail page. */
export type HarvestSlot = { month: string; crops: string[] };

/** Dairy production numbers rendered on /dairy-live. */
export type DailyOutput = {
  cows?: number;
  litres_today?: number;
  litres_week?: number;
  sold_today?: number;
  updated_at?: string;
  note_bn?: string;
};

export type Farm = {
  id: string;
  slug: string;
  name_bn: string;
  name_en: string | null;
  type: FarmType;
  owner_user_id: string | null;
  owner_name_bn: string | null;
  owner_phone: string | null;
  owner_photo: string | null;
  owner_bio_bn: string | null;
  division: string;
  district: string;
  upazila: string | null;
  address_bn: string | null;
  lat: number | null;
  lng: number | null;
  /** [[lng, lat], …] closed ring */
  boundary: number[][] | null;
  harvest_calendar: HarvestSlot[] | null;
  description_bn: string | null;
  story_bn: string | null;
  cover: string | null;
  images: string[] | null;
  daily_output: DailyOutput | null;
  established_year: number | null;
  certifications: string[] | null;
  is_active: boolean;
  is_premium: boolean;
  sort_order: number;
  created_at: string;
  /** added by v_farm_stats / joined queries */
  camera_count?: number;
  online_cameras?: number;
  product_count?: number;
  cameras?: Camera[];
};

export type CameraStatus = "online" | "offline" | "maintenance";

/**
 * Public camera shape. stream_key / stream_url are NEVER included — the browser
 * only receives a signed playback URL from /api/stream/token.
 */
export type Camera = {
  id: string;
  farm_id: string;
  name_bn: string;
  zone_bn: string;
  protocol: "hls" | "webrtc";
  poster: string | null;
  location_lat: number | null;
  location_lng: number | null;
  status: CameraStatus;
  last_heartbeat: string | null;
  is_active: boolean;
  is_premium: boolean;
  max_viewers: number;
  sort_order: number;
};

export type PremiumTier = "basic" | "full";
export type PremiumInterval = "monthly" | "half_yearly" | "yearly";

export type PremiumPlan = {
  id: string;
  slug: string;
  name_bn: string;
  name_en: string | null;
  tier: PremiumTier;
  interval: PremiumInterval;
  price: number;
  compare_price: number | null;
  duration_days: number;
  max_devices: number;
  features: string[];
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
};

export type PremiumStatus = "pending" | "active" | "grace" | "expired" | "cancelled";

export type PremiumSubscription = {
  id: string;
  sub_no: string;
  user_id: string;
  plan_id: string | null;
  plan_name_bn: string;
  tier: PremiumTier;
  amount: number;
  status: PremiumStatus;
  started_at: string | null;
  expires_at: string | null;
  grace_until: string | null;
  platform: "web" | "android";
  payment_method: string | null;
  payment_ref: string | null;
  auto_renew: boolean;
  device_limit: number;
  created_at: string;
};

export type AccessCodeStatus = "unused" | "used" | "revoked" | "expired";

export type PremiumAccessCode = {
  id: string;
  code: string;
  plan_id: string | null;
  user_id: string | null;
  subscription_id: string | null;
  status: AccessCodeStatus;
  issued_at: string;
  used_at: string | null;
  expires_at: string | null;
  note: string | null;
};

/** What /api/premium/status returns to the browser. */
export type PremiumState = {
  isPremium: boolean;
  role: UserRole;
  subscription: PremiumSubscription | null;
  daysLeft: number | null;
  hoursLeft: number | null;
  trial: { active: boolean; expiresAt: string | null; minutes: number } | null;
  canWatch: boolean;
  reason: "premium" | "trial" | "locked" | "anonymous";
  deviceLimit: number;
};

export type SellerStatus = "pending" | "approved" | "rejected" | "suspended";

export type Seller = {
  id: string;
  /** null for admin-created/demo stores that no login owns yet */
  user_id: string | null;
  slug: string;
  farm_id: string | null;
  name_bn: string;
  phone: string;
  email: string | null;
  nid: string | null;
  farm_address_bn: string | null;
  division: string;
  district: string;
  farm_photos: string[] | null;
  product_types: string[] | null;
  payout_method: "bkash" | "nagad" | "bank";
  payout_number: string | null;
  bank_name: string | null;
  bank_account: string | null;
  commission_percent: number;
  status: SellerStatus;
  rejection_reason: string | null;
  approved_at: string | null;
  created_at: string;
  /** joined */
  farm?: Farm | null;
  stats?: { orders: number; gross: number; commission: number; earnings: number };
};

export type ProductApproval = "pending" | "approved" | "rejected";

export type SubOrder = {
  id: string;
  order_id: string;
  sub_no: string;
  seller_id: string | null;
  farm_id: string | null;
  seller_name: string | null;
  subtotal: number;
  commission: number;
  seller_earning: number;
  status: OrderStatus;
  created_at: string;
  items?: OrderItem[];
  parcel?: Parcel | null;
};

export type CustomComboItem = {
  productId: string;
  slug: string;
  name_bn: string;
  unit: string;
  price: number;
  qty: number;
  sellerId: string | null;
  image: string | null;
};

export type CustomCombo = {
  id: string;
  user_id: string;
  name_bn: string;
  items: CustomComboItem[];
  item_count: number;
  price_cached: number;
  repeat_interval: "none" | "weekly" | "monthly";
  is_active: boolean;
  created_at: string;
};

export type NotificationKind =
  | "order"
  | "status"
  | "premium"
  | "seller"
  | "product"
  | "camera"
  | "payment"
  | "system";

export type Notification = {
  id: string;
  user_id: string;
  audience: "user" | "seller" | "admin";
  kind: NotificationKind;
  title_bn: string;
  body_bn: string | null;
  link: string | null;
  meta: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

/** Everything printed on the A6 / thermal parcel label. */
export type ParcelLabel = {
  orderId: string;
  orderNo: string;
  subNo: string;
  couponCode?: string | null;
  customerName: string;
  customerPhone: string;
  address: string;
  area: string;
  district: string;
  items: { name_bn: string; qty: number; unit: string; weight_grams?: number | null }[];
  totalWeightGrams: number;
  sellerName: string;
  sellerPhone: string;
  farmName: string;
  farmAddress: string;
  harvestDate: string;
  packingDate: string;
  deliveryDate: string;
  paymentMethod: string;
  codAmount: number;
  qrToken: string;
  qrUrl: string;
};

export type Parcel = {
  id: string;
  order_id: string;
  sub_order_id: string | null;
  order_no: string;
  qr_token: string;
  label: ParcelLabel | Record<string, never>;
  printed_count: number;
  delivered_at: string | null;
  delivered_by: string | null;
  created_at: string;
};

export type AuditLog = {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
};
