# CHANGELOG

## 2026-11-25 — `docs/cctv-live-start-here.md` — এক পেজের চেকলিস্ট

- নতুন ডক: Imou ক্যামেরা → ওয়েবঅ্যাপে লাইভ — ক্রম অনুযায়ী ধাপ, দুই পথ
  (public IP + VPS / CGNAT + Imou ক্লাউড), কোনটাতে কোড বদলাতে হবে (কোথাও না)।
- প্রথমে VLC টেস্ট — ক্যামেরা কেনার আগেই কোন পথ জানা যাবে।

## 2026-11-25 — "ক্যামেরা + VPS, কোনো বক্স নেই" সিদ্ধান্ত-চার্ট

- ডকে §৪ক যোগ: public IP আছে কি না তার ভিত্তিতে সিদ্ধান্ত-চার্ট। CGNAT হলে VPS
  কিনলে সেটা **ক্যামেরা পর্যন্ত পৌঁছাতেই পারে না**, আর Imou ক্লাউড পথে VPS-এর
  দরকারই নেই (ভিডিও Imou CDN → আমাদের সার্ভার → ব্রাউজার)।
- ভবিষ্যতের অপ্টিমাইজেশন নোট: একই Imou স্ট্রিম ৫০ দর্শকের জন্য ৫০ বার না টেনে
  VPS-এ একবার টেনে ভাগ করা (`CAM_EDGE_PULL`, এখনো কোডে নেই)।

## 2026-11-25 — public IP না পেলে কী করবেন (৪ উপায়)

- ডকের §৪ উপায়-তালিকা সম্প্রসারিত: ISP real IP না মিললে (১) Imou ক্লাউড API,
  (২) ফার্মের ছোট বক্স থেকে outbound SRT/RTSP push, (৩) ISP বদল/আবেদন,
  (৪) EZVIZ ক্যামেরা। প্রতিটার খরচ ও সীমা টেবিলে।
- Imou ক্লাউডের বাস্তব খরচ যোগ: প্রতি দর্শক-ঘণ্টা ~৳৭; ২০ জন × ৩০ মিন/দিন
  ≈ ৳২,০৫০/মাস, ১০ জন ২৪/৭ ≈ ৳৫০,৫০০/মাস (তাই শুধু শুরুতে)।
- ফার্ম-বক্স পথের বিদ্যুৎ খরচ ~৳৬৫/মাস (১০ W), কিন্তু ২৪/৭ ডিভাইস চালু রাখার
  শর্ত — ব্যবহারকারী আগে এটা চাননি, তাই স্পষ্ট সতর্কতা।

## 2026-11-25 — স্ট্রিম এজ: গোপন প্রিফিক্স + প্রকৃত Caddyfile

- **নিরাপত্তা:** ডাইরেক্ট মোডে আগে `STREAM_PUBLIC_BASE` ছিল খালি হোস্টনেম — মানে
  MediaMTX-এর সব path ইন্টারনেটে খোলা। এখন URL-এ `STREAM_EDGE_SECRET` প্রিফিক্স
  (`/live-<secret>/hls/...`), বাকি সব 404। এজে টোকেনের সিগনেচার ভেরিফাই হয় না —
  এটা ডকে স্পষ্ট লেখা (শেয়ার করা লিংক সর্বোচ্চ ৫ মিনিট চলে)।
