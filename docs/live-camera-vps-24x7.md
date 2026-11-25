# XVR/CCTV → ওয়েবঅ্যাপ লাইভ: ২৪/৭ কৌশল (কোনো রেকর্ডিং নেই)

**আপনার চাহিদা:** DMSS অ্যাপে যেভাবে দূর থেকে দেখেন, ঠিক সেভাবে ওয়েবঅ্যাপেও দেখবেন।
**রেকর্ডিং নেই** — VPS কিছু সেভ করবে না, শুধু লাইভ স্ট্রিম রিলে করবে।
**২৪/৭** চালু, প্রিমিয়াম নিলে ৩০ দিন টানা দেখা যাবে।

---

## ১. আগে একটা কঠিন সত্য — আপনার XVR দিয়ে এটা হবে না

| পথ | ফলাফল | কারণ |
|---|---|---|
| XVR-এর RTSP | ❌ | ফার্মে **CGNAT** (shared IP) — বাইরে থেকে ঢোকা যায় না |
| XVR নিজে push | ❌ | DH-XVR1B16-I-এ **RTMP নেই** (ডেটাশিট: কেবল RTSP/P2P) |
| Imou ক্লাউডে যোগ | ❌ | `Error1000` — Imou Dahua-ব্র্যান্ডের রেকর্ডার লিংক করে না |
| DMSS P2P | ❌ | শুধু DMSS অ্যাপের ভেতরে, কোনো API নেই |

**সিদ্ধান্ত:** ওয়েবঅ্যাপে লাইভের জন্য **Imou ক্যামেরা** লাগবে (৳২,৯২০ থেকে Bullet 2E)।
ভালো দিক: **Imou-তে লোকাল RTSP আছে** — `rtsp://admin:<safety code>@<cam-ip>:554/cam/realmonitor?channel=1&subtype=0`

---

## ২. যে সমসya VPS সমাধান করে

Imou ক্লাউড পথে **প্রতি দর্শকের** ট্রাফিক বিল হয় (২ GB/মাস ফ্রি, তারপর $0.25/GB)।
২৪/৭ ৫০ জন দর্শক = **৳২,৪১,১৯৯/মাস** 😱

VPS পথে: ক্যামেরা → VPS **একবার** টানেন → VPS থেকে সবাই দেখে।
**খরচ স্থির, দর্শক বাড়লে বাড়ে না।**

| একসাথে ২৪/৭ | Imou ক্লাউড | VPS |
|---|---|---|
| ১০ জন | ৳৪৮,১৯১ | ৳০–১,২০০ |
| ৫০ জন | ৳২,৪১,১৯৯ | ৳০–১,২০০ |

---

## ৩. ভিপিএস কোথায় নেবেন — ৩টা অপশন

### 🥇 অপশন ১: আপনার ISP-তে real IP — ৳০/মাস
বাংলাদেশে অনেক ISP **ফ্রিতে public IP** দেয় (যেমন DFN Internet ডিফল্টে দেয়)।
ISP-কে বলুন: *"আমি CCTV বাইরে থেকে দেখতে চাই, real public IP দরকার — ফ্রি হয় কি?"*
পেলে **VPS-ও লাগবে না** — ক্যামেরার RTSP সরাসরি Vercel থেকে টানা যাবে না, তাই মাঝখানে
এकটা পুরোনো ফোন/রাউটার দিয়ে MediaMTX চালালেই হবে (তবে ফার্মে ২৪/৭ কিছু চালু রাখতে হবে — আপনি চান না)।

### 🥈 অপশন ২: Oracle Cloud Always Free — ৳০/মাস, ১০ TB/মাস
- ২ OCPU + ১২ GB ARM + **১০ TB egress ফ্রি — চিরকাল**
- ২৪/৭ ৫১২ kbps-এ **~৬৫ জন একসাথে** চলবে
- ⚠️ সাইনআপ কঠিন (কার্ড + fraud filter), capacity প্রায়ই "out of host capacity"
- ⚠️ ARM — MediaMTX-এর ARM ইমেজ আছে ✅

