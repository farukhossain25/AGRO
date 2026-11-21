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

export type User = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: "customer" | "admin";
  phone_verified: boolean;
  is_active: boolean;
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