- `Caddyfile` এখন সত্যিই TLS টার্মিনেট করে (80/443, Let's Encrypt) + `handle_path`
  দিয়ে `/hls` প্রিফিক্স কাটে + `/health-<secret>` (probe ও WHEP signaling)।
  আগের ফাইলটি `:8080`-এ শুধু shared-secret ছিল — `mediamtx:8888` DNS-ও ভুল ছিল।
- পুরোনো proxy-মোড কনফিগ `Caddyfile.proxy` নামে আলাদা; compose-এ `proxy` profile
  (`caddy-proxy`)। `public` profile এখন পোর্ট ৮০/৪৪৩ প্রকাশ করে।
- `mediamtx` থেকে `network_mode: host` সরানো — host নেটওয়ার্কে `expose` পোর্ট
  থাকে না, ফলে `reverse_proxy mediamtx:8888` রিজলভই করত না।
- `go2rtc`-এর `:1984` আর হোস্টে প্রকাশ্য নয় (ওর API-তে auth নেই)।
- `middleware.ts`: CSP-তে `STREAM_PUBLIC_BASE` থেকে শুধু **origin** নেওয়া হয়
  (path থাকলে CSP ভাঙত)।
- `.env.example`: `STREAM_PUBLIC_BASE`/`STREAM_PROXY_TARGET`-এর উদাহরণ প্রিফিক্সসহ,
  `STREAM_EDGE_SECRET` ডকুমেন্টেড।

## 2026-11-25 — ২৪/৭ গাইড সংশোধন + ই-কমার্স ট্রাফিক (১ লাখ ভিজিট)

- `docs/live-camera-vps-24x7.md`: **ধাপ ২** এখন "VPS কি ক্যামেরা পর্যন্ত পৌঁছাবে?"
  প্রমাণ করার ধাপ — VLC + মোবাইল ডাটা টেস্ট, CGNAT হলে ৩টা সমাধান। আগের ডকে
  `rtsp://192.168.x.x` লেখা ছিল, যা কোনো VPS থেকে অসম্ভব।
- Cloudflare Tunnel আর "recommended" নয় — Free প্ল্যানের শর্তে ভিডিও স্ট্রিমিং
  সীমিত। সুপারিশ এখন `--profile public` (VPS IP + Caddy + Let's Encrypt)।
  `docker-compose.stream-vps.yml`-এর হেডার কমেন্টও একইভাবে বদলানো।
- নতুন **§৮ ই-কমার্স ট্রাফিক**: ১ লাখ ভিজিটে concurrency ≈ ০.২ জন, পেজ ট্রাফিক
  ৩৪০ GB (Vercel Pro), ক্যামেরা ক্লিক ৭.৭ GB, ২৫০ প্রিমিয়াম × ৩০ মিনিট/দিন
  = ৮৬৪ GB — Oracle-এর ১০ TB-র অনেক নিচে।
- "মাসিক ট্রান্সফার কোটা" সতর্কতা — ১ TB কোটার VPS-এ ২৪/৭ মাত্র ~৬ জন।

## 2026-11-25 — ভিডিও Vercel bypass: `STREAM_PUBLIC_BASE`

- নতুন optional env `STREAM_PUBLIC_BASE` — সেট থাকলে `/api/stream/token` প্লেয়ারকে
  **স্ট্রিম এজের ডাইরেক্ট URL** দেয় (`https://stream…/hls/<key>/index.m3u8?t=<token>`)।
  ভিডিও বাইট আর Vercel-এর ভেতর দিয়ে যায় না।
- **কেন:** এখন প্রতিটা ভিডিও বাইট Vercel-এর Fast Data Transfer-এ গোনা হয় — Pro-তে ১ TB
  ফ্রি, তারপর **$0.15/GB**। ১০ জন প্রিমিয়াম ২৪/৭ দেখলেই ১.৫ TB = **$৭৩/মাস**, যার
  এক টাকাও প্রোডাক্ট পেজের ট্রাফিক নয়। ৫০ জন হলে **$৯৭৮/মাস**।
- নিরাপত্তা অপরিবর্তিত: একই ৫ মিনিটের সাইন করা টোকেন URL-এ থাকে; Caddy-কে টোকেন
  যাচাইয়ের কনফিগ ডকুমেন্টে দেওয়া আছে। সেট না করলে আগের মতোই same-origin proxy।
- `middleware.ts`: সেট থাকলে স্ট্রিম হোস্ট `connect-src` (hls.js) ও `media-src`
  (iOS Safari) — দুটোতেই বসে, নাহলে ব্রাউজার ভিডিও ব্লক করত।
- WebRTC এখনো proxy হয় (bulk media নয়, সিগন্যালিং)।

## 2026-11-25 — VPS ভিত্তিক ২৪/৭ লাইভ গাইড (রেকর্ডিং ছাড়া)

- নতুন `docs/live-camera-vps-24x7.md`: Imou ক্যামেরা → MediaMTX VPS → Cloudflare Tunnel →
  ওয়েবঅ্যাপ, **কোনো রেকর্ডিং নেই** (`record: false` আগেই ছিল), ২৪/৭, প্রিমিয়াম ৩০ দিন।
- **কেন:** Imou ক্লাউড পথে প্রতি দর্শকের ট্রাফিক বিল হয় — ২৪/৭ ৫০ জন = **৳২,৪১,১৯৯/মাস**।
  VPS-এ খরচ স্থির ৳০–১,২০০/মাস, দর্শক সংখ্যায় বদলায় না।
- ISP-তে ফ্রি real IP, Oracle Always Free (১০ TB/মাস), আর paid VPS — তিনটার তুলনা ও ধাপে
  ধাপে কপি-পেস্ট সেটআপ।

## 2026-11-25 — ক্লাউড ক্যামেরায় দর্শক-সীমা (খরচের নিরাপত্তা)

- `/api/cam/token`-এ এখন **concurrent viewer cap** আছে — `/api/stream/token`-এ আগে থেকেই ছিল,
  কিন্তু ক্লাউড-ব্রিজ পথে ছিল না। ফলে একটাই সাবস্ক্রিপশন দিয়ে **আনলিমিটেড ফোন** একই ক্যামেরা
  খুলতে পারত, আর প্রতিটাই ভেন্ডরের মিডিয়া কোটা খরচ করে (Imou: ২GB/মাস ফ্রি, তারপর $0.25/GB)।
- সীমা = `cameras.max_viewers` (না থাকলে `premium.max_viewers_per_camera`, ডিফল্ট ৫০)।
  মিন্ট করা প্রতিটি টোকেন `stream_tokens`-এ লেখা হয়, তাই গণনা TTL পর্যন্ত সঠিক থাকে।
  সীমা পূর্ণ হলে 429 + বাংলা বার্তা।
- টোকেন-গণনা ব্যর্থ হলেও স্ট্রিম আটকাবে না — এটা খরচের গার্ড, আয়ের গেট নয়।

## 2026-11-25 — প্লেলিস্ট ক্যাশ: Imou-র ফ্রি কোটা বাঁচানো

- নতুন `resolveCloudHlsCached()` — resolved vendor HLS URL `CAM_PLAYLIST_TTL_MS` (ডিফল্ট
  ২০ সেকেন্ড) পর্যন্ত ধরে রাখে। আগে প্লেয়ারের প্রতিটি প্লেলিস্ট রিফেচে (প্রতি সেগমেন্টে)
  `bindDeviceLive` + `getLiveStreamInfo` ডাকা হতো।
- **কেন:** Imou Open Platform অ্যাপ আইডি ধরে বিল করে — মাসে **৩০,০০০ কল + ২GB মিডিয়া ফ্রি**,
  তারপর $0.02/১০,০০০ কল ও $0.25/GB। একজন দর্শক ঘণ্টায় ~১,২০০ কল খায়; দশজন দর্শকে মাসের
  কোটা শেষ হয়ে স্ট্রিম `LV1003`/`FL1004` দিয়ে বন্ধ হয়ে যায়।
- ইন-মেমরি ও প্রতি instance-এ আলাদা — এটা **সাশ্রয়, গ্যারান্টি নয়**। ট্রাফিকের আসল হিসাব
  Vercel ও Imou কনসোলের ড্যাশবোর্ডে দেখতে হবে।

## 2026-11-25 — সিদ্ধান্ত: XVR ওয়েবসাইটে আনা সম্ভব নয়, Imou ক্যামেরাই পথ

- **Imou পথ বন্ধ প্রমাণিত:** Imou Life-এ পাসওয়ার্ড দেওয়ার পর `Error1000 — Failed to link this
  device. Please download the correct App and try again.` — Imou-র ক্লাউড Dahua-ব্র্যান্ডের
  রেকর্ডার লিংক করতে দেয় না।
- **RTMP পথও বন্ধ:** DH-XVR1B16-I-এর ডেটাশিটে Network Protocol-এ RTMP নেই
  (`HTTP; HTTPS; TCP/IP; IPv4; RTSP; UDP; SMTP; NTP; DHCP; DNS; DDNS; P2P`)।
- **সিদ্ধান্ত:** XVR আগের মতোই লোকাল রেকর্ডিং + DMSS রিমোট ভিউয়ের জন্য থাকবে। ওয়েবসাইটে
  ফার্মের লাইভ দেখাতে Imou ক্যামেরা লাগবে (নিজেরাই ক্লাউডে পুশ করে, VPS নেই)। প্রথমে একটা
  ক্যামেরা দিয়ে পাইলট, তারপর বাকি সেলারদের জন্য।
- `docs/live-camera-xvr-imou.md`-এর শুরুতেই সিদ্ধান্তের টেবিল যোগ করা হলো; বাকি অংশ ঐতিহাসিক
  রেফারেন্স (Open Platform, অ্যাডমিন ফিল্ড, যাচাই — Imou ক্যামেরার ক্ষেত্রেও একই)।

## 2026-11-25 — XVR → Imou ক্লাউড গাইড (মনিটর/ল্যাপটপ ছাড়া)

- নতুন `docs/live-camera-xvr-imou.md`: Dahua XVR-কে Imou ক্লাউডে নিয়ে ওয়েবঅ্যাপে লাইভ দেখানোর
  ধাপে ধাপে গাইড — বাঁধন ছাড়ানোর ক্রম, Open Platform সেটআপ, অ্যাডমিন প্যানেলের ফিল্ড, যাচাই।
- **মূল অনুসন্ধান:** Dahua আর Imou একই ক্লাউড (Easy4IP/Lechange), কিন্তু **একটা P2P ডিভাইস
  একসাথে একটাই ক্লাউড অ্যাকাউন্টে বাঁধা থাকতে পারে** — তাই DMSS থেকে ডিভাইস ডিলিট + লগ আউট
  না করলে Imou Life "already connected to another app" দেখায়।

## 2026-11-25 — Dahua XVR/NVR-এর জন্য Imou মেইন স্ট্রিম option

- Imou ব্রিজ এখন `IMOU_STREAM_ID` পড়ে: `1` = SD সাব-স্ট্রিম (ডিফল্ট), `0` = HD মেইন স্ট্রিম।
- **কেন:** Dahua XVR-এর সাব-স্ট্রিম অনেক সময় সর্বোচ্চ **CIF 352×288 @ ৭ fps** — প্রোডাক্ট পেজে
  অচল। XVR-এর মেইন স্ট্রিম ১০৮০N/৭২০p, তাই রেকর্ডারের ক্ষেত্রে `IMOU_STREAM_ID=0` দিতে হবে।
- `bindDeviceLive` এখন কনফিগার করা `streamId` দিয়েই বাইন্ড করে, আর প্লেলিস্ট বেছে নেওয়ার সময়
  `কনফিগার করা স্ট্রিম → মেইন → সাব → যেকোনো` এই ক্রমে ফলব্যাক করে (রেকর্ডার অনেক সময় শুধু
  যে স্ট্রিম বাইন্ড করা হয়েছে সেটাই ফেরত দেয়)।

## 2026-11-24 — সাইট-ব্যাপী এরর ও ভুয়া "পণ্য পাওয়া যায়নি" (রিগ্রেশন ফিক্স)

**লক্ষণ:** মাঝেমধ্যে পুরো সাইটের ডেটা খালি, আর যেকোনো পণ্যে ক্লিক করলে ৪০৪ — অথচ পণ্যটি
ডেটাবেসে আছে। একবার সাময়িক নেটওয়ার্ক গোলযোগ হলেই সার্ভার প্রসেসটি স্থায়ীভাবে "ডেটাবেস ডাউন"
অবস্থায় আটকে যাচ্ছিল।

চারটি আলাদা কারণ ছিল, চারটিই ঠিক করা হয়েছে:

- **সার্কিট ব্রেকার আর কখনো খুলত না** (`lib/db.ts`) — একবার ব্যর্থ হলে `reachable=false` চিরতরে
  থেকে যেত, ফলে প্রসেসটি রিস্টার্ট/রিডিপ্লয় না করা পর্যন্ত সব পেজ খালি ডেটা দেখাত। এখন
  `SUPABASE_PROBE_AFTER_MS` (ডিফল্ট ৩ সেকেন্ড) পর নিজে থেকেই আবার চেষ্টা করে, সফল হলেই খুলে যায়।
- **শুধু নেটওয়ার্ক/ট্রান্সপোর্ট ব্যর্থতাতেই ব্রেকার বন্ধ হয়** — `42703` (কলাম নেই), `42P01`
  (টেবিল নেই), PGRST এরর আর ব্রেকার খোলে না, কারণ ওগুলো সার্ভার সচল থাকলেও হতে পারে।
- **`cloud_provider` কলাম পুরোনো DB-তে না থাকায় সব খামার উধাও** (`lib/farms.ts`) — কলামটি শেয়ার্ড
  ক্যামেরা-সিলেক্টে ঢোকানো হয়েছিল, ফলে migration 24 চালানোর আগেই সম্পূর্ণ embedded সিলেক্ট
  ব্যর্থ হয়ে খামার লিস্ট খালি হয়ে যেত। এখন ধাপে ধাপে ফলব্যাক (নতুন কলাম → পুরোনো কলাম → প্লেইন)।
- **পড়ার এরর গিলে ফেলে `null` ফেরানো হচ্ছিল** (`lib/queries.ts`) — `maybeSingle()`-এ শুধু `data`
  নেওয়া হতো, `error` ফেলা হতো। ফলে Supabase ডাউন থাকলেও "কোনো রো নেই" ধরে নিয়ে
  `notFound()` চলত = ভুয়া ৪০৪। এখন `getProductBySlug`, `getComboBySlug`, `getCategoryBySlug`,
  `getBlogPost`, `getCouponByCode`, `getOrderByNo` এরর থ্রো করে, আর স্লাগ-লুকআপের পেজগুলো
  `lookup*()` হেল্পার দিয়ে “নেই” আর “পড়া যায়নি” আলাদা করে — ব্যর্থ হলে ৫০০/রিট্রাই, ভুয়া ৪০৪ নয়।
- `SUPABASE_PROBE_AFTER_MS` `.env.example`-এ যোগ করা হয়েছে।

**যাচাই:** নকল Supabase দিয়ে তিনটি অবস্থা পরীক্ষা করা হয়েছে — স্বাস্থ্যকর (আসল পণ্য রেন্ডার,
ভুয়া স্লাগ → পাওয়া যায়নি), DB ডাউন (এরর বাউন্ডারি, লগে `lookup failed`, কোনো ভুয়া ৪০৪ নেই),
এবং DB ফিরে আসার পর **রিস্টার্ট ছাড়াই** সব পেজ আবার স্বাভাবিক।

## 2026-11-24 — MediaMTX কনফিগ আধুনিকীকরণ + AWS টেস্ট গাইড

- `mediamtx.yml`-এ পুরোনো কী-নাম ছিল যা নতুন MediaMTX চালু-ই হতে দিত না: `hlsAllowOrigin` →
  `hlsAllowOrigins`, `webrtcAllowOrigin` → `webrtcAllowOrigins`, `record: no` → `false`,
  `sourceOnDemand: yes` → `true`; বাদ পড়া `hlsAlwaysRemoveSegments` সরিয়ে `hlsMuxerCloseAfter`।
- **RTMP (১৯৩৫) ও SRT (৮৮৯০) ইনজেস্ট চালু** — যে DVR রাউটারে পোর্ট খুলতে পারে না, সেটি নিজেই
  RTMP push করতে পারে। তখন খামারে পাবলিক IP বা ফরওয়ার্ড কিছুই লাগে না।
- `docker-compose.stream-vps.yml`-এ `MTX_HLS_ALLOWORIGINS` (নতুন নাম) + `MTX_HLS_MUXERCLOSEAFTER`।
- নতুন `docs/live-camera-aws-test.md` — AWS Free Tier-এ ৫–৭ দিনের টেস্ট, ব্রাউজার-টার্মিনালসহ,
  খরচের হিসাব এবং H.265 ফাঁদের সতর্কতা।

## 2026-11-24 — লাইভ ক্যামেরা এখন ভিপিএস ছাড়াই (Imou / EZVIZ ক্লাউড ব্রিজ)

- **সমস্যা:** সেলাররা কেউ ল্যাপটপ/ডেস্কটপ খামারে রাখতে পারবেন না, আর ভিপিএস নিতে চান না। MediaMTX
  পথে একটা সার্ভার ২৪ ঘণ্টা চালু রাখা বাধ্যতামূলক ছিল, তাই ৫ জন সেলারের ৫টা ক্যামেরা কোনোদিনই
  লাইভে আসত না।
- **সমাধান:** ক্যামেরার নিজের অ্যাপ (Imou Life / EZVIZ) যেভাবেই ক্যামেরাটা ইন্টারনেটে পৌঁছায়, আমরা
  সেই একই ক্লাউড API ব্যবহার করি। কোনো ভিপিএস নেই, পোর্ট খোলা নেই, ফার্মে কিছু চালু রাখতে হয় না।
- **নতুন:** `supabase/sql/24_camera_cloud_bridge.sql` — `cameras.cloud_provider`
  (`none|hls|imou|ezviz`), `cloud_serial`, `cloud_channel` + ইনডেক্স ও চেক কনস্ট্রেইন্ট।
- `lib/camera-cloud.ts` — Imou (MD5 সাইন, ৩-দিনের টোকেন ক্যাশ) ও EZVIZ (form API) ক্লায়েন্ট।
- `/api/cam/token` — প্রিমিয়াম/ট্রায়াল যাচাই করে ৫ মিনিটের সাইনড টোকেন দেয় (এক ক্যামেরার জন্য)।
- `/api/cam/live/<id>/index.m3u8` + `/seg/...` — প্লেলিস্ট রিরাইট করে প্রতিটি সেগমেন্ট নিজের
  ডোমেইন দিয়ে প্রক্সি করে। `s` = HMAC(ক্যামেরা, URL), নইলে এন্ডপয়েন্টটা ওপেন রিলে হয়ে যেত।
- `components/live/cloud-player.tsx` — hls.js / iOS নেটিভ HLS, স্ক্রলে পজ, লক-স্টেট।
- অ্যাডমিন ক্যামেরা ফর্মে **স্ট্রিম সোর্স / ডিভাইস সিরিয়াল / চ্যানেল** — কোন পথে ছবি আসবে সেটা
  এখন ডেটাবেস থেকেই ঠিক হয়, তাই একই প্যানেলে ভিপিএস ও ক্লাউড দুটোই চলে।
- `.env.example` + `docs/live-camera-no-vps.md` — ধাপে ধাপে বাংলা গাইড।
- **নিরাপত্তা:** RTSP ঠিকানা/সিরিয়াল/AppSecret ব্রাউজারে যায় না; স্ট্রিম কী না থাকলে ৫০২ (ওপেন
  স্ট্রিম নয়); `CAM_ALLOW_DIRECT_HLS` ছাড়া সরাসরি HLS বন্ধ; `db:check` ✓ ১৭৩ চেক, `db:columns` ✓,
  `tsc` ✓, `next lint` ✓, বিল্ড ✓, বান্ডল বাজেট ✓।

## 2026-11-24 — প্রিমিয়াম পেমেন্ট এখন অ্যাডমিন প্যানেল থেকেই যাচাই, চালু বা কারণসহ বাতিল

- **সমস্যা:** গ্রাহক প্ল্যান কিনে টাকা পাঠালেও অ্যাডমিন প্যানেলের প্রিমিয়াম পেজ শুধু একটা টেবিল দেখাত — অপেক্ষমাণ
  পেমেন্টের TrxID, প্রেরকের নম্বর বা "চালু করুন" বোতাম কোথাও ছিল না। ফলে পেমেন্ট এসে জমা থাকত, অ্যাক্সেসও খুলত না।
- **`/foisal/premium` নতুন সাজানো:** উপরে কাউন্টার (যাচাইয়ের অপেক্ষায় / সক্রিয় / বাতিল) + সার্চ (সাব নং, নাম,
  মোবাইল, TrxID); নিচে প্রতিটি পেমেন্ট কার্ডে গ্রাহক, মোবাইল, প্ল্যান, টাকা, মাধ্যম, **TrxID (কপি করা যায়)**,
  প্রেরকের নম্বর, জমা দেওয়ার সময়।
- **যাচাই করে চালু:** ডায়ালগে TrxID নিশ্চিত/ঠিক করে "চালু করুন" — প্ল্যানের নিজের মেয়াদ (৩০/১৮২/৩৬৫ দিন) যোগ হয়,
  `profiles.role = premium` + `premium_until` সেট হয়, গ্রাহক নোটিফিকেশন পান, অডিট লগে ওঠে। চলমান প্ল্যানের মেয়াদ
  বাড়ে, শেষ হওয়া প্ল্যানে নতুন করে শুরু হয়।
- **কারণসহ বাতিল:** কারণ বাধ্যতামূলক; `user_subscriptions.cancel_reason`-এ জমা হয়, ভারসাম্য থাকলে গ্রাহকের
  `premium` রোল নামানো হয়, গ্রাহক নোটিফিকেশনে কারণটি পান।
- **নিরাপত্তা:** শুধু `premium.manage` পারমিশন; `.eq("status","pending")` দিয়ে গার্ড করা (ডাবল ক্লিকে দুইবার
  অ্যাক্সেস যোগ হয় না); অডিট `approve`/`reject`। নতুন API: `GET/PATCH /api/foisal/premium-subscriptions`।
- **সাইডবার:** "প্রিমিয়াম → সাবস্ক্রিপশন" আইটেমে যাচাইয়ের অপেক্ষায় থাকা পেমেন্টের সংখ্যা।
- **গ্রাহকের দিক:** `/account/premium`-এ "পেমেন্ট যাচাই চলছে" (TrxID সহ) ও "পেমেন্ট যাচাই হয়নি + কারণ" কার্ড;
  ইতিহাস টেবিলে নোট কলাম।
- **SQL:** `23_premium_payment_approval.sql` — `cancel_reason`, `reviewed_at`, `reviewed_by` + দুটি ইনডেক্স
  (`05` ও `ALL_IN_ONE`-ও আপডেট, `db:types` রিজেনারেট)। `npm run db:check` ✓।

## 2026-11-24 — নতুন লোগো: গোল সিল "বিশ্বাস এগ্রো" পুরো সাইটে

- **মূল ফাইল:** `assets/brand/bishwas-agro-logo.png` (মালিকের নতুন দেওয়া ছবি, আগের JPG-এর জায়গায়)। সব র্যাস্টার
  `node scripts/generate-brand.mjs` থেকেই আবার তৈরি — হাতে কিছু আঁকা হয়নি।
- **হেডারে প্রতীক:** এখন নতুন সিলের **দৃশ্য** (সূর্য, খামারবাড়ি, ধানখেত, নিচে পাতার অলংকার) গোল-কোণা বর্গ টাইলে;
  আগের মতোই ৪০px (ফোন) → ৪৪px (৪০০px+) → ৫২px (ডেস্কটপ), পাশে লেখা "বিশ্বাস এগ্রো / BISHWAS AGRO"।
- **ওয়ার্ডমার্কের রং:** নতুন লোগোর রিং-সবুজ `#0a4d0a`, এগ্রো-র সবুজ `#2f7a10`; লোগোর সোনালি `#fcd818` লেখায়
  ব্যবহার করলে ১২px-এ পড়া যেত না, তাই `AGRO` এখন গাঢ় অ্যাম্বার `#8f5a05` (কনট্রাস্ট ৪.৯:১)।
- **ফুটার:** গোল সিলটি **স্বচ্ছ কোণা সহ** বসে (সাদা প্লেট বাদ), ২০০px (ফোন) / ২৪০px (ডেস্কটপ)।
- **favicon/PWA:** আইকন ও স্প্ল্যাশ নতুন সিল থেকে; ফেভিকনে ক্রিম প্লেটে ধানখেতের দৃশ্য (১৬px-এও চেনা যায়),
  maskable নিরাপদ অঞ্চলে, নোটিফিকেশন ব্যাজে সাদা সিলুয়েট। ম্যানিফেস্টের রং `#083a0a` / `#0a4d0a`, SW `ba-v3`।
- **SEO:** Organization-এর `logo` এখন `/brand/logo-full.webp` (স্কয়ার আইকন নয় — রিচ রেজাল্টে নাম কাটা পড়ত)।
- **রসিদ ও পার্সেলের সবুজ** নতুন ব্র্যান্ড-সবুজে (`#06350a → #0a4d0a`), ইমেইলের বোতামও।

## 2026-11-24 — ফুটার সাইটের নিউমরফিক থিমে, আগের চেয়ে আরও উঁচু ও সাজানো

- **থিম:** গাঢ় সবুজ প্যানেল বাদ। ফুটার এখন হেডার-কার্ডগুলোর মতোই বড় একটা `neu-raised-lg` প্যানেল — একই ধূসর-নীল
  পৃষ্ঠ, সাদা হেয়ারলাইন, ডুয়াল শ্যাডো। ভেতরে মিন্ট গ্লো আর তিনটি পাতলা রিং শুধু গভীরতার জন্য।
- **লোগো:** প্যানেলে সাদা প্লেটে মালিকের পুরো লোগো (ট্যাগলাইনসহ), প্লেটও নিউমরফিক শ্যাডো পেয়েছে।
- **নিউজলেটার:** আগে প্যানেলের বাইরে আলাদা কার্ড ছিল; এখন প্যানেলের ভেতরে ব্র্যান্ড-কলামের পাশে আরও বড় কার্ড —
  আইকন, শিরোনাম, ইনসেট ইনপুট, সবুজ বোতাম আর তিনটি টিক-লাইন ("সপ্তাহে একটাই মেইল", "নতুন ছাড় আগে", "যেকোনো সময়
  আনসাবস্ক্রাইব") — ডেস্কটপে ডান কলামের ফাঁকা জায়গা আর নেই।
- **যোগাযোগ:** ফোনে ঠিকানা পুরো প্রস্থ; ফোন ও সময় পাশাপাশি; ইমেইল পুরো প্রস্থে (আগে অর্ধেক কলামে ভেঙে যেত)।
  আইকন-চিপগুলোও নিউমরফিক।
- **লিঙ্ক:** চার কলাম ডেস্কটপে পাশাপাশি, ফোনে ২×২ — নতুন বুলেট, সবুজ হোভার, `min-h-34px` টাচ টার্গেট।
- **বিশ্বাস স্ট্রিপ:** ফোনেও দেখা যায় (আগে `md`-এর নিচে লুকানো ছিল) — তিনটি রেইজড টাইল; ৭৬৮px-এ লেখা এখন
  কাটা পড়ে না, ভেঙে দুই লাইনে যায়।
- **নতুন:** ডান কলামের নিচে "আমাদের খামার পরিবার — ২৩০ পরিবার" রেইজড কাউন্টার-টাইল।
- **সোশ্যাল:** ফুটারের আইকন এখন থিমের সাদা রেইজড বৃত্তে (গাঢ় ব্যাকগ্রাউন্ডের `tone="dark"` আর ব্যবহার হচ্ছে না)।
- পেমেন্ট টাইল, আইনি লিঙ্ক ও কপিরাইট একই কাঠামোয়; ফুটার উচ্চতা ডেস্কটপে ~১৩০০px (আগে ~১৩৫০), ফোনে ~১৯১০px।

## 2026-11-24 — মালিকের দেওয়া লোগো "বিশ্বাস এগ্রো — BISHWAS AGRO" পুরো সাইটে

- **মূল ফাইল:** `assets/brand/bishwas-agro-logo.jpg` (মালিকের দেওয়া ছবি)। `node scripts/generate-brand.mjs`
  থেকেই বাকি সব তৈরি — হাতে কিছু আঁকা নয়: `public/brand/logo-full.webp` (পুরো লোগো: প্রতীক + বাংলা + ইংরেজি +
  ঢেউ + ট্যাগলাইন), `public/brand/logo-mark.webp` (বর্গ প্রতীক: পাতা, সূর্য, খামারবাড়ি, ক্ষেত), favicon, PWA আইকন,
  নোটিফিকেশন ব্যাজ ও iOS স্প্ল্যাশ। `scripts/generate-splash.mjs` এর কাজ এই স্ক্রিপ্টেই এসেছে।
- **হেডার (`components/icon-logo.tsx`):** সবুজ পাতার SVG-এর জায়গায় লোগোর প্রতীক (গোল কোণার টাইল), পাশে লোগোর
  রঙে দুই টোন "বিশ্বাস **এগ্রো**" (#06591b / #23961c) আর নিচে "BISHWAS AGRO" (AGRO কমলা #e98206)। আকার একটি
  `--logo-size` থেকেই: মোবাইল ৪০px → ৪০০px+ ৪৪px → ডেস্কটপ ৫২px; ৩২০px ফোনে লেখা ছোট হয়ে কেটে যায়, হেডার ফাটে না।
  লেখা HTML — যেকোনো মাপে ঝকঝকে, স্ক্রিন রিডারে "বিশ্বাস এগ্রো BISHWAS AGRO"।
- **হেডারের লগইন বোতাম (ফোন):** ৩৬০px-এ "লগইন" লেখার জায়গায় ৪০px গোল বোতামে শুধু অ্যাকাউন্ট-আইকন (aria-label
  অপরিবর্তিত) — নইলে লোগোর লেখা কেটে যেত; ৬৪০px+ (`sm`) থেকে আগের মতো লেখা সহ পিল। ৩২০px-এর নিচে হেডারে শুধু প্রতীক।
- **ফুটার:** সাদা গোল প্লেটে মালিকের **পুরো** লোগো (ট্যাগলাইনসহ) — গাঢ় সবুজ প্যানেলে সাদা প্লেট, লিঙ্কসহ।
- **রসিদ (`receipt-sheet.tsx`):** সবুজ ব্যান্ডের পাতার SVG-এর জায়গায় একই প্রতীক।
- **favicon/PWA:** `public/favicon.ico` (16/32/48, প্রতীক ভরাট), `icon-192/512` ও `apple-touch-icon` (গাঢ় সবুজ
  বর্গে সাদা গোল প্লেটে প্রতীক), `maskable-512` (নিরাপদ অঞ্চলের ভেতরে), `badge-72` (সাদা সিলুয়েট)।
  `public/favicon.svg` মুছে দেওয়া হয়েছে; `app/layout.tsx` ও ম্যানিফেস্ট নতুন ফাইল ব্যবহার করে।
- **স্প্ল্যাশ:** গাঢ় সবুজ গ্রেডিয়েন্টে সাদা প্লেটে পুরো লোগো; ম্যানিফেস্টের `background_color` স্প্ল্যাশের সাথে মেলে।
- সার্ভিস ওয়ার্কার `ba-v2` (প্রিক্যাশে favicon), `/brand/` মিডলওয়্যার ও ৭ দিনের ক্যাশ — `/icons/`-এর মতোই।

## 2026-11-24 — পণ্য পৃষ্ঠার বাটন একই রকম, সেলারের লোগো/ব্যানার "আমাদের খামার"-এ

- **পণ্য পৃষ্ঠা:** "কার্টে যোগ করুন" ও "এখনই অর্ডার" এখন একই আকার-উচ্চতার দুটি সমান বাটন (গোষ্ঠীভুক্ত মোবাইল সারিতে);
  আগে পরিমাণ স্টেপারের পাশে চাপা পড়ে একটি বৃত্ত, আরেকটি ডিম্বাকৃতি হয়ে যেত। মোবাইলে স্টেপার + পছন্দ এক সারিতে,
  দুটি বাটন নিচে পূর্ণ প্রস্থ।
- **"আমাদের খামার" `/farm`:** কার্ডের ছবি এখন সেলারের **ব্যানার** (না থাকলে খামারের cover), কোণায় সেলারের **লোগো**;
  সেলার-খামারের এক লাইনের বিবরণ আর দুবার (গল্প + "বিশেষত্ব") দেখায় না। ছবি না থাকলে নরম প্লেসহোল্ডার, ছবির কলাম কার্ডের
  পুরো উচ্চতা জুড়ে। কার্ড `components/farm/farmer-card.tsx`-এ আলাদা।
- **তথ্য:** `listFarms()`/`getFarmBySlug()`/`getFarmers()` এখন `sellers(slug, logo, banner)` জয়েন করে — ব্যানার
  থাকলে সেটিই cover, লোগো `farm.logo`। মাইগ্রেশন 22 না চালানো ডেটাবেসে (কলাম নেই) নিজে থেকে আগের সিলেক্টে ফেরে।
  `PATCH /api/sellers/profile` ব্যানার বদলালে সংযুক্ত `farms.cover`-ও আপডেট করে এবং `/farm`, `/live`, `/live/farms`,
  হোমপেজের ক্যাশ পরিষ্কার করে; `createFarmForSeller` ব্যানারকে cover বানায়।
- হোমপেজের লাইভ-খামার স্ট্রিপ ও `/live/farms` ডিরেক্টরির কার্ডেও খামারের নামের পাশে সেলারের লোগো।
- সেলার ড্যাশবোর্ডের খামার বাক্সের টেক্সট: "উপরের 'স্টোরের লোগো ও ব্যানার' থেকে দেওয়া ছবি এখানেও দেখা যাবে।"

## 2026-11-24 — `/lumen` সরানো, রিভিউ সাথে সাথে প্রকাশ, সেলারের লোগো/ব্যানার ও গ্যালারি আপলোড

### `/lumen` স্থায়ীভাবে বাদ

- `app/(lumen)/` ও `components/lumen/` মুছে দেওয়া হয়েছে (LumenStudio ডেমো কিট ক্যারোসেল)।
  `/lumen` এখন ৪০৪; অন্য কোথাও এর কোনো রেফারেন্স ছিল না।

### রিভিউ/রেটিং — অনুমোদন নেই, সাথে সাথে প্রকাশ

- `POST /api/reviews` (সাইটের মতামত ফর্ম) এখন সবসময় `status = published`; `reviews.auto_publish`
  সেটিং ও অ্যাডমিন সেটিংসের টগল বাদ। `POST /api/reviews/order` আগেই সরাসরি প্রকাশ করত।
- গ্রাহক মতামত দেওয়ার পর টোস্ট: "আপনার মতামত এখনই প্রকাশিত হয়েছে" (আগে ছিল "অ্যাপ্রুভালের পর দেখা যাবে")।
- অ্যাডমিন `/foisal/reviews` পেজ নতুন করে: একটাই তালিকা (অর্ডারের ভেরিফাইড রিভিউ + সাইটের মতামত),
  ফিল্টার সব/প্রকাশিত/লুকানো/১–২ তারা, রিভিউয়ারের নাম (প্রোফাইল বা লেখা নাম), ছবি, বাংলা ট্যাগ,
  সেলারের উত্তর। অ্যাকশন: **লুকান / পুনরুদ্ধার** এবং নতুন **মুছুন** (`DELETE /api/foisal/reviews?id=`,
  অডিট সহ, পণ্যের রেটিং আবার হিসাব হয়)। পুরোনো "অনুমোদনের অপেক্ষায়" সেকশন
  (`review-moderation.tsx`) ছিল ভাঙা — টেবিলে নেই এমন `is_approved`/`name_bn` কলাম পড়ত, তাই প্রতিটি রিভিউ
  "অপেক্ষমাণ" দেখাত — সেটি মুছে দেওয়া হয়েছে।

### সেলার ড্যাশবোর্ডে লোগো ও ব্যানার

- **মাইগ্রেশন `supabase/sql/22_seller_logo_banner.sql`** (চালাতে হবে): `sellers.logo`, `sellers.banner`
  কলাম + `public_sellers` ভিউ নতুন করে (দুটি কলাম সহ)। `03`/`10`/`ALL_IN_ONE`-এও যোগ, `npm run db:types` চালানো।
- `/seller` ড্যাশবোর্ডের ডান কলামে **"স্টোরের লোগো ও ব্যানার"** কার্ড: ফোনের গ্যালারি/ক্যামেরা বা
  কম্পিউটার থেকে সরাসরি আপলোড (ড্র্যাগ-অ্যান্ড-ড্রপ), উপরে স্টোর পৃষ্ঠায় কেমন দেখাবে তার প্রিভিউ,
  সেভ → `PATCH /api/sellers/profile` (শুধু নিজের সারি, অডিট সহ, `/market/[slug]` ক্যাশ পরিষ্কার)।
- `/market/[slug]`: সেলারের ব্যানার থাকলে সেটিই কভার (না থাকলে আগের মতো প্রথম খামারের ছবি), নামের পাশে
  লোগো; মার্কেটপ্লেস কার্ডেও ব্যানার + লোগো; ড্যাশবোর্ড হেডারে লোগো।
- `/api/upload` এখন **অনুমোদিত সেলারের** জন্য `product-images`, `logos`, `farm-images` বাকেটও নেয়
  (সার্ভিস রোল, ইউজার-প্রতি পাথ; AVIF স্নিফ যোগ)। নতুন বাকেট লাগে না।

### সেলারের পণ্য ছবি — গ্যালারি থেকে

- পণ্য ফর্মের "ছবির URL" ইনপুটের জায়গায় **ছবি গ্যালারি** (সর্বোচ্চ ৫টি): প্রথমটি কভার
  (`products.image`), সবগুলো `products.images`-এ পণ্য পৃষ্ঠার গ্যালারির জন্য; "কভার করুন" দিয়ে সাজানো যায়।
  মোবাইলে ট্যাপ করলেই গ্যালারি/ক্যামেরা খোলে, ডেস্কটপে ড্র্যাগ-অ্যান্ড-ড্রপ; ব্রাউজারে কমপ্রেস করে
  `/api/upload`-এ যায়, শুধু পাবলিক URL সেভ হয়।
- `sellerProductSchema.images` যোগ; POST/PATCH `/api/sellers/products` `images` সামলায় (এডিটে কভার
  বদলালে বাকিগুলো থাকে)।

## 2026-11-24 — পেমেন্ট প্রত্যাখ্যান, অর্ডার বাতিলে সেলার ক্যাসকেড, সেলার বিক্রয় ওভারভিউ

তিনটি সমস্যা একসাথে: ফেক TrxID প্রত্যাখ্যান করার উপায় ছিল না; অর্ডার বাতিল হলে
সেলারের হিসাব থেকে বিক্রয় বাদ যেত না; আর অ্যাডমিন জানতে পারত না কোন সেলারের
কত পাওনা বাকি।

### পেমেন্ট প্রত্যাখ্যান (fake TrxID)

- **`app/api/foisal/orders/route.ts`** PATCH-এ নতুন `action: "reject_payment"`:
  `payment_status = failed`, অর্ডার `cancelled`, `cancel_reason`-এ প্রশাসকের লেখা কারণ।
  যাচাই-ব্যর্থতার ফলে অর্ডার বাতিলের সব পার্শ্বপ্রতিক্রিয়া (নিচে) একসাথে চলে।
- **`components/admin/order-manager.tsx`** অর্ডার ড্রয়ারে "পেমেন্ট বাতিল (ভুল/ফেক TrxID)"
  বাটন — কারণসহ কনফার্ম ডায়ালগ, রিপোর্ট করা TrxID দেখিয়ে। পেমেন্ট ব্যাজে `failed`/`refunded`
  আলাদা রঙ, টেবিলে TrxID দেখা যায়, বাতিল অর্ডারে কারণসহ লাল নোট।
- অর্ডার বাতিলের পার্শ্বপ্রতিক্রিয়া (`lib/orders.ts` `applyOrderCancellation`):
  প্রতিটি সেলারের `sub_orders` → `cancelled` (বিক্রয় থেকে বাদ), চেকআউটে রিজার্ভ করা স্টক
  ফেরত, কুপনের `used_count` ফেরত, গ্রাহক ও সংশ্লিষ্ট সেলারদের নোটিফিকেশন। সব পদক্ষেপ
  idempotent — বাতিল অর্ডারে আবার চালালে কিছু ঘটে না।

### অর্ডারের স্টেটাস সেলার পর্যন্ত

- অর্ডার `received → packing → shipped → delivered` করলে সেলারদের `sub_orders.status`
  একইভাবে আপডেট হয় (আগে শুধু `delivered`-এ হতো)। `cancelled` হলে উপরের ক্যাসকেড।
- অর্ডার বাতিল এখন এক ক্লিকে নয় — কারণ লিখে কনফার্ম করতে হয়; কারণ গ্রাহক ও সেলার দেখতে পায়।

### সেলার ড্যাশবোর্ড

- বাতিল অর্ডার হিসাব (মোট আয়/গ্রস/কমিশন) থেকে বাদ, তালিকায় "বাতিল (হিসাবে নেই)" গণনা।
- অর্ডারের স্টেটাস (গৃহীত/প্যাকিং/ডেলিভারির পথে/সম্পন্ন) প্রতিটি লাইনে।
- `lib/sellers.ts` মার্কেটপ্লেস পরিসংখ্যান থেকেও বাতিল সাব-অর্ডার বাদ।

### নতুন: `/foisal/seller-sales` — সেলার বিক্রয় ও পেমেন্ট

- ন্যাভ "মার্কেটপ্লেস → বিক্রয় ও পেমেন্ট" (`payouts.read`)। প্রতি সেলার: কত অর্ডার ডেলিভারি হয়েছে
  (বিক্রয়), কত পেন্ডিং, ডেলিভারিভুক্ত আয় থেকে পরিশোধিত বাদ দিয়ে **প্রদেয়**, না-ডেলিভারি অর্ডারের
  **বন্দী অর্থ**, লাইভ/পেন্ডিং পণ্যের সংখ্যা। ক্লিক করলে সাম্প্রতিক সাব-অর্ডার ও পণ্যের তালিকা, CSV।
- সবটুকু বিদ্যমান টেবিলের উপর read-only অ্যাগ্রিগেশন — কোনো স্কিমা পরিবর্তন নেই।

### যাচাই

- `npm run typecheck` → ০ এরর · `npm run lint` → ০ এরর · `npm run db:columns` → মিল
- `npm run build` → সব রুট বিল্ড · প্রোডাকশন সার্ভারে `/foisal/seller-sales`, `/foisal/orders`,
  `/seller`, `/foisal/sellers` → ২০০

## 2026-11-23 — ডেটাবেস লেয়ার সম্পূর্ণ নতুন করে (Supabase SQL v2)

পুরোনো ১৮টি মাইগ্রেশন, সিড আর স্ক্রিপ্ট-জেনারেটর মুছে ফেলে ডেটাবেসটা একটা
নম্বরযুক্ত, হাতে-চালানো SQL সেটে রূপান্তর করা হয়েছে। **অ্যাপ আর স্কিমার মধ্যে
কোনো অপ্রকাশিত পার্থক্য নেই** — `lib/database.types.ts` এখন `supabase/sql/`
থেকে জেনারেট হয়, আর `npm run db:columns` কোডের প্রতিটি কলাম নাম স্কিমার সাথে
মিলিয়ে দেখে।

### নতুন করে যা যোগ হলো

**`supabase/sql/` — ১৪টি ফাইল (ক্রম মেনে SQL Editor-এ চালাতে হবে)**

| ফাইল | সারমর্ম |
|---|---|
| `00_RESET_ALL_DANGEROUS.sql` | সব অ্যাপ অবজেক্ট ড্রপ (auth.users-কে স্পর্শ করে না) |
| `01_extensions_and_enums.sql` | `pgcrypto`, `pg_trgm`, ৩০টি enum, `set_updated_at()` |
| `02_core_tables.sql` | ১২টি কোর টেবিল |
| `03_catalog_tables.sql` | ক্যাটালগ, খামার, ক্যামেরা, সেলার, কুপন, ডেলিভারি |
| `04_orders_payments_tables.sql` | কার্ট → অর্ডার → পেমেন্ট → পার্সেল |
| `05_premium_reviews_tables.sql` | প্রিমিয়াম, রিভিউ, অভিযোগ, নোটিফিকেশন |
| `06_homepage_cms_tables.sql` | হোমপেজ সেকশন, ব্যানার, মেনু, ব্লগ, FAQ |
| `07_functions_and_triggers.sql` | RLS হেল্পার, `place_order()`, `approve_payment()`, ট্রিগার |
| `08_rls_policies.sql` | ৬০টি টেবিলে RLS পলিসি |
| `09_storage_buckets_and_policies.sql` | ১১টি বাকেট + গার্ড + পলিসি |
| `10_indexes_and_views.sql` | ইনডেক্স + ১১টি ভিউ |
| `11_seed_sample_data.sql` | ঐচ্ছিক ডেমো ডেটা |
| `12_make_admin.sql` | একটি ইমেইলকে অ্যাডমিন বানায় |
| `13_verify_setup.sql` | রিড-অনলি PASS/FAIL চেক (১৮২টি চেক) |
| `ALL_IN_ONE.sql` | `01`–`10` একসাথে (রিসেট/সিড/অ্যাডমিন ছাড়া) |

### মুছে ফেলা ফাইল (৩০টি)

```
data/seed.mjs
lib/seed-data.ts
lib/seed-premium.ts
scripts/generate-catalogue-sql.mjs
scripts/migrate.mjs
scripts/seed.mjs
scripts/seed-sql.mjs
scripts/seed-premium-sql.mjs
supabase/admin.sql
supabase/seed.sql
supabase/seed-premium.sql
supabase/seed/catalogue.sql
supabase/migrations/0001_init.sql
supabase/migrations/0002_otp.sql
supabase/migrations/0003_premium_multivendor.sql
supabase/migrations/0004_profiles_auth_rls.sql
supabase/migrations/0005_reviews_complaints.sql
supabase/migrations/0006_seo_content.sql
supabase/migrations/0007_cms_team_security.sql
supabase/migrations/0008_security_hardening.sql
supabase/migrations/0009_manual_payments_content.sql
supabase/migrations/0010_realtime_admin.sql
supabase/migrations/0011_auth_rebuild.sql
supabase/migrations/0012_login_help.sql
supabase/migrations/0013_announcement_and_admin.sql
supabase/migrations/0014_service_role_grants.sql
supabase/migrations/0015_schema_alignment.sql
supabase/migrations/0016_checkout_storage_and_admin_gaps.sql
supabase/migrations/0017_status_vocabulary.sql
supabase/migrations/0018_rls_hardening_and_payments.sql
```

পুরোনো `npm run db:migrate` / `db:seed` স্ক্রিপ্টগুলো সরানো হয়েছে — ডেটাবেস
শুধু SQL Editor দিয়ে বদলানো হয়, প্রোগ্রাম দিয়ে নয়।

### নতুন করে তৈরি টেবিল (৬০টি)

```
access_codes            addresses               audit_log              banners
blog_posts              camera_requests         camera_view_logs       cameras
cart_items              categories              combo_items            combos
complaint_messages      complaints              contact_messages       coupons
custom_combos           delivery_charges        faq_items              farms
fcm_tokens              hero_slides             homepage_sections      login_attempts
media_assets            menu_items              menus                  newsletter_subscribers
notifications           order_items             orders                 parcels
payment_logs            payment_methods         payments               plans
premium_devices         product_images          products               profiles
push_subscriptions      recently_viewed         review_photos          review_tags
reviews                 seller_payouts          seller_warnings        sellers
seo_meta                site_settings           social_links           static_pages
stream_tokens           sub_orders              subscription_plans     subscriptions
team_members            trials                  user_subscriptions     wishlist
```

পুরোনো নাম → নতুন নাম (কোড সর্বত্র আপডেট করা হয়েছে):

| পুরোনো | নতুন |
|---|---|
| `users` | `profiles` |
| `settings` | `site_settings` |
| `delivery_zones` | `delivery_charges` |
| `cms_pages` | `static_pages` |
| `audit_logs` | `audit_log` |
| `wishlists` | `wishlist` |
| `order_reviews` | `reviews` (`status = 'published'`) |
| `premium_plans` | `plans` |
| `premium_subscriptions` | `user_subscriptions` |
| `premium_access_codes` | `access_codes` |
| `trial_grants` | `trials` |
| `stream_sessions` | `stream_tokens` |
| `packages` | `subscription_plans` |
| `team_directory` (টেবিল) | `team_members` + `v_team_members` ভিউ |
| bucket `catalog-media` | `product-images`, `blog-images` |

### নতুন ফাংশন / ট্রিগার / ভিউ / বাকেট

- **RPC**: `place_order`, `approve_payment`, `login_help`, `is_admin`, `is_staff`,
  `is_seller`, `has_role`, `is_my_seller`, `recalc_product_rating`, `log_audit`,
  `gen_order_no`, `gen_payment_no`, `sync_product_images`, `set_complaint_ticket`,
  `handle_new_user`, `guard_profile_role`
- **ট্রিগার**: `on_auth_user_created`, `trg_guard_profile_role`, `trg_reviews_recalc`,
  `trg_product_images_sync`, `trg_review_photos_sync`, `trg_complaint_ticket`,
  প্রতিটি টেবিলে `updated_at`
- **ভিউ**: `public_sellers`, `public_cameras`, `v_team_members`,
  `v_product_rating_breakdown`, `v_product_supplier`, `v_supplier_quality`,
  `v_farm_stats`, `v_payment_queue`, `v_payment_reconciliation`,
  `v_premium_revenue`, `v_seller_leaderboard`
- **বাকেট (১১)**: `avatars`, `product-images`, `category-images`, `farm-images`,
  `logos`, `slides`, `team`, `review-photos`, `complaint-photos`, `blog-images`,
  `payment-proofs` (private)

### কোডে যা বদলাল

- **রিড ফ্যাসাড** `lib/data.ts` পুরো নতুন করে লেখা: কোনো সিড ফলব্যাক নেই; ডেটাবেস
  না থাকলে বা কুয়েরি ফেল করলে `safe()` খালি তালিকা/`null` ফেরায়, পাবলিক পেজ
  কখনো এরর দেখায় না।
- **চেকআউট** `lib/orders.ts` এখন শুধু `place_order()` RPC ডাকে — দাম, স্টক, কুপণ,
  ডেলিভারি, সাব-অর্ডার, পেমেন্ট রো, পার্সেল ও নোটিফিকেশন এক ট্রানজ্যাকশনে।
  পুরোনো dual-dialect ইনসার্ট (যে `tracking_id`, `items`, `note`, `email` কলাম
  লাগাত) সম্পূর্ণ বাদ।
- **পেমেন্ট অনুমোদন** `lib/manual-payments.ts` → `approve_payment()` RPC; reject/
  needs_info আগের মতোই (কোনো টাকা নড়ে না)। `settleOrder`/`activatePremium`
  ডুপ্লিকেট কোড মুছে ফেলা হয়েছে।
- **নোটিফিকেশন** `notify()`-এ `storeInApp` অপশন — RPC যে ইন-অ্যাপ রো লিখেছে
  সেখানে আবার লেখা হয় না, শুধু push/email/SMS ফ্যান-আউট হয়।
- **অ্যাডমিন CRUD** `app/api/foisal/[resource]/route.ts` নতুন টেবিল ম্যাপে
  (`menus`, `static-pages` যোগ, `dbDynamic()` দিয়ে ডাইনামিক টেবিল)।
- **সিস্টেম চেক** `app/api/foisal/system-check/route.ts` এখন `13_verify_setup.sql`-এর
  অ্যাপ-সংস্করণ (৬০ টেবিল, ১১ ভিউ, ৩ RPC, ১১ বাকেট, write probe, অ্যাডমিন)।
- **টাইপ** `lib/database.types.ts` জেনারেটেড (৬০ টেবিল, ১১ ভিউ, ২০ ফাংশন, ২৭ enum)।
- **এরর বাউন্ডারি**: রুট `not-found`/`error` এবং `/foisal`-এর নিজস্ব
  `error`/`loading`/`not-found` যোগ — সব বাংলায়, কোনো স্ট্যাক ট্রেস নেই।
- **নতুন স্ক্রিপ্ট**: `db:types` (PGlite থেকে টাইপ), `db:check` (সব SQL দুবার চালিয়ে
  যাচাই + `13`-এর FAIL), `db:columns` (কোড ↔ স্কিমা কলাম মিল), `verify` (সব একসাথে)।

### ব্রেকিং (মাইগ্রেশন করতে হলে)

1. পুরোনো `supabase/migrations/*` চালানো **বন্ধ** করুন — ফাইলগুলো আর নেই।
2. নতুন প্রজেক্ট: `01` → `11` (চাইলে), `12`, `13`।
3. পুরোনো লাইভ ডেটা থাকলে: ব্যাকআপ নিন, তারপর `00` → `13`। `orders`-এ
   `tracking_id`/`items`/`note` কলাম আর নেই; ট্র্যাকিং `order_no` + `customer_phone`।
4. `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` নাম দুটো এখনো
   ফলব্যাক হিসেবে কাজ করে, তবে নতুন নাম (`…_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`)
   ব্যবহার করাই ভালো।

### যাচাই (এই রিলিজে চালানো হয়েছে)

- `npm run typecheck` → ০ এরর · `npm run lint` → ০ এরর
- `npm run build` → সব ১৬২ রুট বিল্ড
- `npm run db:check` → ০১–১৩ দুবার করে চালিয়ে ০ এরর; `13_verify_setup` → ১৮২ চেক,
  ০ FAIL, ০ WARN; `00` → পাবলিক স্কিমা খালি, আবার চালানো যায়
- `npm run db:columns` → ৭১ টেবিল/ভিউ, প্রতিটি কলাম মিল
- `npm run security` → ০ ফাইন্ডিং · `npm run budget` → ০ রুট বাজেটের বাইরে