### 🥉 অপশন ৩: সাধারণ paid VPS — ৳৭০০–১,২০০/মাস
- ১–২ GB RAM, ৪ TB egress — যথেষ্ট
- সাইনআপ সহজ, নির্ভরযোগ্য, ২৪/৭
- সবচেয়ে কম ঝামেলা

> **আমার পরামর্শ:** তাড়া না থাকলে Oracle চেষ্টা করুন (ফ্রি)। কাজের জন্য দরকার হলে
> ৳১,২০০/মাসের VPS নিন — এটা তোমার প্রিমিয়াম থেকে আসবে, তাই মোটামুটি সহজ।

---

## ৪. VPS সেটআপ (কপি-পেস্ট ধাপ)

### ধাপ ১ — VPS-এ Docker + repo
```bash
ssh root@<VPS-IP>
apt update && apt install -y docker.io docker-compose-plugin git
git clone https://github.com/farukhossain25/AGRO.git && cd AGRO
```

### ধাপ ২ — `mediamtx.yml`-এ ক্যামেরা যোগ
```yaml
paths:
  farm-savar-01:
    source: rtsp://admin:<SAFETY-CODE>@<CAM-IP>:554/cam/realmonitor?channel=1&subtype=1
    sourceOnDemand: true
```
- `subtype=1` = সাব-স্ট্রিম (হালকা, মোবাইলে ভালো) · `subtype=0` = HD
- নিরাপত্তার জন্য `publishUser`/`publishPass` বদলান

> ✅ `record: false` আগেই আছে — **কিছুই ডিস্কে সেভ হবে না**।

### ধাপ ৩ — Cloudflare Tunnel (পোর্ট খোলার দরকার নেই)
1. Cloudflare → Zero Trust → Networks → Tunnels → Create
2. টোকেনটা VPS-এ `.env`-এ: `CF_TUNNEL_TOKEN=...`
3. Public Hostname: `stream.yourdomain.com` → `http://caddy:8080`
4. চালু করুন:
```bash
docker compose -f docker-compose.stream-vps.yml --profile tunnel up -d
```

### ধাপ ৪ — Vercel env
```
STREAM_PROXY_TARGET = https://stream.yourdomain.com
STREAM_PROXY_SECRET = <লম্বা র‍্যান্ডম স্ট্রিং>
STREAM_PUBLIC_BASE  = https://stream.yourdomain.com   # ← ভিডিও Vercel bypass করবে
```

> ### ⚠️ এই লাইনটাই সবচেয়ে জরুরি (খরচের জন্য)
>
> `STREAM_PUBLIC_BASE` সেট না করলে **প্রতিটা ভিডিও বাইট Vercel-এর ভেতর দিয়ে যায়**।
> Vercel Pro: ১ TB ফ্রি, তারপর **$0.15/GB**।
>
> | দৃশ্যপট | ভিডিও/মাস | Vercel বিল |
> |---|---|---|
> | ১০ জন প্রিমিয়াম ২৪/৭ | ১,৫০৯ GB | **$৭৩ ≈ ৳৮,৮৭১** |
> | ৫০ জন প্রিমিয়াম ২৪/৭ | ৭,৫৪৪ GB | **$৯৭৮ ≈ ৳১,১৯,৩১১** |
>
> `STREAM_PUBLIC_BASE` সেট করলে ভিডিও **সরাসরি VPS থেকে** যায় → Vercel বিল **৳০**।
> টোকেন একই থাকে (৫ মিনিটের সাইন করা), তাই নিরাপত্তা কমে না।

#### Caddy-কে টোকেন যাচাই করতে বলুন (নিরাপত্তার জন্য)
`Caddyfile`-এ stream host-এর জন্য:
```caddyfile
stream.yourdomain.com {
    # token ছাড়া কোনো HLS রিকোয়েস্ট নয়
    @noToken not query t=*
    respond @noToken "unauthorized" 401

    # MediaMTX-এর HLS. root path: /<key>/index.m3u8  → /hls/<key>/index.m3u8
    handle_path /hls/* {
        reverse_proxy mediamtx:8888
    }
}
```
> MediaMTX ডিফল্টে HLS `/<key>/index.m3u8`-এ দেয়, তাই `handle_path /hls/*` দিয়ে
> প্রিফিক্স কেটে দিলেই আমাদের কোডের URL-এর সাথে মিলে যাবে।

