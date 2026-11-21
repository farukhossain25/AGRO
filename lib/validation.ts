import { z } from "zod";

/* --------------------------------------------------------------- primitives */
export const bdPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => /^(\+?88)?01[3-9]\d{8}$/.test(v), "সঠিক মোবাইল নম্বর দিন (যেমন: 01712345678)")
  .transform((v) => {
    const digits = v.replace(/^\+?88/, "");
    return `0${digits.replace(/^0/, "")}`;
  });

export const email = z.string().trim().toLowerCase().email("সঠিক ইমেইল দিন");
export const password = z
  .string()
  .min(8, "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে")
  .max(72, "পাসওয়ার্ড অনেক বড়");

/* ------------------------------------------------------------------- auth */
export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "নাম কমপক্ষে ২ অক্ষর").max(80),
    email: email.optional().or(z.literal("")),
    phone: bdPhone,
    password,
  })
  .refine((d) => Boolean(d.email) || Boolean(d.phone), {
    message: "ইমেইল অথবা মোবাইল নম্বর দিন",
    path: ["email"],
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "ইমেইল বা মোবাইল নম্বর দিন"),
  password: z.string().min(1, "পাসওয়ার্ড দিন"),
});

export const otpRequestSchema = z.object({ phone: bdPhone });

export const otpVerifySchema = z.object({
  phone: bdPhone,
  code: z.string().trim().regex(/^\d{6}$/, "৬ ডিজিটের কোড দিন"),
  name: z.string().trim().max(80).optional(),
});

/* ----------------------------------------------------------------- orders */
export const cartItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["product", "combo"]).default("product"),
  quantity: z.number().int().min(1).max(99),
});

export const checkoutSchema = z.object({
  customer_name: z.string().trim().min(2, "পুরো নাম দিন").max(80),
  phone: bdPhone,
  email: z.string().trim().email("সঠিক ইমেইল দিন").optional().or(z.literal("")),
  division: z.string().trim().min(1, "বিভাগ নির্বাচন করুন"),
  district: z.string().trim().min(1, "জেলা নির্বাচন করুন"),
  upazila: z.string().trim().min(1, "উপজেলা নির্বাচন করুন"),
  address: z.string().trim().min(8, "সম্পূর্ণ ঠিকানা লিখুন").max(400),
  delivery_note: z.string().trim().max(300).optional().or(z.literal("")),
  payment_method: z.enum(["cod", "bkash", "nagad", "sslcommerz"]),
  coupon_code: z.string().trim().max(24).optional().or(z.literal("")),
  items: z.array(cartItemSchema).min(1, "কার্ট খালি"),
});

/* ---------------------------------------------------------- subscriptions */
export const subscriptionSchema = z.object({
  package_id: z.string().uuid(),
  customer_name: z.string().trim().min(2, "পুরো নাম দিন").max(80),
  phone: bdPhone,
  division: z.string().trim().min(1, "বিভাগ নির্বাচন করুন"),
  district: z.string().trim().min(1, "জেলা নির্বাচন করুন"),
  upazila: z.string().trim().min(1, "উপজেলা নির্বাচন করুন"),
  address: z.string().trim().min(8, "সম্পূর্ণ ঠিকানা লিখুন").max(400),
  members: z.coerce.number().int().min(1).max(20),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "শুরুর তারিখ দিন"),
  frequency: z.enum(["weekly", "biweekly", "monthly"]),
});

/* --------------------------------------------------------------- reviews */
export const reviewSchema = z.object({
  product_id: z.string().uuid(),
  name_bn: z.string().trim().min(2, "নাম দিন").max(60),
  location_bn: z.string().trim().max(60).optional().or(z.literal("")),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(5, "আপনার মতামত লিখুন").max(600),
});

/* ------------------------------------------------------------- marketing */
export const newsletterSchema = z.object({ email });
export const contactSchema = z.object({
  name: z.string().trim().min(2, "নাম দিন").max(80),
  email: email.optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  message: z.string().trim().min(5, "বার্তা লিখুন").max(1200),
});

/* ----------------------------------------------------------------- admin */
export const adminLoginSchema = z.object({
  email: z.string().trim().min(3, "ইমেইল দিন"),
  password: z.string().min(1, "পাসওয়ার্ড দিন"),
});

export const productSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "slug: শুধু ছোট হাতের ইংরেজি অক্ষর, সংখ্যা ও হাইফেন"),
  category_id: z.string().uuid("ক্যাটাগরি নির্বাচন করুন"),
  name_bn: z.string().trim().min(2, "বাংলা নাম দিন"),
  name_en: z.string().trim().min(2, "English name required"),
  description_bn: z.string().trim().max(2000).optional().or(z.literal("")),
  unit: z.string().trim().min(1).default("কেজি"),
  unit_en: z.string().trim().default("kg"),
  price: z.coerce.number().min(0, "দাম ০ এর কম নয়"),
  compare_price: z.coerce.number().min(0).optional().nullable(),
  stock: z.coerce.number().int().min(0),
  image: z.string().trim().optional().or(z.literal("")),
  farm_source_bn: z.string().trim().max(160).optional().or(z.literal("")),
  harvest_date: z.string().optional().or(z.literal("")),
  badge_bn: z.string().trim().max(28).optional().or(z.literal("")),
  is_featured: z.coerce.boolean().default(false),
  is_active: z.coerce.boolean().default(true),
});

