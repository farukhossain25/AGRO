import type { Camera, Farm, PremiumPlan, Seller } from "./types";

/* ==========================================================================
   Seed data for the premium farm/CCTV layer.
   Used as an offline fallback AND as the source for supabase/seed-premium.sql
   so a fresh database gets 5 farms + 10 cameras in one command.
   ========================================================================== */

const V = "/images/cat/vegetables.jpg";
const F = "/images/cat/fruits.jpg";
const D = "/images/cat/dairy.jpg";
const E = "/images/cat/eggs.jpg";
const FI = "/images/cat/fish.jpg";
const H = "/images/cat/honey.jpg";

/** Stable ids so cameras can reference their farm in the seed SQL. */
export const farmIds = {
  savarGreens: "a1000000-0000-4000-8000-000000000001",
  tangailDairy: "a1000000-0000-4000-8000-000000000002",
  gazipurPoultry: "a1000000-0000-4000-8000-000000000003",
  khulnaShrimp: "a1000000-0000-4000-8000-000000000004",
  rajshahiMango: "a1000000-0000-4000-8000-000000000005",
} as const;

export const seedFarms: Farm[] = [
  {
    id: farmIds.savarGreens,
    slug: "savar-greens",
    name_bn: "সাভার গ্রিনস খামার",
    name_en: "Savar Greens Farm",
    type: "vegetables",
    owner_user_id: null,
    owner_name_bn: "মোঃ রহিম উদ্দিন",
    owner_phone: "01711000001",
    owner_photo: V,
    owner_bio_bn:
      "তিন প্রজন্ম ধরে সাভারে শাক চাষ করছেন রহিম ভাই। ১২ বিঘা জমিতে গোবর সার আর জৈব বালাইনাশ ব্যবহার করেন। প্রতিদিন ভোর ৫টায় সবজি তোলা হয়।",
    division: "ঢাকা",
    district: "ঢাকা",
    upazila: "সাভার",
    address_bn: "বাগবাড়ি, সাভার, ঢাকা ১৩৪০",
    lat: 23.8384,
    lng: 90.2639,
    boundary: [
      [90.2618, 23.8372],
      [90.2658, 23.8374],
      [90.2661, 23.8398],
      [90.2620, 23.8396],
      [90.2618, 23.8372],
    ],
    harvest_calendar: [
      { month: "অগ্রহায়ণ", crops: ["পালং শাক", "লাল শাক", "মুলা"] },
      { month: "পৌষ", crops: ["ফুলকপি", "বাঁধাকপি", "গাজর"] },
      { month: "মাঘ", crops: ["টমেটো", "ঢেঁড়স"] },
      { month: "ফাল্গুন", crops: ["করলা", "পটল", "বেগুন"] },
    ],
    description_bn:
      "সাভারের ১২ বিঘার জৈব সবজি খামার। প্রতিটি সবজি তোলার পর হাতে বাছাই করে বাঁশের ঝুড়িতে প্যাক করা হয়। কোনো কৃত্রিম রিপেনিং বা কীটনাশক ব্যবহার করা হয় না।",
    story_bn:
      "২০১১ সালে ২ বিঘা জমি দিয়ে শুরু। এখন ৩৫ জন কৃষক পরিবার একসাথে কাজ করেন। খামারের পাশেই ছোট প্যাকিং শেড যেখানে প্রতিদিন সকালে সবজি ধোয়া ও বাছাই হয়।",
    cover: V,
    images: [V, "/images/hero/farm.jpg"],
    daily_output: {
      note_bn: "প্রতিদিন গড়ে ৩২০ কেজি সবজি সংগ্রহ",
      updated_at: new Date().toISOString(),
    },
    established_year: 2011,
    certifications: ["জৈব সার সনদ", "বারবি রেসিডিউ টেস্ট ফ্রি"],
    is_active: true,
    is_premium: true,
    sort_order: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: farmIds.tangailDairy,
    slug: "tangail-dairy",
    name_bn: "টাঙ্গাইল ডেইরি ফার্ম",
    name_en: "Tangail Dairy Farm",
    type: "dairy",
    owner_user_id: null,
    owner_name_bn: "আব্দুল করিম মিয়া",
    owner_phone: "01711000002",
    owner_photo: D,
    owner_bio_bn:
      "৪০টি দেশি গাভী নিয়ে ডেইরি চালান করিম মিয়া। কোনো বুস্টার বা হরমোন ব্যবহার করেন না। প্রতিদিন সকালের দুধ দুপুরের মধ্যে কোল্ড চেইনে পৌঁছে যায়।",
    division: "ঢাকা",
    district: "টাঙ্গাইল",
    upazila: "সদর",
    address_bn: "কলিয়া, টাঙ্গাইল সদর, টাঙ্গাইল ১৯০০",
    lat: 24.2513,
    lng: 89.9167,
    boundary: [
      [89.9142, 24.2498],
      [89.9192, 24.2501],
      [89.9195, 24.2529],
      [89.9145, 24.2526],
      [89.9142, 24.2498],
    ],
    harvest_calendar: [
      { month: "সারা বছর", crops: ["গরুর দুধ", "ঘি", "ছানা", "দই"] },
    ],
    description_bn:
      "৪০টি দেশি ও শাহীওয়াল সংকর গাভীর ডেইরি। প্রতিটি গাভীর দুধ আলাদাভাবে পরীক্ষা করা হয় — ফ্যাট, ঘনত্ব ও অ্যান্টিবায়োটিক রেসিডিউ।",
    story_bn:
      "২০১৫ সালে ৬টি গাভী দিয়ে শুরু। এখন প্রতিদিন ৪২০ লিটার দুধ, যার সবটাই বিশ্বাস এগ্রোর কোল্ড চেইনে যায়। গোয়ালঘরে ২৪ ঘণ্টা CCTV — গ্রাহক নিজেই দেখতে পারেন গাভী কীভাবে খেতে ও দোহন হচ্ছে।",
    cover: D,
    images: [D, "/images/cat/dairy.jpg"],
    daily_output: {
      cows: 40,
      litres_today: 418,
      litres_week: 2916,
      sold_today: 402,
      updated_at: new Date().toISOString(),
      note_bn: "ভোর ৪:৩০ ও বিকাল ৪:০০ — দিনে দুইবার দোহন",
    },
    established_year: 2015,
    certifications: ["লাইভস্টক ডিপার্টমেন্ট নিবন্ধিত", "অ্যান্টিবায়োটিক ফ্রি"],
    is_active: true,
    is_premium: true,
    sort_order: 2,
    created_at: new Date().toISOString(),
  },
  {
    id: farmIds.gazipurPoultry,
    slug: "gazipur-poultry",
    name_bn: "গাজীপুর পোল্ট্রি খামার",
    name_en: "Gazipur Poultry Farm",
    type: "poultry",
    owner_user_id: null,
    owner_name_bn: "সালমা বেগম",
    owner_phone: "01711000003",
    owner_photo: E,
    owner_bio_bn:
      "নারী উদ্যোক্তা সালমা বেগমের নেতৃত্বে ৮টি শেডে দেশি মুরগি পালন হয়। মুক্ত চারণে বেড়ে ওঠা মুরগির ডিম প্রতিদিন সকালে সংগ্রহ করা হয়।",
    division: "ঢাকা",
    district: "গাজীপুর",
    upazila: "শ্রীপুর",
    address_bn: "বরমী, শ্রীপুর, গাজীপুর ১৭৪৪",
    lat: 24.1667,
    lng: 90.4167,
    boundary: [
      [90.4142, 24.1652],
      [90.4192, 24.1655],
      [90.4195, 24.1682],
      [90.4145, 24.1679],
      [90.4142, 24.1652],
    ],
    harvest_calendar: [
      { month: "সারা বছর", crops: ["দেশি ডিম", "হাঁসের ডিম", "দেশি মুরগি"] },
    ],
    description_bn:
      "৮টি শেডে প্রায় ৩,২০০ দেশি মুরগি। মুক্ত চারণে ঘাস, পোকা ও ভুট্টা খেয়ে বেড়ে ওঠে — তাই কুসুম গাঢ় কমলা।",
    story_bn:
      "সালমা বেগম ২০১৮ সালে ২০০ মুরগি দিয়ে শুরু করেন। এখন ২২ জন মহিলা কর্মী কাজ করেন। প্রতিটি ডিম সংগ্রহ করে হাতে বাছাই করা হয়, ফাটা বা নোংরা ডিম কখনো প্যাক হয় না।",
    cover: E,
    images: [E],
    daily_output: {
      note_bn: "প্রতিদিন গড়ে ২,৮০০ ডিম সংগ্রহ",
      updated_at: new Date().toISOString(),
    },
    established_year: 2018,
    certifications: ["মুক্ত চারণ সনদ", "ডিম কোয়ালিটি গ্রেড এ"],
    is_active: true,
    is_premium: true,
    sort_order: 3,
    created_at: new Date().toISOString(),
  },
  {
    id: farmIds.khulnaShrimp,
    slug: "khulna-shrimp",
    name_bn: "খুলনা বাগদা চিংড়ি ঘের",
    name_en: "Khulna Bagda Shrimp Gher",
    type: "fish",
    owner_user_id: null,
    owner_name_bn: "মোঃ জাহাঙ্গীর হোসেন",
    owner_phone: "01711000004",
    owner_photo: FI,
    owner_bio_bn:
      "খুলনার লবণাক্ত পানির ঘেরে বাগদা চিংড়ি চাষ করেন জাহাঙ্গীর। প্রাকৃতিক খাদ্য ছাড়া কোনো ফিড বা কেমিক্যাল ব্যবহার নেই।",
    division: "খুলনা",
    district: "খুলনা",
    upazila: "বটিয়াঘাটা",
    address_bn: "সুরখালী, বটিয়াঘাটা, খুলনা ৯২৬০",
    lat: 22.7,
    lng: 89.55,
    boundary: [
      [89.5472, 22.6982],
      [89.5532, 22.6986],
      [89.5536, 22.7022],
      [89.5476, 22.7018],
      [89.5472, 22.6982],
    ],
    harvest_calendar: [
      { month: "চৈত্র", crops: ["বাগদা পোনা ছাড়া"] },
      { month: "ভাদ্র", crops: ["বাগদা চিংড়ি সংগ্রহ", "গলদা"] },
    ],
    description_bn:
      "৬ একরের ঘের, লবণাক্ত পানির প্রাকৃতিক প্রবাহ। ইলিশ-চিংড়ি বিক্রি হয় সকালে ধরার পর পরই — আইস প্যাকে ২ ঘণ্টার মধ্যে।",
    story_bn:
      "তিন প্রজন্মের জেলে পরিবার। এখন ঘেরে CCTV বসানো হয়েছে যাতে গ্রাহক দেখতে পারেন যে পানির মান ও চিংড়ি কেমন আছে, এবং জাল তোলার সময় নিজে দেখে নিতে পারেন।",
    cover: FI,
    images: [FI],
    daily_output: {
      note_bn: "প্রতিদিন গড়ে ১৫ কেজি চিংড়ি ও ৪০ কেজি মাছ",
      updated_at: new Date().toISOString(),
    },
    established_year: 2009,
    certifications: ["রপ্তানি মান যাচাই", "কোনো ফিড নেই"],
    is_active: true,
    is_premium: true,
    sort_order: 4,
    created_at: new Date().toISOString(),
  },
  {
    id: farmIds.rajshahiMango,
    slug: "rajshahi-mango",
    name_bn: "রাজশাহী আম বাগান",
    name_en: "Rajshahi Mango Orchard",
    type: "fruits",
    owner_user_id: null,
    owner_name_bn: "ফাতেমা বেগম",
    owner_phone: "01711000005",
    owner_photo: F,
    owner_bio_bn:
      "রাজশাহীর ২২ বিঘার আম বাগান, সাতটি জাত। কার্বাইড ছাড়া প্রাকৃতিকভাবে পাকানো হয়।",
    division: "রাজশাহী",
    district: "রাজশাহী",
    upazila: "চারঘাট",
    address_bn: "পবা, রাজশাহী ৬২১০",
    lat: 24.3745,
    lng: 88.6042,
    boundary: [
      [88.6012, 24.3728],
      [88.6078, 24.3732],
      [88.6082, 24.3766],
      [88.6016, 24.3762],
      [88.6012, 24.3728],
    ],
    harvest_calendar: [
      { month: "বৈশাখ", crops: ["গোপালভোগ", "হিমসাগর"] },
      { month: "জ্যৈষ্ঠ", crops: ["ল্যাংড়া", "ক্ষীরশাপাতি"] },
      { month: "আষাঢ়", crops: ["আম্রপালি", "ফজলি"] },
    ],
    description_bn:
      "২২ বিঘার বাগানে ৩৫০টির বেশি আম গাছ। বাঁশের ঝুড়িতে খড় বিছিয়ে প্যাক করা হয়, বিছানায় রেখে ২–৩ দিনে নিজে থেকে পাকে।",
    story_bn:
      "ফাতেমা বেগম ৩৫ জন কৃষক পরিবারের সমবায় চালান। আলুর জন্য বিখ্যাত হলেও এখন আমই প্রধান আয়ের উৎস — সারা বছর সাতটি জাত ধাপে ধাপে সংগ্রহ করা হয়।",
    cover: F,
    images: [F, H],
    daily_output: {
      note_bn: "মৌসুমে প্রতিদিন ১.২ টন আম সংগ্রহ",
      updated_at: new Date().toISOString(),
    },
    established_year: 2004,
    certifications: ["সমবায় নিবন্ধিত", "কার্বাইড ফ্রি"],
    is_active: true,
    is_premium: true,
    sort_order: 5,
    created_at: new Date().toISOString(),
  },
];

