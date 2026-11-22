/**
 * Seed catalogue for বিশ্বাস এগ্রো.
 * Kept in JS (not SQL) so it can be re-run idempotently by scripts/seed.mjs,
 * and so the same objects power local fallbacks in the UI.
 */

export const seedCategories = [
  {
    slug: "shakshobji",
    name_bn: "তাজা শাকসবজি",
    name_en: "Fresh Vegetables",
    description_bn: "প্রতিদিন ভোরে খামার থেকে তোলা কচি শাক, সবজি ও কাঁচা মরিচ।",
    icon: "🥬",
    image: "/images/cat/vegetables.jpg",
    sort_order: 1,
  },
  {
    slug: "folmul",
    name_bn: "ফলমূল",
    name_en: "Fruits",
    description_bn: "মৌসুমি দেশি ফলের সেরা সংগ্রহ — আম, লিচু, কলা, পেয়ারা।",
    icon: "🥭",
    image: "/images/cat/fruits.jpg",
    sort_order: 2,
  },
  {
    slug: "deshi-dim",
    name_bn: "দেশি ডিম",
    name_en: "Eggs",
    description_bn: "মুক্ত চারণে বেড়ে ওঠা মুরগির দেশি ডিম ও হাঁসের ডিম।",
    icon: "🥚",
    image: "/images/cat/eggs.jpg",
    sort_order: 3,
  },
  {
    slug: "mangsho",
    name_bn: "মাংস ও পোল্ট্রি",
    name_en: "Meat & Poultry",
    description_bn: "গরু, ছাগল ও মুরগির টাটকা মাংস — হালাল ও ফ্রেশ কাট।",
    icon: "🥩",
    image: "/images/cat/meat.jpg",
    sort_order: 4,
  },
  {
    slug: "mach",
    name_bn: "মাছ",
    name_en: "Fish",
    description_bn: "পদ্মার টাটকা মাছ, চিংড়ি ও সামুদ্রিক মাছ — বরফে সংরক্ষিত।",
    icon: "🐟",
    image: "/images/cat/fish.jpg",
    sort_order: 5,
  },
  {
    slug: "dudh-dudhgiyo",
    name_bn: "দুধ ও দুগ্ধজাত পণ্য",
    name_en: "Milk & Dairy",
    description_bn: "খাঁটি গরুর দুধ, ঘি, মাখন, ছানা ও দই।",
    icon: "🥛",
    image: "/images/cat/dairy.jpg",
    sort_order: 6,
  },
  {
    slug: "chal-dal-mosla",
    name_bn: "চাল, ডাল, তেল ও মসলা",
    name_en: "Rice, Lentils, Oil & Spices",
    description_bn: "মিনিকেট চাল, দেশি ডাল, সরিষার তেল ও খাঁটি মসলা।",
    icon: "🌾",
    image: "/images/cat/staples.jpg",
    sort_order: 7,
  },
  {
    slug: "modhu-organic",
    name_bn: "মধু ও অর্গানিক পণ্য",
    name_en: "Honey & Organic",
    description_bn: "সুন্দরবনের খাঁটি মধু, অর্গানিক ঘি ও প্রাকৃতিক উপাদান।",
    icon: "🍯",
    image: "/images/cat/honey.jpg",
    sort_order: 8,
  },
  {
    slug: "krishi-upokoron",
    name_bn: "কৃষি উপকরণ",
    name_en: "Agri Inputs",
    description_bn: "বীজ, জৈব সার ও বাগান পরিচর্যার সরঞ্জাম।",
    icon: "🌱",
    image: "/images/cat/agri.jpg",
    sort_order: 9,
  },
];

const V = "/images/cat/vegetables.jpg";
const F = "/images/cat/fruits.jpg";
const E = "/images/cat/eggs.jpg";
const M = "/images/cat/meat.jpg";
const FI = "/images/cat/fish.jpg";
const D = "/images/cat/dairy.jpg";
const S = "/images/cat/staples.jpg";
const H = "/images/cat/honey.jpg";
const A = "/images/cat/agri.jpg";

/** [slug, categorySlug, name_bn, name_en, unit, price, compare, stock, image, badge, farm, featured, desc] */
const P = (p) => p;