export const sellerApplySchema = z.object({
  name_bn: z.string().trim().min(3, "খামার বা ব্যবসার নাম দিন").max(120),
  phone: bdPhone,
  email: email.optional().or(z.literal("")),
  nid: z.string().trim().regex(/^\d{10,17}$/, "NID নম্বর ১০–১৭ ডিজিট").optional().or(z.literal("")),
  farm_address_bn: z.string().trim().min(8, "ঠিকানা বিস্তারিত লিখুন").max(240),
  division: z.string().trim().min(2),
  district: z.string().trim().min(2),
  product_types: z.array(z.string().trim()).min(1, "কমপক্ষে একটি পণ্যের ধরন বেছে নিন").max(12),
  payout_method: z.enum(["bkash", "nagad", "bank"]).default("bkash"),
  payout_number: z.string().trim().min(6, "পেমেন্ট নম্বর দিন").max(40),
  bank_name: z.string().trim().max(80).optional().or(z.literal("")),
  bank_account: z.string().trim().max(40).optional().or(z.literal("")),
  farm_id: z.string().uuid().optional().nullable(),
});

export const sellerProductSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid("ক্যাটাগরি নির্বাচন করুন"),
  name_bn: z.string().trim().min(2, "বাংলা নাম দিন").max(120),
  name_en: z.string().trim().min(2).max(120),
  description_bn: z.string().trim().max(2000).optional().or(z.literal("")),
  unit: z.string().trim().min(1).default("কেজি"),
  unit_en: z.string().trim().default("kg"),
  price: z.coerce.number().min(1, "দাম দিন"),
  compare_price: z.coerce.number().min(0).optional().nullable(),
  stock: z.coerce.number().int().min(0),
  image: z.string().trim().optional().or(z.literal("")),
  weight_grams: z.coerce.number().int().min(0).optional().nullable(),
});

export const categorySchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(2).regex(/^[a-z0-9-]+$/, "slug: ইংরেজি অক্ষর/হাইফেন"),
  name_bn: z.string().trim().min(2, "বাংলা নাম দিন"),
  name_en: z.string().trim().min(2),
  description_bn: z.string().trim().max(400).optional().or(z.literal("")),
  icon: z.string().trim().max(8).default("🌿"),
  sort_order: z.coerce.number().int().default(0),
  is_active: z.coerce.boolean().default(true),
});

export const couponSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3)
    .max(24)
    .regex(/^[A-Z0-9]+$/, "কুপন কোড: শুধু A-Z ও 0-9"),
  type: z.enum(["percent", "fixed"]),
  value: z.coerce.number().min(0),
  min_order: z.coerce.number().min(0).default(0),
  max_discount: z.coerce.number().min(0).optional().nullable(),
  usage_limit: z.coerce.number().int().min(0).optional().nullable(),
  expires_at: z.string().optional().or(z.literal("")),
  is_active: z.coerce.boolean().default(true),
});

export const blogSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(2).regex(/^[a-z0-9-]+$/, "slug: ইংরেজি অক্ষর/হাইফেন"),
  title_bn: z.string().trim().min(4, "শিরোনাম দিন"),
  excerpt_bn: z.string().trim().max(300).optional().or(z.literal("")),
  content_bn: z.string().trim().min(20, "লেখার বিষয়বস্তু দিন"),
  cover: z.string().trim().optional().or(z.literal("")),
  author_bn: z.string().trim().default("বিশ্বাস এগ্রো টিম"),
  tag_bn: z.string().trim().default("স্বাস্থ্য টিপস"),
  read_minutes: z.coerce.number().int().min(1).max(60).default(4),
  is_active: z.coerce.boolean().default(true),
});

export const deliveryZoneSchema = z.object({
  id: z.string().uuid().optional(),
  district: z.string().trim().min(2),
  division: z.string().trim().min(2),
  scope: z.enum(["inside_dhaka", "outside_dhaka"]),
  charge: z.coerce.number().min(0),
  free_over: z.coerce.number().min(0).optional().nullable(),
  eta_days: z.string().trim().default("২-৩ দিন"),
  is_active: z.coerce.boolean().default(true),
});

export const orderStatusSchema = z.object({
  status: z.enum(["received", "packing", "shipped", "delivered", "cancelled"]),
  payment_status: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
});

export const bannerSchema = z.object({
  id: z.string().uuid().optional(),
  title_bn: z.string().trim().min(2, "শিরোনাম দিন"),
  subtitle_bn: z.string().trim().max(300).optional().or(z.literal("")),
  image: z.string().trim().optional().or(z.literal("")),
  link: z.string().trim().default("/products"),
  placement: z.string().trim().default("home_hero"),
  is_active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().default(0),
});

/** Flatten a ZodError into { field: message }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