/* ------------------------------------------------------------------ cameras */

/** Camera plus its private MediaMTX path name — never sent to the browser. */
export type SeedCamera = Camera & { stream_key: string };

function cam(
  id: string,
  farmId: string,
  name_bn: string,
  zone_bn: string,
  streamKey: string,
  lat: number,
  lng: number,
  status: Camera["status"] = "online",
  order = 1
): SeedCamera {
  return {
    id,
    stream_key: streamKey,
    farm_id: farmId,
    name_bn,
    zone_bn,
    protocol: "hls",
    poster: null,
    location_lat: lat,
    location_lng: lng,
    status,
    last_heartbeat: new Date().toISOString(),
    is_active: true,
    is_premium: true,
    max_viewers: 50,
    sort_order: order,
  };
}

export const seedCameras: Record<string, SeedCamera[]> = {
  [farmIds.savarGreens]: [
    cam("b1000000-0000-4000-8000-000000000001", farmIds.savarGreens, "মূল জমি — উত্তর দিক", "জমি", "savar-greens-field-01", 23.8389, 90.2636, "online", 1),
    cam("b1000000-0000-4000-8000-000000000002", farmIds.savarGreens, "শাক বেড়ানোর জমি", "জমি", "savar-greens-field-02", 23.8379, 90.2651, "online", 2),
    cam("b1000000-0000-4000-8000-000000000003", farmIds.savarGreens, "প্যাকিং শেড", "প্যাকিং", "savar-greens-packing-01", 23.8393, 90.2657, "online", 3),
  ],
  [farmIds.tangailDairy]: [
    cam("b1000000-0000-4000-8000-000000000004", farmIds.tangailDairy, "গোয়ালঘর — দোহন এলাকা", "গোয়ালঘর", "tangail-dairy-milking-01", 24.2516, 89.9169, "online", 1),
    cam("b1000000-0000-4000-8000-000000000005", farmIds.tangailDairy, "গাভীর খাবার ঘর", "গোয়ালঘর", "tangail-dairy-feed-01", 24.2509, 89.9181, "online", 2),
    cam("b1000000-0000-4000-8000-000000000006", farmIds.tangailDairy, "দুধ রাখার কোল্ড রুম", "গুদাম", "tangail-dairy-coldroom-01", 24.2523, 89.9152, "offline", 3),
  ],
  [farmIds.gazipurPoultry]: [
    cam("b1000000-0000-4000-8000-000000000007", farmIds.gazipurPoultry, "শেড ১ — দেশি মুরগি", "মুরগিঘর", "gazipur-poultry-shed-01", 24.1664, 90.4158, "online", 1),
    cam("b1000000-0000-4000-8000-000000000008", farmIds.gazipurPoultry, "ডিম বাছাই ঘর", "প্যাকিং", "gazipur-poultry-egg-01", 24.1672, 90.4176, "online", 2),
  ],
  [farmIds.khulnaShrimp]: [
    cam("b1000000-0000-4000-8000-000000000009", farmIds.khulnaShrimp, "বাগদা ঘের — প্রধান পুকুর", "পুকুর", "khulna-shrimp-pond-01", 22.7004, 89.5501, "online", 1),
  ],
  [farmIds.rajshahiMango]: [
    cam("b1000000-0000-4000-8000-000000000010", farmIds.rajshahiMango, "আম বাগান — মাঝের সারি", "জমি", "rajshahi-mango-orchard-01", 24.3747, 88.6046, "online", 1),
  ],
};