export const seedProducts = [
  // ── তাজা শাকসবজি
  P({ slug: "palong-shak", cat: "shakshobji", name_bn: "পালং শাক", name_en: "Spinach Bundle", unit: "আঁটি", price: 25, compare_price: 30, stock: 120, image: V, badge_bn: "সকালে তোলা", farm: "সাভার, ঢাকা", featured: true,
    desc: "ভোর ৫টায় সাভারের মাঠ থেকে তোলা কচি পালং শাক। আঁশ ও লোহার ভালো উৎস, রক্তশূন্যতায় উপকারী।" }),
  P({ slug: "lal-shak", cat: "shakshobji", name_bn: "লাল শাক", name_en: "Red Amaranth", unit: "আঁটি", price: 30, compare_price: 35, stock: 90, image: V, badge_bn: null, farm: "মধুপুর, টাঙ্গাইল", featured: false,
    desc: "লাল শাক ভিটামিন এ, সি ও লৌহে সমৃদ্ধ। প্রতিদিনের বাড়ির রান্নার জন্য টাটকা আঁটি।" }),
  P({ slug: "korola", cat: "shakshobji", name_bn: "করলা", name_en: "Bitter Gourd", unit: "কেজি", price: 80, compare_price: 95, stock: 45, image: V, badge_bn: "অর্গানিক", farm: "গাজীপুর সদর", featured: false,
    desc: "রক্তে সুগারের মাত্রা নিয়ন্ত্রণে সহায়ক করলা। ছোট, কচি ও কাঁচের মতো সবুজ।" }),
  P({ slug: "potol", cat: "shakshobji", name_bn: "পটল", name_en: "Pointed Gourd", unit: "কেজি", price: 60, compare_price: 70, stock: 60, image: V, badge_bn: null, farm: "যশোর সদর", featured: false,
    desc: "হালকা সবুজ-সাদা ডোরাকাটা পটল, ভাজি ও ঝোলের জন্য আদর্শ।" }),
  P({ slug: "dherosh", cat: "shakshobji", name_bn: "ঢেঁড়স", name_en: "Okra", unit: "কেজি", price: 65, compare_price: 75, stock: 55, image: V, badge_bn: null, farm: "নরসিংদী সদর", featured: false,
    desc: "কচি ঢেঁড়স, ভেতরে নরম বিচি — ভুনা ও ভাজি দুইয়ের জন্যই সেরা।" }),
  P({ slug: "begun", cat: "shakshobji", name_bn: "বেগুন", name_en: "Brinjal (Eggplant)", unit: "কেজি", price: 55, compare_price: 65, stock: 80, image: V, badge_bn: "তাজা", farm: "যশোর সদর", featured: true,
    desc: "চিকন বেগুন ও গোল বেগুনের মিশ্রণ। ফুলকপির মতো ভেতরে নরম, ভর্তায় দুর্দান্ত।" }),
  P({ slug: "tokori", cat: "shakshobji", name_bn: "কাঁচা মরিচ", name_en: "Green Chilli", unit: "১০০ গ্রাম", price: 15, compare_price: 20, stock: 200, image: V, badge_bn: null, farm: "সাভার, ঢাকা", featured: false,
    desc: "ঝাঁঝালো কাঁচা মরিচ — বাজারের থেকে তাজা ও পরিষ্কার।" }),
  P({ slug: "kacha-tomato", cat: "shakshobji", name_bn: "টমেটো", name_en: "Tomato", unit: "কেজি", price: 70, compare_price: 85, stock: 0, image: V, badge_bn: "শেষ হচ্ছে", farm: "রাজশাহী সদর", featured: false,
    desc: "পাকা টমেটো, সালাদ ও সসের জন্য। রসালো ও মিষ্টি স্বাদ।" }),
  P({ slug: "kumra", cat: "shakshobji", name_bn: "মিষ্টি কুমড়া", name_en: "Sweet Pumpkin", unit: "কেজি", price: 40, compare_price: null, stock: 35, image: V, badge_bn: null, farm: "মুন্সিগঞ্জ সদর", featured: false,
    desc: "মিষ্টি স্বাদের দেশি কুমড়া — ভর্তা, চচ্চড়ি ও পায়েসে দুর্দান্ত।" }),
  P({ slug: "mula", cat: "shakshobji", name_bn: "মূলা", name_en: "Radish", unit: "কেজি", price: 35, compare_price: 45, stock: 70, image: V, badge_bn: null, farm: "শ্রীপুর, গাজীপুর", featured: false,
    desc: "শীতের কচি মূলা, ঝালি-সালাদের জন্য নরম ও রসালো।" }),
  P({ slug: "fulkopi", cat: "shakshobji", name_bn: "ফুলকপি", name_en: "Cauliflower", unit: "পিস", price: 50, compare_price: 60, stock: 40, image: V, badge_bn: null, farm: "যশোর সদর", featured: false,
    desc: "সাদা ফুলকপি, ঘরে তুলে আনা — তরকারি ও রোস্টের জন্য সেরা।" }),
  P({ slug: "bashor-alu", cat: "shakshobji", name_bn: "আলু", name_en: "Potato", unit: "কেজি", price: 30, compare_price: 35, stock: 300, image: V, badge_bn: null, farm: "মুন্সিগঞ্জ সদর", featured: false,
    desc: "দেশি জাতের আলু — রান্নায় মিষ্টি স্বাদ ও কম ভাঙে।" }),

  // ── ফলমূল
  P({ slug: "himsagar-aam", cat: "folmul", name_bn: "হিমসাগর আম", name_en: "Himsagar Mango", unit: "কেজি", price: 120, compare_price: 150, stock: 60, image: F, badge_bn: "মৌসুমি", farm: "সাতক্ষীরা সদর", featured: true,
    desc: "চাঁপাইনবাবগঞ্জ-সাতক্ষীরার বিখ্যাত হিমসাগর আম — আঁশহীন, মিষ্টি ও সুগন্ধি। বিছানায় রেখে ২ দিন পাক করুন।" }),
  P({ slug: "litchu", cat: "folmul", name_bn: "লিচু", name_en: "Litchi", unit: "১০০ পিস", price: 180, compare_price: 220, stock: 25, image: F, badge_bn: "সীমিত", farm: "দিনাজপুর সদর", featured: true,
    desc: "দিনাজপুরের রসালো লিচু — ছোট বিচি, পাতলা খোসা, অত্যন্ত মিষ্টি।" }),
  P({ slug: "deshi-kola", cat: "folmul", name_bn: "সবরি দেশি কলা", name_en: "Sabri Banana", unit: "ডজন", price: 60, compare_price: 75, stock: 90, image: F, badge_bn: null, farm: "যশোর সদর", featured: false,
    desc: "দেশি সবরি কলা — প্রাকৃতিকভাবে সিরা, কোনো রাসায়নিক ক্যালসিয়াম কার্বাইড নয়।" }),
  P({ slug: "peyara", cat: "folmul", name_bn: "পেয়ারা", name_en: "Guava", unit: "কেজি", price: 90, compare_price: 110, stock: 45, image: F, badge_bn: null, farm: "বরিশাল সদর", featured: false,
    desc: "ভিটামিন সি সমৃদ্ধ রসালো পেয়ারা, খেতে মিষ্টি ও সুগন্ধি।" }),
  P({ slug: "papaya", cat: "folmul", name_bn: "পেঁপে", name_en: "Papaya", unit: "কেজি", price: 45, compare_price: 55, stock: 50, image: F, badge_bn: null, farm: "গাজীপুর সদর", featured: false,
    desc: "হলুদ-লাল শাঁসের পাকা পেঁপে — হজমে সহায়ক ও স্কিনের জন্য ভালো।" }),
  P({ slug: "anarosh", cat: "folmul", name_bn: "আনারস", name_en: "Pineapple", unit: "পিস", price: 80, compare_price: 95, stock: 30, image: F, badge_bn: null, farm: "মধুপুর, টাঙ্গাইল", featured: false,
    desc: "মধুপুরের জাম্বুরা-মিষ্টি আনারস, সুবাসে ভরপুর।" }),

  // ── দেশি ডিম
  P({ slug: "deshi-murgir-dim", cat: "deshi-dim", name_bn: "দেশি মুরগির ডিম", name_en: "Free-range Country Eggs", unit: "ডজন", price: 180, compare_price: 200, stock: 100, image: E, badge_bn: "বেস্ট সেলার", farm: "টাঙ্গাইল সদর", featured: true,
    desc: "মুক্ত চারণে বেড়ে ওঠা মুরগির ডিম — গাঢ় কমলা কুসুম, ঘন শাঁস, দুর্গন্ধহীন।" }),
  P({ slug: "hasher-dim", cat: "deshi-dim", name_bn: "হাঁসের ডিম", name_en: "Duck Eggs", unit: "ডজন", price: 210, compare_price: 230, stock: 55, image: E, badge_bn: null, farm: "বরিশাল সদর", featured: false,
    desc: "বড় আকারের হাঁসের ডিম — কেক, পিঠা ও নাস্তায় দুর্দান্ত।" }),
  P({ slug: "broiler-dim", cat: "deshi-dim", name_bn: "ফার্মের ডিম", name_en: "Farm Eggs", unit: "ডজন", price: 130, compare_price: 145, stock: 200, image: E, badge_bn: null, farm: "গাজীপুর সদর", featured: false,
    desc: "দৈনন্দিন রান্নার জন্য সাশ্রয়ী ফার্ম ডিম, প্রতিদিন তাজা সংগ্রহ।" }),
  P({ slug: "koli-dim", cat: "deshi-dim", name_bn: "কোলি মুরগির ডিম", name_en: "Quail Eggs", unit: "৩০ পিস", price: 120, compare_price: 140, stock: 40, image: E, badge_bn: "নতুন", farm: "নরসিংদী সদর", featured: false,
    desc: "ছোট কিন্তু পুষ্টিগুণে ভরপুর কোয়েল (কোলি) ডিম।" }),

  // ── মাংস ও পোল্ট্রি
  P({ slug: "deshi-murgi-full", cat: "mangsho", name_bn: "দেশি মুরগি (কাটা)", name_en: "Country Chicken (cut)", unit: "কেজি", price: 520, compare_price: 560, stock: 20, image: M, badge_bn: "হালাল", farm: "কিশোরগঞ্জ সদর", featured: true,
    desc: "দেশি জাতের মুরগি, অর্ডার পাওয়ার পর জবাই করে কাটা হয়। কোনো অ্যান্টিবায়োটিক নেই।" }),
  P({ slug: "broiler-murgi", cat: "mangsho", name_bn: "ব্রয়লার মুরগি (কাটা)", name_en: "Broiler Chicken (cut)", unit: "কেজি", price: 190, compare_price: 210, stock: 35, image: M, badge_bn: null, farm: "গাজীপুর সদর", featured: false,
    desc: "টাটকা ব্রয়লার মাংস, পরিষ্কার কাটা ও আইস প্যাকে ডেলিভারি।" }),
  P({ slug: "gorur-mangsho", cat: "mangsho", name_bn: "গরুর মাংস (বোনলেস)", name_en: "Beef Boneless", unit: "কেজি", price: 820, compare_price: 880, stock: 15, image: M, badge_bn: "প্রিমিয়াম", farm: "সিরাজগঞ্জ সদর", featured: true,
    desc: "দেশি গরুর বোনলেস মাংস, মাংসের রঙ লাল ও চর্বি কম। ২ কেজি অর্ডারে ফ্রি হাড়।" }),
  P({ slug: "chagol-mangsho", cat: "mangsho", name_bn: "খাসির মাংস", name_en: "Mutton (Goat)", unit: "কেজি", price: 1150, compare_price: 1250, stock: 10, image: M, badge_bn: "হালাল", farm: "রাজবাড়ী সদর", featured: false,
    desc: "ছোট খাসির মাংস — নরম, কম গন্ধ, কোরবানির মতো স্বাদ সারা বছর।" }),
  P({ slug: "murgir-buk", cat: "mangsho", name_bn: "মুরগির বুকের মাংস", name_en: "Chicken Breast", unit: "৫০০ গ্রাম", price: 240, compare_price: 270, stock: 25, image: M, badge_bn: null, farm: "গাজীপুর সদর", featured: false,
    desc: "চর্বিহীন বুকের মাংস — জিম ও প্রোটিন ডায়েটের জন্য আদর্শ।" }),

  // ── মাছ
  P({ slug: "rui-mach", cat: "mach", name_bn: "রুই মাছ", name_en: "Rohu Fish", unit: "কেজি", price: 320, compare_price: 360, stock: 25, image: FI, badge_bn: "পদ্মার", farm: "চাঁদপুর সদর", featured: true,
    desc: "পদ্মার টাটকা রুই মাছ, পরিষ্কার করে কেটে আইস প্যাকে ডেলিভারি।" }),
  P({ slug: "ilish", cat: "mach", name_bn: "ইলিশ মাছ", name_en: "Hilsa Fish", unit: "কেজি", price: 1450, compare_price: 1600, stock: 8, image: FI, badge_bn: "মৌসুমি", farm: "ভোলা সদর", featured: true,
    desc: "পদ্মা-মেঘনার ইলিশ — ৮০০ গ্রাম+ সাইজ, বরফে সংরক্ষিত, সরাসরি জেলে থেকে।" }),
  P({ slug: "tilapia", cat: "mach", name_bn: "তেলাপিয়া", name_en: "Tilapia", unit: "কেজি", price: 190, compare_price: 210, stock: 30, image: FI, badge_bn: null, farm: "ময়মনসিংহ সদর", featured: false,
    desc: "ফার্মে চাষ করা তেলাপিয়া, কাঁটাযুক্ত কিন্তু মাংস নরম।" }),
  P({ slug: "chingri", cat: "mach", name_bn: "বাগদা চিংড়ি", name_en: "Tiger Prawn", unit: "৫০০ গ্রাম", price: 680, compare_price: 750, stock: 12, image: FI, badge_bn: "রপ্তানি কোয়ালিটি", farm: "খুলনা সদর", featured: false,
    desc: "খুলনার বাগদা চিংড়ি — বড় সাইজ, মাথা পরিষ্কার, রান্নায় দ্রুত নরম হয়।" }),
  P({ slug: "koi-mach", cat: "mach", name_bn: "কৈ মাছ", name_en: "Climbing Perch", unit: "কেজি", price: 380, compare_price: 420, stock: 18, image: FI, badge_bn: null, farm: "জামালপুর সদর", featured: false,
    desc: "ছোট কৈ মাছ — দুর্বল রোগীর পথ্য, ঝোল করে খেতে দুর্দান্ত।" }),

  // ── দুধ ও দুগ্ধজাত
  P({ slug: "khanti-gorur-dudh", cat: "dudh-dudhgiyo", name_bn: "খাঁটি গরুর দুধ", name_en: "Pure Cow Milk", unit: "লিটার", price: 130, compare_price: 150, stock: 40, image: D, badge_bn: "সকালের দুধ", farm: "সিরাজগঞ্জ সদর", featured: true,
    desc: "সকালে দোহন করা খাঁটি গরুর দুধ, কোনো পাউডার বা পানি মেশানো নেই।" }),
  P({ slug: "deshi-ghi", cat: "dudh-dudhgiyo", name_bn: "দেশি ঘি", name_en: "Desi Ghee", unit: "৫০০ গ্রাম", price: 750, compare_price: 850, stock: 15, image: D, badge_bn: "অর্গানিক", farm: "পাবনা সদর", featured: true,
    desc: "ঘি তৈরি করা হয় মাখন থেকে, ধীরে জ্বাল দিয়ে — ঘরোয়া ঘ্রাণ ও দানাদার।" }),
  P({ slug: "doi", cat: "dudh-dudhgiyo", name_bn: "মিষ্টি দই", name_en: "Sweet Yogurt", unit: "৫০০ গ্রাম", price: 150, compare_price: 170, stock: 25, image: D, badge_bn: null, farm: "বগুড়া সদর", featured: false,
    desc: "বগুড়ার বিখ্যাত মিষ্টি দই, মাটির ভাঁড়ে প্যাক করা।" }),
  P({ slug: "chana", cat: "dudh-dudhgiyo", name_bn: "ঘন ছানা", name_en: "Fresh Chhana", unit: "৫০০ গ্রাম", price: 260, compare_price: 280, stock: 20, image: D, badge_bn: null, farm: "সিরাজগঞ্জ সদর", featured: false,
    desc: "মিষ্টি তৈরির জন্য ঘন ছানা, ঘরে বানানো — ফরমালিন মুক্ত।" }),

  // ── চাল, ডাল, তেল, মসলা
  P({ slug: "miniket-chal", cat: "chal-dal-mosla", name_bn: "মিনিকেট চাল", name_en: "Miniket Rice", unit: "৫ কেজি", price: 400, compare_price: 440, stock: 80, image: S, badge_bn: null, farm: "দিনাজপুর সদর", featured: true,
    desc: "দেশি মিনিকেট চাল, পলিশ কম — রান্নায় ঝরঝরে ভাত।" }),
  P({ slug: "chinigura-chal", cat: "chal-dal-mosla", name_bn: "চিনিগুঁড়া চাল", name_en: "Chinigura Rice", unit: "২ কেজি", price: 320, compare_price: 350, stock: 45, image: S, badge_bn: "পোলাও", farm: "নওগাঁ সদর", featured: false,
    desc: "পোলাও-বিরিয়ানির জন্য স্পেশাল চিনিগুঁড়া চাল, সুগন্ধি ও নরম।" }),
  P({ slug: "masoor-dal", cat: "chal-dal-mosla", name_bn: "মসুর ডাল", name_en: "Red Lentil", unit: "কেজি", price: 165, compare_price: 180, stock: 60, image: S, badge_bn: null, farm: "রাজশাহী সদর", featured: false,
    desc: "দেশি মসুর ডাল, ছোট দানা ও দ্রুত সিদ্ধ হয়।" }),
  P({ slug: "sorisar-tel", cat: "chal-dal-mosla", name_bn: "সরিষার তেল", name_en: "Mustard Oil", unit: "১ লিটার", price: 280, compare_price: 310, stock: 50, image: S, badge_bn: "কোল্ড প্রেস", farm: "পাবনা সদর", featured: true,
    desc: "কাঠের ঘানিতে ভাঙা খাঁটি সরিষার তেল — ঝাঁঝালো ঘ্রাণ ও স্বাদ।" }),
  P({ slug: "holud-gura", cat: "chal-dal-mosla", name_bn: "হলুদ গুঁড়া", name_en: "Turmeric Powder", unit: "২৫০ গ্রাম", price: 90, compare_price: 100, stock: 120, image: S, badge_bn: null, farm: "বান্দরবান সদর", featured: false,
    desc: "বান্দরবানের পাহাড়ি হলুদ, রোদে শুকিয়ে ভাঙা — রঙে ভরপুর।" }),
  P({ slug: "lanka-gura", cat: "chal-dal-mosla", name_bn: "মরিচ গুঁড়া", name_en: "Chilli Powder", unit: "২৫০ গ্রাম", price: 110, compare_price: 125, stock: 95, image: S, badge_bn: "ঝাল", farm: "বগুড়া সদর", featured: false,
    desc: "তেজা শুকনো লঙ্কা ভাঙা, কোনো কৃত্রিম রং নেই।" }),

  // ── মধু ও অর্গানিক
  P({ slug: "sundarban-modhu", cat: "modhu-organic", name_bn: "সুন্দরবনের মধু", name_en: "Sundarban Honey", unit: "৫০০ গ্রাম", price: 620, compare_price: 700, stock: 30, image: H, badge_bn: "খাঁটি", farm: "মোংলা, বাগেরহাট", featured: true,
    desc: "সুন্দরবনের খলিশা ফুলের মধু, জেলে-মৌয়ালদের কাছ থেকে সরাসরি। কোনো চিনি বা ভেজাল নেই।" }),
  P({ slug: "litchu-modhu", cat: "modhu-organic", name_bn: "লিচু ফুলের মধু", name_en: "Litchi Blossom Honey", unit: "৫০০ গ্রাম", price: 550, compare_price: 600, stock: 22, image: H, badge_bn: null, farm: "দিনাজপুর সদর", featured: false,
    desc: "দিনাজপুরের লিচু বাগানের মৌসুমি মধু, হালকা মিষ্টি সুগন্ধ।" }),
  P({ slug: "organic-gur", cat: "modhu-organic", name_bn: "অর্গানিক খেজুর গুড়", name_en: "Organic Date Jaggery", unit: "৫০০ গ্রাম", price: 240, compare_price: 270, stock: 18, image: H, badge_bn: "শীতে সীমিত", farm: "ঝিনাইদহ সদর", featured: false,
    desc: "খেজুর গাছের রস থেকে প্রাকৃতিকভাবে তৈরি গুড় — পিঠা ও পায়েসের জন্য।" }),

  // ── কৃষি উপকরণ
  P({ slug: "jobic-sar", cat: "krishi-upokoron", name_bn: "জৈব কম্পোস্ট সার", name_en: "Organic Compost", unit: "৫ কেজি", price: 180, compare_price: 200, stock: 40, image: A, badge_bn: null, farm: "সাভার, ঢাকা", featured: false,
    desc: "গোবর ও কেঁচোর সার মিশিয়ে তৈরি জৈব কম্পোস্ট - বাগান ও ছাদবাগানের জন্য সেরা।" }),
  P({ slug: "touta-beej", cat: "krishi-upokoron", name_bn: "টমেটো বীজ প্যাকেট", name_en: "Tomato Seed Packet", unit: "প্যাকেট", price: 60, compare_price: 75, stock: 100, image: A, badge_bn: "ছাদবাগান", farm: "বগুড়া সদর", featured: false,
    desc: "উচ্চ ফলের জন্য হাইব্রিড টমেটো বীজ — ছাদবাগানে চাষের উপযোগী।" }),
];

