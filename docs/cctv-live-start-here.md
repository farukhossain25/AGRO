# CCTV লাইভ — এখান থেকে শুরু করুন (এক পেজের চেকলিস্ট)

**এই ডকে যা আছে:** Imou ক্যামেরা কিনে আপনার ওয়েবঅ্যাপে লাইভ দেখাতে ঠিক কী কী করতে হবে —
ক্রম অনুযায়ী, কোনটা আগে, কোনটা পরে। আর কোথায় কোড বদলাতে হবে (প্রায় কোথাও না)।

**রেকর্ডিং কোথাও নেই** — `mediamtx.yml`-এ `record: false`। শুধু লাইভ।

---

## ০. এক নজরে: কোড বদলাতে হবে কি?

| কাজ | কোড বদল? | কেন |
|---|---|---|
| Imou ক্যামেরা কিনে অ্যাপে যোগ করা | ❌ না | ফোনের অ্যাপেই হয় |
| Imou ক্লাউড পথে ওয়েবঅ্যাপে দেখানো | ❌ না | কোড আগেই লেখা (`lib/camera-cloud.ts`, `/api/cam/*`, `CloudPlayer`) |
| VPS পথে (RTSP → MediaMTX) দেখানো | ❌ না | কোড আগেই লেখা (`/api/stream/*`, `Caddyfile`) |
| ক্যামেরা সাইটে যোগ করা | ❌ না | `/foisal/cameras` ফর্মে হয় |
| Vercel-এ env বসানো + redeploy | ❌ না (শুধু সেটিংস) | Environment Variables |
| `mediamtx.yml`-এ ক্যামেরার লাইন | ❌ না (কনফিগ ফাইল) | একটা YAML এন্ট্রি |
| **পুরো প্রিমিয়াম/ট্রায়াল সিস্টেম** | ❌ না | আগেই আছে — ১০ মিনিট ট্রায়াল, সাবস্ক্রিপশন, ৫০ জন ক্যাপ |

> **সংক্ষেপে: দুটো পথেই কোড চেঞ্জ লাগবে না।** আমি শুধু তখন কোড ছোঁবো যদি টেস্টে
> এমন কিছু বের হয় যা এখনো সাপোর্ট করে না — তখন আগে আপনাকে বলব, অনুমতি নিয়ে করব।

---

## ১. 🔴 প্রথমে ৫ মিনিটের ফ্রি টেস্ট (এটা না করলে টাকা নষ্ট হতে পারে)

**ক্যামেরা কেনার আগেও করা যায় — আপনার পুরোনো Dahua XVR দিয়ে।**

1. ফোনে **VLC** ইনস্টল করুন (Play Store)
2. **ফোনের WiFi বন্ধ করুন**, মোবাইল ডাটা চালু রাখুন
3. VLC → Stream → এই লিংক দিন:
   ```
   rtsp://admin:<পাসওয়ার্ড>@<ক্যামেরার-IP>:554/cam/realmonitor?channel=1&subtype=1
   ```
4. ছবি আসছে?

| ফলাফল | মানে | কোন পথে যাবেন |
|---|---|---|
| ✅ ছবি আসে | ISP আপনাকে **public IP** দিয়েছে | **পথ ক** (ক্যামেরা + VPS) |
| ❌ আসে না | **CGNAT** — বাইরে থেকে ঢোকা যায় না | **পথ খ** (শুধু ক্যামেরা, Imou ক্লাউড) |

> এটাই একমাত্র প্রশ্ন যেটা আপনার পুরো প্ল্যান ঠিক করে দেয়। বাকি সব এর পরে।

---

## ২. সব ক্ষেত্রেই যা করবেন (ক্যামেরা লাগবে)

### ২.১ ক্যামেরা কিনুন
**Imou Bullet 2E (`IPC-F42F`)** — ৳২,৯২০–৩,৬৯০, IP67 (বাইরে/শেডে চলবে)
আরও অপশন: Ranger 2 ৳১,৯৮৫–২,৫৫০ (ঘরের ভেতর) · Cue2C ৳২,৫০০
❌ কিনবেন না: Tapo, Xiaomi (ক্লাউড API নেই) · Ranger RC, Cell Go, Cruiser Dual (RTSP সমস্যা)