export const allSeedCameras: SeedCamera[] = Object.values(seedCameras).flat();

/* ------------------------------------------------------------- plans */

export const seedPremiumPlans: PremiumPlan[] = [
  {
    id: "c1000000-0000-4000-8000-000000000001",
    slug: "basic-monthly",
    name_bn: "বেসিক — মাসিক",
    name_en: "Basic Monthly",
    tier: "basic",
    interval: "monthly",
    price: 149,
    compare_price: 199,
    duration_days: 30,
    max_devices: 1,
    features: [
      "৩টি খামারের লাইভ ক্যামেরা",
      "২ডি ম্যাপ ও খামারের তথ্য",
      "১০ মিনিট ফ্রি ট্রায়ালের পর",
      "১টি ডিভাইস",
    ],
    is_active: true,
    is_popular: false,
    sort_order: 1,
  },
  {
    id: "c1000000-0000-4000-8000-000000000002",
    slug: "full-monthly",
    name_bn: "ফুল অ্যাক্সেস — মাসিক",
    name_en: "Full Access Monthly",
    tier: "full",
    interval: "monthly",
    price: 299,
    compare_price: 399,
    duration_days: 30,
    max_devices: 2,
    features: [
      "সব খামারের সব ক্যামেরা",
      "দুধ উৎপাদন লাইভ",
      "৩ডি টেরেইন ম্যাপ",
      "অর্ডারের খামার-সোর্স ট্রেসেবিলিটি",
      "২টি ডিভাইস",
    ],
    is_active: true,
    is_popular: true,
    sort_order: 2,
  },
  {
    id: "c1000000-0000-4000-8000-000000000003",
    slug: "full-half-yearly",
    name_bn: "ফুল অ্যাক্সেস — ষান্মাসিক",
    name_en: "Full Access Half-Yearly",
    tier: "full",
    interval: "half_yearly",
    price: 1599,
    compare_price: 1794,
    duration_days: 182,
    max_devices: 2,
    features: [
      "৬ মাসের ফুল অ্যাক্সেস",
      "মাসিক ২৬৬৳ — ১১% সাশ্রয়",
      "সব ক্যামেরা + ৩ডি ম্যাপ",
      "২টি ডিভাইস",
    ],
    is_active: true,
    is_popular: false,
    sort_order: 3,
  },
  {
    id: "c1000000-0000-4000-8000-000000000004",
    slug: "full-yearly",
    name_bn: "ফুল অ্যাক্সেস — বাৎসরিক",
    name_en: "Full Access Yearly",
    tier: "full",
    interval: "yearly",
    price: 2899,
    compare_price: 3588,
    duration_days: 365,
    max_devices: 3,
    features: [
      "১২ মাসের ফুল অ্যাক্সেস",
      "মাসিক ২৪১৳ — ১৯% সাশ্রয়",
      "সব ক্যামেরা + ৩ডি ম্যাপ + দুধ লাইভ",
      "৩টি ডিভাইস",
      "অগ্রাধিকার সাপোর্ট",
    ],
    is_active: true,
    is_popular: false,
    sort_order: 4,
  },
];