export const seedCombos = [
  {
    slug: "daily-combo-small",
    name_bn: "ডেইলি সবজি কম্বো (ছোট পরিবার)",
    name_en: "Daily Veggie Combo — Small",
    description_bn: "২–৩ জনের এক বেলার রান্নার জন্য প্রয়োজনীয় সবজির সেট, প্রতিদিন সকালে প্যাক করা।",
    kind: "daily",
    price: 249,
    original_price: 320,
    image: V,
    sort_order: 1,
    contents: [
      { name: "পালং শাক", qty: "১ আঁটি" },
      { name: "ঢেঁড়স", qty: "২৫০ গ্রাম" },
      { name: "বেগুন", qty: "২৫০ গ্রাম" },
      { name: "কাঁচা মরিচ", qty: "৫০ গ্রাম" },
      { name: "আলু", qty: "৫০০ গ্রাম" },
    ],
  },
  {
    slug: "daily-combo-family",
    name_bn: "ডেইলি সবজি কম্বো (বড় পরিবার)",
    name_en: "Daily Veggie Combo — Family",
    description_bn: "৪–৬ জনের দুবেলার রান্নার সবজি — মিশ্র সবজি, শাক এবং মসলা সবজি।",
    kind: "daily",
    price: 449,
    original_price: 560,
    image: V,
    sort_order: 2,
    contents: [
      { name: "পালং শাক", qty: "১ আঁটি" },
      { name: "লাল শাক", qty: "১ আঁটি" },
      { name: "বেগুন", qty: "৫০০ গ্রাম" },
      { name: "পটল", qty: "৪০০ গ্রাম" },
      { name: "মিষ্টি কুমড়া", qty: "৫০০ গ্রাম" },
      { name: "টমেটো", qty: "৩০০ গ্রাম" },
      { name: "কাঁচা মরিচ", qty: "১০০ গ্রাম" },
      { name: "আলু", qty: "১ কেজি" },
    ],
  },
  {
    slug: "weekly-combo-veg",
    name_bn: "উইকলি সবজি বক্স",
    name_en: "Weekly Veggie Box",
    description_bn: "সপ্তাহের ৭ দিনের সবজি একবারে — সোমবার সকালে ডেলিভারি।",
    kind: "weekly",
    price: 1290,
    original_price: 1560,
    image: V,
    sort_order: 3,
    contents: [
      { name: "মিশ্র সবজি", qty: "১.৫ কেজি" },
      { name: "শাক (৩ ধরনের)", qty: "৩ আঁটি" },
      { name: "আলু", qty: "২ কেজি" },
      { name: "দেশি পেঁয়াজ", qty: "১ কেজি" },
      { name: "কাঁচা মরিচ", qty: "২০০ গ্রাম" },
      { name: "টমেটো", qty: "৫০০ গ্রাম" },
    ],
  },
  {
    slug: "weekly-family-combo",
    name_bn: "উইকলি ফ্যামিলি কম্বো",
    name_en: "Weekly Family Combo",
    description_bn: "সবজি + ডিম + মাছের সাপ্তাহিক প্যাক — সপ্তাহের বাজার এক কলেই।",
    kind: "weekly",
    price: 2100,
    original_price: 2450,
    image: FI,
    sort_order: 4,
    contents: [
      { name: "উইকলি সবজি বক্স", qty: "১টি" },
      { name: "দেশি ডিম", qty: "১ ডজন" },
      { name: "রুই মাছ", qty: "১ কেজি" },
      { name: "সরিষার তেল", qty: "১ লিটার" },
    ],
  },
];