### ২.২ Imou Life অ্যাপে যোগ করুন (শুধু ফোন)
1. অ্যাপ ইনস্টল → ক্যামেরা যোগ → WiFi (২.৪ GHz) → ডিভাইস পাসওয়ার্ড দিন
2. **Safety Code** লিখে রাখুন — এটাই RTSP-এর পাসওয়ার্ড
3. **RTSP চালু করুন:** ডিভাইস → সেটিংস → অ্যাডভান্সড → **RTSP/ONVIF** → চালু
4. অ্যাপে লাইভ খুলে দেখুন — ছবি আসছে তো?

### ২.৩ ক্যামেরার IP বের করুন
Imou Life → ডিভাইস → সেটিংস → ডিভাইস ইনফো → **IP Address** (যেমন `192.168.0.108`)
> WiFi রাউটারের DHCP-তে ক্যামেরাটাকে **fixed IP** বেঁধে দিন, নাহলে IP বদলে গেলে আবার কনফিগ করতে হবে।

---

## ৩. 🟢 পথ ক — public IP আছে (ক্যামেরা + VPS, মাসিক ৳০–১,২০০)

**এই পথেই সবচেয়ে ভালো:** ২৪/৭ প্রিমিয়াম সম্ভব, কতজন দেখল তাতে খরচ বাড়ে না।

### ধাপ ১ — রাউটারে পোর্ট খুলুন
- রাউটারের অ্যাডমিন প্যানেল → Port Forwarding
- `External 554 → Internal 192.168.0.108:554` (TCP)
- টেস্ট: **মোবাইল ডাটা** দিয়ে VLC-তে `rtsp://admin:<safetycode>@<public-IP>:554/cam/realmonitor?channel=1&subtype=1`
- 554 ব্লক থাকলে বাইরের পোর্ট `1554` দিয়ে ম্যাপ করুন, URL-এ `:1554` দিন

> হোস্টনেম ব্যবহার করলে DDNS (No-IP/DuckDNS) সেট করুন — public IP সাধারণত বদলায়।

### ধাপ ২ — VPS নিন
- **Oracle Cloud Always Free** আগে চেষ্টা করুন (৳০, ১০ TB/মাস)
- না পেলে Hetzner/Contabo/DigitalOcean ~$৫ (৳৭০০–১,২০০)
- ⚠️ কেনার আগে **মাসিক ট্রান্সফার কোটা** দেখুন — ১ TB মানে ২৪/৭ মাত্র ৬ জন

### ধাপ ৩ — VPS-এ স্ট্যাক চালু
```bash
ssh root@<VPS-IP>
apt update && apt install -y docker.io docker-compose-plugin git
git clone https://github.com/farukhossain25/AGRO.git && cd AGRO
```

`.env` ফাইল (repo রুটে):
```bash
STREAM_PUBLIC_HOST=stream.yourdomain.com
STREAM_EDGE_SECRET=ইচ্ছামতো_১৬_অক্ষর
ACME_EMAIL=you@yourdomain.com
```

`mediamtx.yml`-এর `paths:` নিচে ক্যামেরা যোগ করুন:
```yaml
  farm-savar-01:
    source: rtsp://admin:<SAFETY-CODE>@<PUBLIC-IP>:1554/cam/realmonitor?channel=1&subtype=1
    sourceOnDemand: true
```

চালু:
```bash
docker compose -f docker-compose.stream-vps.yml --profile public up -d
docker ps                      # ba-mediamtx আর ba-caddy চালু?
docker logs ba-caddy --tail 20 # সার্টিফিকেট এসেছে?
```

### ধাপ ৪ — Vercel env → **Redeploy**
| নাম | মান |
|---|---|
| `STREAM_PUBLIC_BASE` | `https://stream.yourdomain.com/live-<EDGE_SECRET>` |
| `STREAM_PROXY_TARGET` | `https://stream.yourdomain.com/health-<EDGE_SECRET>` |
| `STREAM_TOKEN_SECRET` | লম্বা র‍্যান্ডম স্ট্রিং |

### ধাপ ৫ — সাইটে ক্যামেরা যোগ
`/foisal/cameras` → নতুন:
| ফিল্ড | মান |
|---|---|
| স্ট্রিম সোর্স | **MediaMTX / RTSP (ভিপিএস লাগবে)** → `none` |
| Stream key | `farm-savar-01` (YAML-এর নামের সাথে হুবহু) |
| প্রোটোকল | HLS |