/* ------------------------------------------------------------- sellers */

/** Approved demo sellers so the marketplace has real content on day one. */
export const seedSellers: Array<Seller & { product_types: string[]; farm_photos: string[] }> = [
  {
    id: "d1000000-0000-4000-8000-000000000001",
    user_id: null,
    slug: "savar-greens",
    farm_id: farmIds.savarGreens,
    name_bn: "সাভার গ্রিনস খামার",
    phone: "01711000001",
    email: "savar@bishwasagro.com",
    nid: null,
    farm_address_bn: "বাগবাড়ি, সাভার, ঢাকা ১৩৪০",
    division: "ঢাকা",
    district: "ঢাকা",
    product_types: ["vegetables", "fruits"],
    farm_photos: ["/images/cat/vegetables.jpg", "/images/hero/farm.jpg"],
    payout_method: "bkash",
    payout_number: "01711000001",
    bank_name: null,
    bank_account: null,
    commission_percent: 10,
    status: "approved",
    rejection_reason: null,
    approved_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: "d1000000-0000-4000-8000-000000000002",
    user_id: null,
    slug: "tangail-dairy-store",
    farm_id: farmIds.tangailDairy,
    name_bn: "টাঙ্গাইল ডেইরি",
    phone: "01711000002",
    email: "dairy@bishwasagro.com",
    nid: null,
    farm_address_bn: "কলিয়া, টাঙ্গাইল সদর, টাঙ্গাইল ১৯০০",
    division: "ঢাকা",
    district: "টাঙ্গাইল",
    product_types: ["dairy"],
    farm_photos: ["/images/cat/dairy.jpg"],
    payout_method: "bkash",
    payout_number: "01711000002",
    bank_name: null,
    bank_account: null,
    commission_percent: 10,
    status: "approved",
    rejection_reason: null,
    approved_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: "d1000000-0000-4000-8000-000000000003",
    user_id: null,
    slug: "rajshahi-mango-house",
    farm_id: farmIds.rajshahiMango,
    name_bn: "রাজশাহী আম হাউস",
    phone: "01711000005",
    email: "mango@bishwasagro.com",
    nid: null,
    farm_address_bn: "পবা, রাজশাহী ৬২১০",
    division: "রাজশাহী",
    district: "রাজশাহী",
    product_types: ["fruits", "honey"],
    farm_photos: ["/images/cat/fruits.jpg"],
    payout_method: "nagad",
    payout_number: "01711000005",
    bank_name: null,
    bank_account: null,
    commission_percent: 12,
    status: "approved",
    rejection_reason: null,
    approved_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
];