### ধাপ ৫ — অ্যাডমিন প্যানেলে ক্যামেরা
`/foisal/cameras` → নতুন ক্যামেরা:

| ফিল্ড | মান |
|---|---|
| স্ট্রিম সোর্স | **MediaMTX / RTSP** (`cloud_provider = none`) |
| Stream key | `farm-savar-01` (mediamtx.yml-এর path নাম) |
| Protocol | HLS |

### ধাপ ৬ — যাচাই
```bash
curl -s -o /dev/null -w '%{http_code}\n' https://stream.yourdomain.com/hls/farm-savar-01/index.m3u8
# 403 = ঠিক আছে (proxy secret ছাড়া বন্ধ)
```
তারপর সাইটে ক্যামেরা পেজ খুলুন → "লাইভ দেখুন" → ছবি আসা উচিত।

---

## ৫. প্রিমিয়াম প্ল্যান: ৩০ দিন ২৪/৭

আপনার চাওয়া: *"কে প্রিমিয়াম কিনলে সে ৩০ দিন ২৪/৭ দেখতে পারবে"* — **হ্যাঁ, সম্ভব।**

- `/api/stream/token` ইতিমধ্যেই **সাবস্ক্রিপশন/ট্রায়াল** দেখে সিদ্ধান্ত নেয়
- ৫ মিনিটের সাইন করা টোকেন — মেয়াদ শেষে প্লেয়ার নিজেই নতুন নেয়
- সাবস্ক্রিপশন বাতিল হলে **৫ মিনিটের মধ্যে** ছবি বন্ধ (খুবই ভালো)
- **দর্শক-সীমা** `cameras.max_viewers` (ডিফল্ট ৫০) — একই ক্যামেরা বেশি ফোনে খুললে 429

> ⚠️ **VPS প্ল্যানে দর্শক-সীমা রাখা দরকার** — CPU/RAM/ব্যান্ডউইথের সীমা আছে। ৫০-এ
> রাখলে ভালো; ৫,০০০ ইউজার হলে সবাই একসাথে নয়, পালা করে আসবে।

---

## ৬. প্রতিদিন যা দেখতে হবে (৫ মিনিট)

| চেক | কোথায় |
|---|---|
| VPS বেঁচে আছে? | `docker ps` — `ba-mediamtx` চালু |
| ট্রাফিক কত? | VPS dashboard / Cloudflare analytics |
| ক্যামেরা অনলাইন? | সাইটে লাইভ খুলে দেখুন |
| ডিস্ক ভরছে? | ভরবে না (`record: false`), তবে `df -h` একবার দেখে নিন |

---

## ৭. খরচের সারসংক্ষেপ

| খরচ | পরিমাণ |
|---|---|
| Imou Bullet 2E ক্যামেরা (একবার) | ৳২,৯২০–৩,৫০০ |
| Oracle Free VPS | **৳০/মাস** |
| অথবা paid VPS | ৳৭০০–১,২০০/মাস |
| Imou ক্লাউড | **লাগবে না** (কোনো API কল নেই) |
| রেকর্ডিং স্টোরেজ | **৳০** (বন্ধ) |

**মাসিক খরচ: ৳০–১,২০০** — এবং কতজন দেখল তাতে বাড়ে না।

---

## ৮. যা এখনো করতেই হবে
- [ ] ISP-কে real IP জিজ্ঞেস (ফ্রি হলে সেরা)
- [ ] না পেলে Oracle/A paid VPS নিন
- [ ] Imou Bullet 2E কিনুন
- [ ] Imou Life-এ ক্যামেরা যোগ (safety code নোট করুন)
- [ ] VPS-এ MediaMTX + Tunnel চালু
- [ ] Vercel env + অ্যাডমিন প্যানেল
- [ ] যাচাই