### ধাপ ৬ — টেস্ট
সাইটে `/live/farms/<খামার>` → লাইভ খুলুন → **VPS-এ `vnstat -m`** দেখে ট্রাফিক বাড়ছে কি না

---

## ৪. 🔵 পথ খ — CGNAT (শুধু ক্যামেরা, VPS লাগবে না)

**VPS কিনবেন না।** এখানে VPS ক্যামেরা পর্যন্ত পৌঁছাতেই পারে না।
খরচ: ভিডিওর জন্য Imou-কে ~৳৭/দর্শক-ঘণ্টা।

### ধাপ ১ — Imou ডেভেলপার অ্যাকাউন্ট (ফ্রি)
1. <https://open.imoulife.com> → Register — **Imou Life অ্যাপের একই লগইন** দিয়ে
2. Console → **My App** → App Information → Edit → Save
3. **AppId** আর **AppSecret** কপি করুন

### ধাপ ২ — ডাটাবেস (একবার)
Supabase → SQL Editor → `supabase/sql/24_camera_cloud_bridge.sql` চালান
(এটা `cameras`-এ `cloud_provider`, `cloud_serial`, `cloud_channel` যোগ করে)

### ধাপ ৩ — Vercel env → **Redeploy**
| নাম | মান |
|---|---|
| `IMOU_APP_ID` | AppId |
| `IMOU_APP_SECRET` | AppSecret |
| `IMOU_API_HOST` | `https://openapi-sg.easy4ip.com` |
| `IMOU_STREAM_ID` | `1` (SD — মোবাইল ডাটায় হালকা) |

### ধাপ ৪ — সাইটে ক্যামেরা যোগ
`/foisal/cameras` → নতুন:
| ফিল্ড | মান |
|---|---|
| স্ট্রিম সোর্স | **Imou Life অ্যাপ** → `imou` |
| ডিভাইস সিরিয়াল | Imou Life-এ **Device ID** |
| চ্যানেল | `0` (একক ক্যামেরায় সবসময় ০) |

### ধাপ ৫ — টেস্ট
Imou Life অ্যাপে একবার লাইভ খুলুন (ক্যামেরা জাগাতে), তারপর সাইটে লাইভ দেখুন
`https://open.imoulife.com` → Console-এ **ফ্লো (GB)** কত খরচ হচ্ছে দেখতে পাবেন

---

## ৫. দুই পথেই যা আগেই তৈরি আছে (আপনাকে কিছু করতে হবে না)

- **১০ মিনিট ফ্রি ট্রায়াল** — `/api/premium/trial`
- **প্রিমিয়াম সাবস্ক্রিপশন** — কোড/পেমেন্ট পেলে ৩০ দিন
- **৫ মিনিটের সাইন করা টোকেন** — সাবস্ক্রিপশন বাতিল হলে ৫ মিনিটে ছবি বন্ধ
- **৫০ জন দর্শক ক্যাপ** — `/api/cam/token` ও `/api/stream/token` দুটোতেই
- **ভিডিও Vercel-এর ভেতর দিয়ে যায় না** — `STREAM_PUBLIC_BASE` সেট করলেই
- **কোনো রেকর্ডিং নেই** — `record: false`

---

## ৬. খরচের সারি

| জিনিস | পথ ক (public IP) | পথ খ (CGNAT) |
|---|---|---|
| Imou Bullet 2E | ৳২,৯২০–৩,৬৯০ (একবার) | ৳২,৯২০–৩,৬৯০ (একবার) |
| VPS | ৳০ (Oracle) / ৳৭০০–১,২০০ | **৳০** |
| Imou ক্লাউড | ৳০ | ~৳৭/দর্শক-ঘণ্টা |
| ২০ জন × ৩০ মিন/দিন | ৳০–১,২০০ | ~৳২,০৫০ |
| ISP public IP | ৳০–১,২০০ (সাধারণত ফ্রি) | — |

---

## ৭. পরের ধাপ

1. **আজ:** VLC টেস্ট করুন (ধাপ ১) — কোন পথ, সেটা জানা যাবে
2. **কাল:** ক্যামেরা অর্ডার করুন
3. টেস্টের ফল আমাকে বলুন — পথ ক না খ, সেই অনুযায়ী বাকি ধাপগুলো ধরে ধরে করে দেব