export const seedPackages = [
  {
    slug: "family-2-3",
    name_bn: "স্টার্টার ফ্যামিলি",
    name_en: "Starter Family",
    members_label: "২–৩ জনের পরিবার",
    members_min: 2,
    members_max: 3,
    price_monthly: 3200,
    saving_label: "মাসে ৮০০৳ সাশ্রয়",
    image: V,
    is_popular: false,
    sort_order: 1,
    features: [
      "সপ্তাহে ২ দিন তাজা সবজি ডেলিভারি",
      "মাসে ২ ডজন দেশি ডিম",
      "১ লিটার খাঁটি দুধ (সাপ্তাহিক)",
      "যেকোনো সময় পজ/রিসুম",
      "ফ্রি হোম ডেলিভারি",
    ],
  },
  {
    slug: "family-4-5",
    name_bn: "ফ্যামিলি প্লাস",
    name_en: "Family Plus",
    members_label: "৪–৫ জনের পরিবার",
    members_min: 4,
    members_max: 5,
    price_monthly: 4800,
    saving_label: "সবচেয়ে জনপ্রিয়",
    image: F,
    is_popular: true,
    sort_order: 2,
    features: [
      "সপ্তাহে ৩ দিন তাজা সবজি ডেলিভারি",
      "মাসে ৩ ডজন দেশি ডিম",
      "মাসে ২ কেজি মাছ",
      "১ লিটার দেশি ঘি (মাসিক)",
      "যেকোনো সময় পজ/রিসুম + ফ্রি হোম ডেলিভারি",
    ],
  },
  {
    slug: "family-6-plus",
    name_bn: "জয়েন্ট ফ্যামিলি",
    name_en: "Joint Family",
    members_label: "৬+ জনের পরিবার",
    members_min: 6,
    members_max: 20,
    price_monthly: 6900,
    saving_label: "সর্বোচ্চ সাশ্রয়",
    image: H,
    is_popular: false,
    sort_order: 3,
    features: [
      "সপ্তাহে ৩ দিন বড় সবজি বক্স",
      "মাসে ৪ ডজন দেশি ডিম",
      "মাসে ৩ কেজি মাছ বা মুরগি",
      "২ লিটার খাঁটি দুধ (সাপ্তাহিক)",
      "ডেডিকেটেড অ্যাকাউন্ট ম্যানেজার",
    ],
  },
];

