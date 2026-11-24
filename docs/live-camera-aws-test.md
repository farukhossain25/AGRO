# AWS Free Tier-এ লাইভ ক্যামেরা টেস্ট (৫–৭ দিন) — ল্যাপটপ ছাড়া

> **কেন এটা করা হচ্ছে:** Imou ক্যামেরা কেনার আগে ৫–৭ দিন টেস্ট। আপনার কাছে ল্যাপটপ নেই, তাই
> MediaMTX ক্লাউডে চলবে → আপনার DVR থেকে ছবি তুলে AWS-এর MediaMTX এ পাঠাবে → Vercel সেটা
> প্রক্সি করে গ্রাহককে দেখাবে।
>
> **⚠️ সবচেয়ে জরুরি কথা নিচে §১-এ আছে — এটা না পড়ে শুরু করবেন না।**

---

## ০. AWS Free Tier ২০২৬-এ কী দেয় (আগে জেনে নিন)

| | |
| --- | --- |
| নতুন অ্যাকাউন্ট | **$১০০ ক্রেডিট** + আরও $১০০ পর্যন্ত (অনবোর্ডিং কাজ) = **$২০০** |
| মেয়াদ | **৬ মাস** অথবা ক্রেডিট শেষ, যেটা আগে |
| কার্ড | বেশিরভাগ ক্ষেত্রে **লাগে না** (Google/GitHub/Apple দিয়েও সাইনআপ করা যায়) |
| ক্লাসিক ১২ মাসের ৭৫০ ঘণ্টা t3.micro | ❌ নতুন অ্যাকাউন্টে **আর নেই** (জুলাই ২০২৫-এর পর) |
| ইন্টারনেট আউটবাউন্ড | মাসে **১০০ GB ফ্রি**, তারপর $০.০৯/GB |

**খরচের হিসাব (us-east-1, t3.micro ২৪/৭):**
- EC2 ≈ **$৭.৬/মাস** + ২০ GB EBS ≈ $১.৯ → মোট ≈ **$৯.৫/মাস**
- ৭ দিন ≈ **$২.২** — ক্রেডিট থেকে যাবে, পকেট থেকে কিছু যাবে না
- ভিডিও আউটবাউন্ড ১০০ GB ফ্রি = **৭২০p-তে ~১৬০ দর্শক-ঘণ্টা**, তারপর $০.০৯/GB

👉 **মোট ~$২–৩, ক্রেডিটেই ঢেকে যাবে।** কিন্তু §১ পড়ুন — টেস্ট আটকে যেতে পারে অন্য জায়গায়।

---

## ১. ⚠️ প্রথমে এটা যাচাই করুন — DVR-এর ছবি AWS-এ পৌঁছাবে কীভাবে?

AWS-এর সার্ভার থেকে আপনার DVR-কে ইন্টারনেটে **দেখা যেতে হবে**। উপায় দুটো:

### উপায় A — DVR নিজেই RTMP push করে (সবচেয়ে ভালো, পোর্ট খোলা লাগে না)
আপনার Dahua XVR-এর ওয়েব UI-তে (একটা কম্পিউটার/ফোন দিয়ে `http://192.168.1.108`) খুঁজুন:

**Setup → Network → Platform Access** (বা **Port**) → **RTMP** ট্যাব

থাকলে: Enable ✓ → Address Type = **Custom** → Custom Address =
`rtmp://<AWS-এর-IP>:1935/dvr-channel-1` → Save

### উপায় B — রাউটারে পোর্ট ফরওয়ার্ড (RTSP, ৫৫৪)
DVR-এর RTMP না থাকলে: রাউটারে **TCP 554** পোর্ট ফরওয়ার্ড করুন DVR-এর IP-তে।
তারপর MediaMTX নিজে DVR থেকে ছবি টানবে (`source: rtsp://…@<বাসার-পাবলিক-IP>:554/...`)।

> 🚨 **আপনার রাউটার যদি CGNAT/4G রাউটার হয়** (বাসার পাবলিক IP আর রাউটারের WAN IP না মিললে),
> উপায় B কাজ করবে না — তখন **RTMP push (উপায় A)** ছাড়া উপায় নেই।
> যাচাই: <https://www.whatismyip.com> -এর IP আর রাউটারের admin panel-এর WAN IP মিলিয়ে দেখুন।

**দুটোই না পারলে টেস্ট আটকে যাবে** — তখন Imou ক্যামেরা আগে কিনে সরাসরি Vercel-এ চালানোই সহজ
(`docs/live-camera-no-vps.md`)।

---

## ২. AWS অ্যাকাউন্ট ও সার্ভার তৈরি (ব্রাউজার থেকেই, ~১৫ মিনিট)

