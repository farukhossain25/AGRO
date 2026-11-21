export const site = {
  nameBn: "বিশ্বাস এগ্রো",
  nameEn: "Biswas Agro",
  fullName: "বিশ্বাস এগ্রো (Biswas Agro) | Farm to Family",
  taglineBn: "বিশুদ্ধতার আস্থায়, খামার থেকে আপনার ঘরে",
  taglineEn: "Trust in purity — from our farms to your home",
  descriptionBn:
    "বিশ্বাস এগ্রো — খামার থেকে সরাসরি তাজা শাকসবজি, ফলমূল, দেশি ডিম, মাছ, মাংস, দুধ, চাল-ডাল-তেল-মসলা ও অর্গানিক পণ্য। সারা বাংলাদেশে হোম ডেলিভারি, ক্যাশ অন ডেলিভারি সুবিধা।",
  descriptionEn:
    "Biswas Agro delivers farm-fresh organic vegetables, fruits, eggs, fish, meat, dairy and pantry staples directly from Bangladeshi farmers to your family.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://bishwasagro.com",
  domain: "bishwasagro.com",
  phone: process.env.NEXT_PUBLIC_PHONE || "+8801700000000",
  phoneDisplay: "০১৭০০-০০০০০০",
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || "8801700000000",
  email: "hello@bishwasagro.com",
  addressBn: "হাউজ ১২, রোড ৭, ধানমন্ডি, ঢাকা ১২০৯, বাংলাদেশ",
  addressEn: "House 12, Road 7, Dhanmondi, Dhaka 1209, Bangladesh",
  hoursBn: "প্রতিদিন সকাল ৭টা — রাত ১০টা",
  social: {
    facebook: "https://facebook.com/bishwasagro",
    youtube: "https://youtube.com/@bishwasagro",
    instagram: "https://instagram.com/bishwasagro",
  },
  mapEmbed:
    "https://www.google.com/maps?q=Dhanmondi%2C%20Dhaka%2C%20Bangladesh&output=embed",
};

export const nav = [
  { href: "/categories", labelBn: "ক্যাটাগরি", labelEn: "Categories" },
  { href: "/combos", labelBn: "কম্বো বক্স", labelEn: "Combo Boxes" },
  { href: "/subscription", labelBn: "মাসিক প্যাকেজ", labelEn: "Subscriptions" },
  { href: "/farm", labelBn: "আমাদের খামার", labelEn: "Our Farms" },
  { href: "/blog", labelBn: "ব্লগ", labelEn: "Blog" },
  { href: "/track", labelBn: "অর্ডার ট্র্যাক", labelEn: "Track Order" },
  { href: "/about", labelBn: "আমাদের সম্পর্কে", labelEn: "About" },
  { href: "/contact", labelBn: "যোগাযোগ", labelEn: "Contact" },
];

export const footerLinks = {
  shop: [
    { href: "/products", labelBn: "সব পণ্য", labelEn: "All products" },
    { href: "/categories", labelBn: "ক্যাটাগরি", labelEn: "Categories" },
    { href: "/combos", labelBn: "ডেইলি ও উইকলি কম্বো", labelEn: "Daily & weekly combos" },
    { href: "/subscription", labelBn: "ফ্যামিলি প্যাকেজ", labelEn: "Family packages" },
    { href: "/offers", labelBn: "অফার ও কুপন", labelEn: "Offers & coupons" },
  ],
  help: [
    { href: "/track", labelBn: "অর্ডার ট্র্যাকিং", labelEn: "Order tracking" },
    { href: "/faq", labelBn: "সাধারণ প্রশ্ন", labelEn: "FAQ" },
    { href: "/contact", labelBn: "যোগাযোগ", labelEn: "Contact" },
    { href: "/policies/refund", labelBn: "রিফান্ড নীতি", labelEn: "Refund policy" },
  ],
  company: [
    { href: "/about", labelBn: "আমাদের সম্পর্কে", labelEn: "About us" },
    { href: "/farm", labelBn: "খামার ও কৃষক", labelEn: "Farms & farmers" },
    { href: "/blog", labelBn: "ব্লগ ও স্বাস্থ্য টিপস", labelEn: "Blog & health tips" },
    { href: "/policies/privacy", labelBn: "প্রাইভেসি পলিসি", labelEn: "Privacy policy" },
    { href: "/policies/terms", labelBn: "শর্তাবলী", labelEn: "Terms of service" },
  ],
};