export const seedZones = [
  { district: "ঢাকা", district_en: "Dhaka", division: "ঢাকা", scope: "inside_dhaka", charge: 60, free_over: 1200, eta_days: "আজকের মধ্যে" },
  { district: "গাজীপুর", district_en: "Gazipur", division: "ঢাকা", scope: "inside_dhaka", charge: 80, free_over: 1500, eta_days: "১ দিন" },
  { district: "নারায়ণগঞ্জ", district_en: "Narayanganj", division: "ঢাকা", scope: "inside_dhaka", charge: 80, free_over: 1500, eta_days: "১ দিন" },
  { district: "সাভার", district_en: "Savar", division: "ঢাকা", scope: "inside_dhaka", charge: 80, free_over: 1500, eta_days: "১ দিন" },
  { district: "চট্টগ্রাম", district_en: "Chattogram", division: "চট্টগ্রাম", scope: "outside_dhaka", charge: 150, free_over: 2500, eta_days: "২ দিন" },
  { district: "সিলেট", district_en: "Sylhet", division: "সিলেট", scope: "outside_dhaka", charge: 160, free_over: 2500, eta_days: "২–৩ দিন" },
  { district: "খুলনা", district_en: "Khulna", division: "খুলনা", scope: "outside_dhaka", charge: 150, free_over: 2500, eta_days: "২–৩ দিন" },
  { district: "রাজশাহী", district_en: "Rajshahi", division: "রাজশাহী", scope: "outside_dhaka", charge: 150, free_over: 2500, eta_days: "২–৩ দিন" },
  { district: "বরিশাল", district_en: "Barishal", division: "বরিশাল", scope: "outside_dhaka", charge: 160, free_over: 2500, eta_days: "৩ দিন" },
  { district: "রংপুর", district_en: "Rangpur", division: "রংপুর", scope: "outside_dhaka", charge: 170, free_over: 3000, eta_days: "৩ দিন" },
  { district: "ময়মনসিংহ", district_en: "Mymensingh", division: "ময়মনসিংহ", scope: "outside_dhaka", charge: 140, free_over: 2500, eta_days: "২ দিন" },
];