1. <https://aws.amazon.com/free> → **Create a free account** (Google দিয়ে সাইনআপ চেষ্টা করুন)
2. Console → উপরে ডানদিকে **Region: N. Virginia (us-east-1)** — সবচেয়ে সস্তা ও দ্রুত
3. **EC2 → Launch instance**
   - **Name:** `agro-stream`
   - **AMI:** Ubuntu Server 24.04 LTS
   - **Instance type:** `t3.micro` (২ vCPU, ১ GB — MediaMTX-এর জন্য যথেষ্ট)
   - **Key pair:** *Create new key pair* → নাম `agro`, type **RSA**, format **.pem** → ডাউনলোড হবে
   - **Network settings → Edit:**
     - Allow SSH (22) → **My IP** (নিরাপত্তা)
     - Add rule: **Custom TCP 1935** → Anywhere (RTMP push)
     - Add rule: **Custom TCP 8888** → My IP (HLS, পরে Cloudflare Tunnel দিয়ে বন্ধ করবেন)
   - **Storage:** 20 GiB gp3
4. **Launch instance** → ২ মিনিট অপেক্ষা → Public IPv4 কপি করুন (এটাই `<AWS-IP>`)

> 💡 ল্যাপটপ নেই বলে চিন্তা নেই — **EC2 → Instance → Connect → EC2 Instance Connect** দিয়ে
> ব্রাউজারেই টার্মিনাল পাবেন।

---

## ৩. সার্ভারে MediaMTX (Docker) — কপি-পেস্ট

ব্রাউজার টার্মিনালে:

```bash
# ৩.১ Docker
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER && newgrp docker

# ৩.২ ফাইলগুলো আনুন (আপনার রিপো থেকে)
sudo apt install -y git
git clone --depth 1 -b arena/8c46a8db-agro \
  https://github.com/farukhossain25/AGRO.git agro
cd agro

# ৩.৩ পুরোনো ডেমো ক্যামেরাগুলো সরিয়ে শুধু আপনার DVR রাখুন
nano mediamtx.yml     # নিচের নিয়মে সম্পাদনা করুন
```

`mediamtx.yml`-এর `paths:` অংশে **শুধু এই দুটো লাইন রাখুন** (বাকি ডেমো `savar-…`, `tangail-…`
সব মুছে ফেলুন):

```yaml
paths:
  dvr-channel-1:
    source: rtsp://admin:আপনার_পাসওয়ার্ড@192.168.1.108:554/cam/realmonitor?channel=1&subtype=1
    sourceOnDemand: true
```

> **উপায় A (DVR নিজে push)** বেছে নিলে `source:` লাইনটা না দিয়ে শুধু এটা রাখুন:
> ```yaml
> paths:
>   dvr-channel-1:
>     source: publisher
> ```

`nano`-তে সেভ: `Ctrl+O`, `Enter`, `Ctrl+X`।

```bash
# ৩.৪ চালু করুন (শুধু MediaMTX — Caddy/tunnel এই টেস্টে লাগবে না)
docker compose -f docker-compose.stream-vps.yml up -d mediamtx

# ৩.৫ দেখা যাচ্ছে কি না
docker logs ba-mediamtx --tail 20
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8888/dvr-channel-1/index.m3u8"
```

- `404` = সার্ভার চলছে, কিন্তু ক্যামেরা এখনো যুক্ত হয়নি (স্বাভাবিক, পরের ধাপে হবে)
- `200` = স্ট্রিম আসছে ✅

```bash
# ৩.৬ Ubuntu ফায়ারওয়ালও খুলুন (আগে থেকেই বন্ধ থাকলে দরকার নেই)
sudo ufw allow 1935/tcp && sudo ufw allow 8888/tcp
```

---

## ৪. DVR থেকে ছবি তোলা

- **উপায় A (push):** DVR-এর RTMP সেটিংয়ে address দিন
  `rtmp://<AWS-IP>:1935/dvr-channel-1` এবং stream key **খালি** রাখুন, তারপর Enable ✓।
  MediaMTX লগে `[path dvr-channel-1] [RTMP] is publishing` দেখবেন।
  (`publishUser/publishPass` সেট করা আছে — যদি DVR-এ username/password দিতে হয়, `mediamtx.yml`-এর
  `publishUser: publisher`, `publishPass: …` বসিয়ে দিন, নাহয় ওই দুই লাইন মুছে দিন।)
- **উপায় B (pull):** কিছুই করতে হবে না — MediaMTX নিজেই DVR থেকে টানবে, যখন কেউ দেখতে চাইবে।

---

## ৫. Vercel-এ যুক্ত করা (২ মিনিট)

1. Vercel → Project → **Settings → Environment Variables**:

   | নাম | মান |
   | --- | --- |
   | `STREAM_PROXY_TARGET` | `http://<AWS-IP>:8888` |
   | `STREAM_TOKEN_SECRET` | ৩২ অক্ষরের random (নিচের কমান্ডে পাবেন) |

   ```bash
   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
   ```