export const orderStatusSteps = [
  { key: "received", bn: "অর্ডার গৃহীত", en: "Order received", icon: "📥" },
  { key: "packing", bn: "প্যাকিং", en: "Packing", icon: "📦" },
  { key: "shipped", bn: "ডেলিভারির পথে", en: "On the way", icon: "🛺" },
  { key: "delivered", bn: "ডেলিভারি সম্পন্ন", en: "Delivered", icon: "✅" },
] as const;

export const paymentMethods = [
  {
    id: "bkash",
    bn: "বিকাশ",
    en: "bKash",
    hintBn: "টেস্ট মোডে কাজ করে — লাইভ গেটওয়ে সংযুক্ত করুন",
    color: "#e2136e",
    emoji: "📱",
  },
  {
    id: "nagad",
    bn: "নগদ",
    en: "Nagad",
    hintBn: "টেস্ট মোডে কাজ করে — লাইভ গেটওয়ে সংযুক্ত করুন",
    color: "#f6921e",
    emoji: "💳",
  },
  {
    id: "sslcommerz",
    bn: "কার্ড / SSLCommerz",
    en: "SSLCommerz",
    hintBn: "ভিসা, মাস্টারকার্ড, ব্যাংক ও মোবাইল ব্যাংকিং",
    color: "#0a7d5a",
    emoji: "🏦",
  },
  {
    id: "cod",
    bn: "ক্যাশ অন ডেলিভারি",
    en: "Cash on delivery",
    hintBn: "পণ্য হাতে পেয়ে পেমেন্ট করুন",
    color: "#b7ead2",
    emoji: "💵",
  },
] as const;

export const trustBadges = [
  { bn: "১০০% তাজা", en: "100% fresh", icon: "🌱" },
  { bn: "সার্টিফায়েড অর্গানিক", en: "Certified organic", icon: "🏅" },
  { bn: "সারা দেশে ডেলিভারি", en: "Nationwide delivery", icon: "🚚" },
  { bn: "সহজ রিটার্ন", en: "Easy returns", icon: "↩️" },
];

export const whyChooseUs = [
  {
    icon: "🌅",
    titleBn: "প্রতিদিন সকালে তোলা",
    titleEn: "Harvested every morning",
    bodyBn:
      "ভোর ৫টায় কৃষকের মাঠ থেকে সবজি তোলা হয়, দুপুরের মধ্যে প্যাকিং শেষে সন্ধ্যায় আপনার দরজায় পৌঁছে যায়।",
    bodyEn: "Picked at 5 AM, packed by noon and delivered to your door the same evening.",
  },
  {
    icon: "🧪",
    titleBn: "কোনো ক্ষতিকর কেমিক্যাল নেই",
    titleEn: "No harmful chemicals",
    bodyBn:
      "প্রতিটি ব্যাচ র‍্যাবিট কেমিক্যাল ও পেস্টিসাইড রেসিডিউ টেস্ট করানো হয়। ফেল করলে ফেরত যায় খামারেই।",
    bodyEn: "Every batch is tested for pesticide residue — rejected batches go straight back to the farm.",
  },
  {
    icon: "🏠",
    titleBn: "ঘরে পৌঁছে দেওয়া",
    titleEn: "Home delivery",
    bodyBn: "ঢাকায় ৮ ঘণ্টায়, ঢাকার বাইরে ২৪–৪৮ ঘণ্টায় কোল্ড-চেইন ডেলিভারি।",
    bodyEn: "8-hour delivery inside Dhaka, 24–48 hours nationwide with cold-chain packing.",
  },
  {
    icon: "🤝",
    titleBn: "কৃষকের ন্যায্য দাম",
    titleEn: "Fair price to farmers",
    bodyBn:
      "বাজার দরের চেয়ে ২০–৩০% বেশি দাম কৃষককে পরিশোধ করা হয় — মধ্যস্বত্বভোগী ছাড়া সরাসরি।",
    bodyEn: "Farmers get 20–30% above wholesale — paid directly, with no middlemen.",
  },
  {
    icon: "↩️",
    titleBn: "সহজ রিটার্ন",
    titleEn: "Easy return policy",
    bodyBn:
      "পণ্য পছন্দ না হলে ২৪ ঘণ্টার মধ্যে ছবি পাঠিয়ে রিটার্ন করুন — সম্পূর্ণ টাকা ফেরত।",
    bodyEn: "Not happy? Send a photo within 24 hours for a no-questions-asked full refund.",
  },
];