export const seedCoupons = [
  { code: "BISWAS10", type: "percent", value: 10, min_order: 500, max_discount: 200, usage_limit: 500 },
  { code: "FRESH100", type: "fixed", value: 100, min_order: 900, max_discount: null, usage_limit: 300 },
  { code: "NEW200", type: "fixed", value: 200, min_order: 1500, max_discount: null, usage_limit: 100 },
];

export const seedFarmers = [
  {
    name_bn: "মোঃ রহিম উদ্দিন",
    location_bn: "সাভার, ঢাকা",
    specialty_bn: "পালং ও লাল শাক",
    story_bn:
      "তিন প্রজন্ম ধরে সাভারে শাক চাষ করছেন রহিম ভাই। ১২ বিঘা জমিতে গোবর সার আর জৈব বালাইনাশ ব্যবহার করেন। প্রতিদিন ভোর ৫টায় সবজি তোলা হয়, তাই আপনার হাতে পৌঁছায় কমপক্ষে ১২ ঘণ্টার মধ্যে।",
    years: 22,
    image: V,
    sort_order: 1,
  },
  {
    name_bn: "ফাতেমা বেগম",
    location_bn: "মধুপুর, টাঙ্গাইল",
    specialty_bn: "আনারস ও সবজি",
    story_bn:
      "নারী উদ্যোক্তা ফাতেমা বেগম ৩৫ জন কৃষক পরিবারকে নিয়ে সমবায় চালান। তার আনারস আর খিরা প্রতিবছর বিশ্বাস এগ্রোর সবচেয়ে জনপ্রিয় পণ্যের তালিকায় থাকে।",
    years: 14,
    image: F,
    sort_order: 2,
  },
  {
    name_bn: "আব্দুল করিম মিয়া",
    location_bn: "সিরাজগঞ্জ সদর",
    specialty_bn: "খাঁটি গরুর দুধ",
    story_bn:
      "৪০টি দেশি গাভী নিয়ে ডেইরি চালান করিম মিয়া। কোনো বুস্টার বা হরমোন ব্যবহার করেন না। প্রতিদিন সকালের দুধ দুপুরের মধ্যে কোল্ড চেইনে পৌঁছে যায়।",
    years: 18,
    image: D,
    sort_order: 3,
  },
  {
    name_bn: "মৌয়াল জমাদার আলী",
    location_bn: "মোংলা, বাগেরহাট",
    specialty_bn: "সুন্দরবনের মধু",
    story_bn:
      "মৌসুমে সুন্দরবনে গিয়ে খলিশা ফুল থেকে মধু সংগ্রহ করেন। জেলে-মৌয়ালদের কাছ থেকে সরাসরি মধু কিনে মেশিনে ফিল্টার করে বোতলভর্তি করা হয় — চিনি বা পানি মেশানোর সুযোগ নেই।",
    years: 30,
    image: H,
    sort_order: 4,
  },
];

export const seedReviews = [
  { name_bn: "সাদিয়া আফরিন", location_bn: "ধানমন্ডি, ঢাকা", rating: 5, comment: "শাকসবজি একেবারে বাগান থেকে তোলা মনে হয়েছে। মা বললেন অনেক দিন পর এমন টাটকা পালং পেলেন!" },
  { name_bn: "তানভীর হাসান", location_bn: "উত্তরা, ঢাকা", rating: 5, comment: "ফ্যামিলি প্যাকেজ নিয়েছি দুই মাস। প্রতিবারই সময়মতো ডেলিভারি, সবজির কোয়ালিটি কখনো পড়েনি।" },
  { name_bn: "নুসরাত জাহান", location_bn: "চট্টগ্রাম", rating: 4, comment: "ঢাকার বাইরে ডেলিভারি একটু দেরি হয়, কিন্তু মাছের ফ্রেশনেস দেখে মুগ্ধ। ইলিশ একেবারে জেলের মতো।" },
  { name_bn: "ডা. মাহমুদুল হাসান", location_bn: "সিলেট", rating: 5, comment: "দেশি মুরগির মাংসের স্বাদ বাজারের চেয়ে অনেক আলাদা। পরিবারের জন্য নির্ভরযোগ্য জায়গা পেয়েছি।" },
  { name_bn: "রুমানা আক্তার", location_bn: "মিরপুর, ঢাকা", rating: 5, comment: "মধু খাঁটি কিনা পরীক্ষা করেছি — পানিতে দিলে তলায় যায়নি। সুন্দরবনের আসল মধু।" },
  { name_bn: "শাকিল আহমেদ", location_bn: "গাজীপুর", rating: 4, comment: "অর্ডার ট্র্যাকিং খুব সুবিধাজনক, কুরিয়ার কোথায় আছে দেখতে পারি। দামও যুক্তিসঙ্গত।" },
];