2. **Redeploy** দিন।
3. অ্যাডমিন → **ক্যামেরা → নতুন**:
   - খামার, নাম যা চান
   - **স্ট্রিম সোর্স:** `MediaMTX / RTSP (ভিপিএস লাগবে)`
   - **Stream key:** `dvr-channel-1` ← **হুবহু** `mediamtx.yml`-এর key
   - স্টেটাস `অনলাইন`, সক্রিয় ✓, প্রিমিয়াম ✓
4. `/live/farms/<খামার>` → লাইভ দেখুন।

> HTTP দিয়ে কাজ করবে (Vercel→AWS), কারণ প্রক্সি সার্ভার-সাইড। ব্রাউজার কখনো `http://` দেখে না —
> সব `/api/stream/...` (https) হয়ে যায়। তাই টেস্টে SSL সার্টিফিকেট লাগবে না।

---

## ৬. ৫–৭ দিনে যা যা যাচাই করবেন

| # | কী দেখবেন | কোথায় |
| --- | --- | --- |
| ১ | ছবি আসে, ~৩–৫ সেকেন্ড দেরি | `/live/farms/<খামার>` |
| ২ | প্রিমিয়াম না থাকলে **লক**, ট্রায়ালে খোলে | একই পেজ (incognito) |
| ৩ | মোবাইল ডেটায় কত MB/মিনিট যায় | ব্রাউজার DevTools → Network, বা ফোনের ডেটা মিটার |
| ৪ | ৩–৪ জন একসাথে দেখলে ছবি ঠিক থাকে | একাধিক ফোন |
| ৫ | DVR ইন্টারনেট কেটে দিলে "ক্যামেরা অফলাইন" দেখায় | তার খুলে ফেলুন |
| ৬ | `/foisal/cameras`-এ সতর্কবার্তা নেই | অ্যাডমিন প্যানেল |

**ব্যান্ডউইথ মাপা (গুরুত্বপূর্ণ):** ৭২০p সাব-স্ট্রিমে ঘণ্টায় ~৫০–৭০ MB, ১০৮০p-তে ~১৫০–২৫০ MB।
৫ দিনে ২ ঘণ্টা করে দেখলে ৫০০ MB–১ GB — ১০০ GB ফ্রি সীমার অনেক ভিতরে। 📌 **এই সংখ্যাটাই ঠিক করে
দেবে Imou ক্যামেরা নিলে মাসে কত লাগবে।**

---

## ৭. টেস্ট শেষে (খরচ বন্ধ)

```bash
# সার্ভারে
docker compose -f docker-compose.stream-vps.yml down
```

তারপর AWS Console → EC2 → Instance → **Instance state → Terminate** (শুধু Stop নয় — Stop-এও EBS-এর
টাকা কাটে)। Vercel থেকে `STREAM_PROXY_TARGET` মুছে Redeploy দিন।

Imou ক্যামেরা এলে §আগের গাইড (`docs/live-camera-no-vps.md`) — তখন কোনো সার্ভারই লাগবে না।

---

## ৮. সমস্যা হলে

| দেখছেন | কারণ / সমাধান |
| --- | --- |
| EC2-তে ৮৮৮৮ পোর্টে সংযোগ হয় না | Security Group-এ 8888 rule নেই, বা `ufw` বন্ধ নয় |
| `docker compose` চালাতে sudo চাইছে | `sudo usermod -aG docker $USER && newgrp docker`, নাহয় `sudo docker compose …` |
| `path not found` / `404` ব্রাউজারে | `stream_key` আর `mediamtx.yml`-এর `paths:` key মিলছে না (হুবহু এক হতে হবে) |
| DVR push হচ্ছে না | DVR-এর RTMP-তে port/address ভুল, বা AWS Security Group-এ 1935 বন্ধ |
| `connect: connection refused` লগে | DVR আর AWS-এর মধ্যে রুট নেই — উপায় A (push) ব্যবহার করুন |
| ছবি সামনে-পিছনে লাফায় | `mediamtx.yml`-এ `sourceOnDemand: true` রাখুন, আর DVR-এর GOP/কি-ফ্রেম ইন্টারভাল কমান |
| HLS কিন্তু ছবি কালো/থেমে থাকে | DVR-এর সাব-স্ট্রিম **H.264** কিনা দেখুন (H.265 হলে ব্রাউজারে চলে না — MediaMTX ট্রান্সকোড করে না) |

> ⚠️ **H.265 ফাঁদ:** Dahua ডিফল্টে H.265 রাখে। `mediamtx.yml` দিয়ে ট্রান্সকোড হয় না — DVR-এর
> Encode সেটিংয়ে ওই চ্যানেলের **Sub Stream = H.264** করে দিন, নাহলে AWS-এ সব ঠিক থাকলেও ছবি আসবে না।