export const seedPosts = [
  {
    slug: "shiter-taja-sabji-kothay-pabem",
    title_bn: "শীতে কোন সবজি সবচেয়ে পুষ্টিকর?",
    excerpt_bn: "শীতের বাজারে কোন সবজি কিনবেন এবং কীভাবে বুঝবেন সবজি সত্যিই তাজা? জানুন ৫টি সহজ নিয়ম।",
    tag_bn: "মৌসুমি সবজি",
    read_minutes: 5,
    cover: V,
    content_bn: `## শীতের সবজির সেরা সময়
শীতে আমাদের দেশে সবজির বৈচিত্র্য সবচেয়ে বেশি। ফুলকপি, বাঁধাকপি, গাজর, মুলা, শালগম — প্রতিটিই শীতে সবচেয়ে মিষ্টি ও পুষ্টিকর হয়, কারণ দিনের তাপমাত্রা কমলে সবজিতে চিনির পরিমাণ বাড়ে এবং আঁশ নরম হয়।

### তাজা সবজি চেনার ৫টি নিয়ম
- **শক্ত কাণ্ড**: শাকের কাণ্ড ভাঙলে ফাঁপা শব্দ হলে বুঝবেন ভেতরে পানি কম — ফ্রেশ নয়।
- **পাতার রঙ**: গাঢ় সবুজ পাতা মানে বেশি ক্লোরোফিল, তবে সাদা দাগ বা হলদে ছোপ থাকলে এড়িয়ে চলুন।
- **ওজন**: একই আকারের সবজির মধ্যে ভারীটি কিনুন, বেশি রস মানে বেশি ফ্রেশনেস।
- **ঘ্রাণ**: কাঁচা মরিচ বা ঢেঁড়সের তাজা ঘ্রাণ — সস্তা বাঁচাতে পরে কেমিক্যাল দিয়ে ধরা বোঝায়।
- **কাটা দাগ**: বেগুন বা কুমড়ার কাটা অংশ শুকিয়ে গেলে বুঝবেন ২৪ ঘণ্টার বেশি পুরোনো।

### কেন মৌসুমি সবজি কিনবেন
অফ-সিজনে সবজি চাষে বেশি সার ও বালাইনাশ ব্যবহার হয়। মৌসুমে সবজি কম স্প্রে করেই ভালো জন্মে, দামও কম। বিশ্বাস এগ্রোতে আমরা প্রতি সপ্তাহে মৌসুম অনুযায়ী বক্স তৈরি করি — তাই আপনার ঘরে পৌঁছায় সবচেয়ে তাজা, সবচেয়ে কম রাসায়নিকের সবজি।`,
  },
  {
    slug: "khanti-modhu-chenar-upay",
    title_bn: "খাঁটি মধু চেনার ৭টি ঘরোয়া পরীক্ষা",
    excerpt_bn: "বাজারে ভেজাল মধু ঠেকাতে ঘরে বসেই কিছু সহজ পরীক্ষা করে দেখতে পারেন। কোনগুলো সত্যিই কাজ করে?",
    tag_bn: "অর্গানিক",
    read_minutes: 6,
    cover: H,
    content_bn: `## মধু কেন ভেজাল হয়
মধু সারা বছর চাহিদা থাকলেও ফুলের মৌসুম নির্দিষ্ট। তাই কেউ কেউ বেশি লাভের জন্য চিনির সিরাপ মিশিয়ে দিতে পারে। নিচের পরীক্ষাগুলো সবসময় ল্যাব-টেস্টের বিকল্প নয়, তবে প্রথম ধারণা দিতে পারে।

### ১. পানি পরীক্ষা
এক গ্লাস পানিতে এক চামচ মধু ছাড়ুন। খাঁটি মধু অনেক ধীরে নিচে জমে যায়, ভেজাল মধু সাথে সাথে মিশে যায়।

### ২. অঙ্গুলি পরীক্ষা
আঙুলে এক ফোঁটা মধু নিয়ে দেখুন — খাঁটি মধু ফোঁটা ফোঁটা পড়ে না, একটি সূক্ষ্ম ডোরার মতো টানে।

### ৩. কাগজে ছড়ান
মধু কাগজে ছড়িয়ে দেখুন — পুরোপুরি শুষে নিলে পানির পরিমাণ বেশি।

### ৪. ঠান্ডায় জমা
ফ্রিজে রাখলে খাঁটি মধু গ্লুকোজের কারণে জমে যায়; তবে সব মধু একই হারে জমে না।

### ৫. ভিনেগার + বেকিং সোডা
মধুর সাথে সামান্য ভিনেগার দিলে ফেনা (মিথ্যা/অনেক হলে) বুঝায় ভেজাল।

### ৬. রঙ ও খোলস
খাঁটি মধুর রঙ ফুলের উপর নির্ভর করে, তাই রঙ দিয়ে বিচার আন্দাজের।

### ৭. প্রতিষ্ঠানের ট্রেসেবিলিটি
সবচেয়ে নির্ভরযোগ্য — কোন মৌসুমে, কোন ফুল থেকে, কোন মৌয়াল সংগ্রহ করেছেন তার তথ্য আছে কীনা দেখুন। বিশ্বাস এগ্রোর প্রতিটি মধুর বোতলে সংগ্রহকারীর নাম ও মৌসুম লেখা থাকে।`,
  },
  {
    slug: "shorir-shustho-thakte-sokaler-khabar",
    title_bn: "সকালের নাস্তায় বাংলার ৫টি স্বাস্থ্যকর খাবার",
    excerpt_bn: "জলখাবার কেন সবচেয়ে ভালো — রুটি, ডিংড়ি, দই আর দেশি ডিম দিয়ে সহজ কিছু রেসিপি।",
    tag_bn: "স্বাস্থ্য টিপস",
    read_minutes: 4,
    cover: E,
    content_bn: `## দিনের শুরুটা গুরুত্বপূর্ণ
সকালের নাস্তা কোষ্ঠকাঠিন্য, শক্তির মাত্রা আর দিনভর খাওয়ার চাহিদা — তিনটিই প্রভাবিত করে। বাংলাদেশে সহজলভ্য কিছু খাবারই হতে পারে দুর্দান্ত নাস্তা।

### ১. আটার রুটি + দেশি ডিম
দেশি ডিমে ওমেগা-৩ ও প্রোটিন বেশি। দিনে একটি তো বাদ দেবেন না।

### ২. চিড়া (ধানের গুঁড়া)
ভিটামিন B সমৃদ্ধ, আঁশ আছে, আয়রনও। পানিতে ভিজিয়ে দই বা কলা দিয়ে খান।

### ৩. টক দই
প্রোবায়োটিক — পেটের ব্যাকটেরিয়া স্বাস্থ্য ভালো রাখে। চিনি না দিয়ে মিষ্টি দই খান।

### ৪. দেশি কলা
প্রাকৃতিক শর্করা ও পটাশিয়াম। ক্লান্ত পেশিতে ভালো।

### ৫. ঘি ও বাদাম
এক চামচ দেশি ঘি রুটিতে মাখিয়ে খান — ভালো চর্বি শক্তি দেয় এবং ভিটামিন D শোষণে সাহায্য করে।`,
  },
  {
    slug: "jibon-theke-golpo-ek-krishoker",
    title_bn: "খামার থেকে টেবিল: রহিম ভাইয়ের একদিন",
    excerpt_bn: "ভোর ৫টা থেকে আপনার দরজায় সবজি পৌঁছানো পর্যন্ত — খামার থেকে টেবিলের পুরো যাত্রাটা চোখে দেখুন।",
    tag_bn: "খামার",
    read_minutes: 7,
    cover: F,
    content_bn: `## ভোর ৫:০০ — মাঠে
সাভার, ঢাকা। শিশিরভেজা সবজির মাঠে বাঁশের ঝুড়ি হাতে হাঁটছেন মোঃ রহিম উদ্দিন। কচি পালং শাক পাতা বেছে তুলছেন — যেগুলো একটুও ফ্যাকাশে নয়।

## সকাল ৭:৩০ — সংগ্রহ কেন্দ্র
সবজি জমা হয় বিশ্বাস এগ্রোর সংগ্রহ কেন্দ্রে। ওজন মাপা হয়, প্রতিটি কৃষকের নামে ট্যাগ লাগানো হয়। এই ট্যাগটাই পরে আপনার বক্সে স্টিকার হয়ে যায়।

## সকাল ৯:০০ — র‍্যাবিট রেসিডিউ টেস্ট
প্রতিটি ব্যাচ থেকে নমুনা নেওয়া হয়। নতুন ব্যাচ হলে বারবি টেস্ট — ফেল করলে পুরো ব্যাচ ফেরত।

## বেলা ১১:০০ — প্যাকিং
বাঁশের ঝুড়ি ও কাগজের বক্সে প্যাকিং হয়, ঠান্ডা ঘরে রাখা হয়। এক ঘণ্টার মধ্যে কুরিয়ারে।

## সন্ধ্যা ৭:০০ — আপনার দরজায়
আপনার বক্সে লেবেল — খামারের নাম, তোলার তারিখ, প্যাকিং তারিখ।`,
  },
  {
    slug: "jal-er-gune-bhater-taste",
    title_bn: "দেশি চালে ফিরুন: মিনিকেট বনাম চিনিগুঁড়া",
    excerpt_bn: "কোন চাল দৈনিক ভাতে আর কোনটি পোলাওতে ভালো? কেমন চাল কেনা উচিত — পুরো গাইড।",
    tag_bn: "স্বাস্থ্য টিপস",
    read_minutes: 5,
    cover: S,
    content_bn: `## চালের ধরন
বাংলাদেশের বাজারে সবচেয়ে প্রচলিত চালগুলো — মিনিকেট, নাজিরশাইল, চিনিগুঁড়া, কাটারিভোগ, ব্রাউন রাইস। প্রতিটির ব্যবহার আলাদা।

### মিনিকেট
দৈনিক ভাতের জন্য সেরা। পলিশ বেশি হওয়ায় পুষ্টি কিছুটা কম, তবে রান্নায় ঝরঝরে।

### চিনিগুঁড়া
পোলাও, বিরিয়ানি। আঠালো ও সুগন্ধি।

### নাজিরশাইল
মাঝারি সাইজ, কম রান্না লাগে।

### ব্রাউন / রেড রাইস
আঁশ ও ভিটামিন বেশি। রক্তে গ্লুকোজ ধীরে বাড়ায় — ডায়াবেটিস রোগীদের জন্য ভালো।

### কীভাবে চাল কিনবেন
- দানা দেখুন: ভাঙা দানা কম হলে ভালো।
- গন্ধ: পুরোনো বা ভেজা চালে টক গন্ধ হয়।
- পানি: এক মুঠো চাল পানিতে ভিজিয়ে দেখুন পানি মেঘলা হলে পলিশ বেশি।

বিশ্বাস এগ্রোতে চাল আসে দিনাজপুর ও নওগাঁর কৃষকের কাছ থেকে সরাসরি, পলিশ কমিয়ে।`,
  },
  {
    slug: "macher-pusti-gun",
    title_bn: "মাছের পুষ্টিগুণ: কোন মাছ কেন খাবেন?",
    excerpt_bn: "ইলিশ, রুই, কৈ, তেলাপিয়া — কোন মাছে কী পাবেন এবং কাদের বেশি খাওয়া দরকার।",
    tag_bn: "স্বাস্থ্য টিপস",
    read_minutes: 4,
    cover: FI,
    content_bn: `## বাংলার মাছ = বাংলার পুষ্টি
মাছে আছে ওমেগা-৩ ফ্যাটি অ্যাসিড, প্রোটিন, ভিটামিন D, ক্যালসিয়াম ও আয়োডিন।

### ইলিশ
ওমেগা-৩ সবচেয়ে বেশি। হৃদরোগ প্রতিরোধে ভালো। সিজন মৌসুমে।

### রুই / কাতলা
প্রোটিন ও ভিটামিন A। সস্তা ও সহজলভ্য।

### কৈ
সহজে হজম, দুর্বল রোগী ও শিশুর জন্য।

### তেলাপিয়া
কম দামে বেশি প্রোটিন, তবে ওমেগা-৩ কম।

### চিংড়ি
উচ্চ প্রোটিন, কম চর্বি। অ্যালার্জি থাকলে এড়িয়ে চলুন।

**কেনা ও খাওয়ার টিপস**
- মাছের চোখ পরিষ্কার ও বেরিয়ে থাকা মানে ফ্রেশ
- ফুলকা লাল হলে ফ্রেশ, বাদামি হলে নয়
- মাছ ধরার পর বরফে রাখলে ২৪-৪৮ ঘণ্টা ভালো থাকে

বিশ্বাস এগ্রো থেকে অর্ডার করলে মাছ পরিষ্কার করে আইস প্যাকে পৌঁছানো হয়।`,
  },
];

export const seedBanners = [
  {
    title_bn: "খামার থেকে সরাসরি — এই সপ্তাহে ২০% ছাড়",
    subtitle_bn: "প্রথম অর্ডারে কুপন কোড BISWAS10 ব্যবহার করে ১০% ছাড় নিন। ঢাকায় আজকের মধ্যে ডেলিভারি।",
    image: V,
    link: "/products",
    sort_order: 1,
  },
];
