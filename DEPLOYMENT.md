# دليل النشر — Cloudflare Pages + Fly.io

هذا الدليل يشرح كيف تنشر المشروع بالـ split architecture:

- **الموقع** على Cloudflare Pages — مجاني، bandwidth بدون حد
- **الراديو** على Fly.io — مجاني، بدون انقطاع في البث
- **قاعدة البيانات** تبقى على Supabase زي ما هي

**التكلفة الإجمالية: $0/شهر** (مع السماح لمدى استخدام معقول).

---

## قبل ما تبدأ — تحقق من جاهزية البيئة

تأكد إن عندك:

- [ ] حساب Cloudflare ([sign up](https://dash.cloudflare.com/sign-up))
- [ ] حساب Fly.io ([sign up](https://fly.io/app/sign-up))
- [ ] الكود على GitHub أو GitLab
- [ ] الـ `.env.local` فيه القيم الحقيقية:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SOUNDCLOUD_CLIENT_ID`
- [ ] شغّلت كل migrations في Supabase (ضروري `migration_broadcast_epoch.sql` + `migration_play_modes.sql`)

---

## المرحلة الأولى: نشر الراديو على Fly.io

### 1. ثبّت Fly CLI

```bash
# Linux/macOS
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell كـ admin)
iwr https://fly.io/install.ps1 -useb | iex
```

بعد ما يخلص، أضف Fly للـ PATH (المثبّت يقولك المسار). تحقق:

```bash
fly version
```

### 2. سجّل دخول

```bash
fly auth login
```

يفتح متصفح. سجل دخولك (أو أنشئ حساب لو ما عندك).

### 3. ادخل مجلد الراديو

```bash
cd radio-server
```

### 4. أنشئ التطبيق على Fly

```bash
fly launch --no-deploy --copy-config
```

`--copy-config` يخلي Fly يستخدم الـ `fly.toml` اللي عندنا بدل ما يولّد واحد جديد.

`--no-deploy` يخلي العملية تتوقف قبل الـ deploy عشان نضبط الـ secrets أولاً.

**ملاحظة:** اسم التطبيق `egmax-radio` ممكن يكون محجوز. لو طلب منك تغير الاسم، اختار شي زي `egmax-radio-{اسمك}`. خلي بالك إنه راح يكون جزء من الـ URL.

### 5. ضبط الـ secrets

```bash
fly secrets set \
  SUPABASE_URL="https://xxx.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="eyJhbGc..." \
  SOUNDCLOUD_CLIENT_ID="your_sc_client_id"
```

استبدل القيم بالقيم الحقيقية من `.env.local`.

> **مهم:** ⚠️ هنا `SUPABASE_URL` بدون `NEXT_PUBLIC_`. الـ standalone server ما يستخدم Next prefixes.

### 6. انشر

```bash
fly deploy
```

العملية تاخذ 2-3 دقائق أول مرة. لما تنتهي، Fly يطبع الـ URL:

```
Visit your newly deployed app at https://egmax-radio.fly.dev/
```

### 7. تحقق من الراديو

```bash
# يجب يرجع "ok"
curl https://egmax-radio.fly.dev/healthz

# جرّب URL راديو حقيقي (استبدل abc123 بـ short_code فعلي عندك)
curl -I https://egmax-radio.fly.dev/radio/abc123.mp3
# لازم يرد 200 ومعه icy-name header، أو 404 لو الـ code غلط
```

**خلّي الـ URL هذا — راح نحتاجه في المرحلة الثانية.**

---

## المرحلة الثانية: نشر الموقع على Cloudflare Pages

### 1. ثبّت Wrangler CLI

```bash
# في الـ root بتاع المشروع (مش radio-server):
cd ..
npm install
```

`wrangler` راح ينثبت كـ devDependency من `package.json`.

### 2. سجّل دخول

```bash
npx wrangler login
```

يفتح متصفح يطلب صلاحيات. وافق.

### 3. اختبر البناء محلياً

```bash
npm run cf:build
```

العملية تشتغل `next build` ثم `@opennextjs/cloudflare` يحول الـ output لشكل Workers يقدر يقرأه. لو نجح، النتيجة في مجلد `.open-next/`.

### 4. اختبر محلياً (اختياري لكن مستحسن)

```bash
npm run cf:preview
```

يشغل المشروع بنفس البيئة اللي راح يشتغل فيها على Cloudflare. افتح `http://localhost:8788` وجرّب الموقع.

### 5. ضبط الـ secrets على Cloudflare

في الـ root بتاع المشروع:

```bash
# الـ public env vars (تظهر في bundle الـ frontend) — ممكن تتنشر بـ vars
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
# يطلب القيمة، الصق https://xxx.supabase.co

npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
# يطلب القيمة، الصق eyJhbGc...

# الـ secrets الحساسة
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# الصق key الـ service role

npx wrangler secret put SOUNDCLOUD_CLIENT_ID
# الصق SC client ID

# الأهم — يربط الموقع بسيرفر الراديو على Fly:
npx wrangler secret put RADIO_BASE_URL
# الصق https://egmax-radio.fly.dev (بدون / في النهاية)
```

> **ملاحظة:** `wrangler secret put` يطلب الـ value تفاعلياً. لو تبي تنفذ كل شي بأمر واحد بدون تفاعل، بدلها بـ `echo "value" | wrangler secret put NAME`.

### 6. انشر

```bash
npm run cf:deploy
```

أول مرة Wrangler يسأل اسم الـ project. اختار اسم زي `egmax`. النشر ياخذ 1-2 دقيقة.

لما يخلص، يطبع URL زي:

```
https://egmax.YOUR-SUBDOMAIN.workers.dev
```

### 7. اختبر النشر

افتح الـ URL في المتصفح. لازم تشوف:
- الصفحة الرئيسية تشتغل
- تقدر تسجل دخول
- تقدر تفتح playlist
- لما تضغط "IMVU radio" copy → الرابط يحول لـ Fly.io تلقائي

---

## المرحلة الثالثة: ربط Domain (اختياري)

لو عندك domain مسجّل:

### Cloudflare:
1. أضف الـ domain لحسابك في Cloudflare (Add a Site)
2. روح Workers & Pages → اختار `egmax` project → Custom domains → Set up a custom domain
3. اكتب الـ subdomain (مثلاً `egmax.example.com`)

### Fly.io (للراديو):
```bash
cd radio-server
fly certs add radio.example.com
```

حدّث الـ DNS بناءً على ما يطلبه `fly certs show`. بعدين حدث على Cloudflare:

```bash
cd ..
echo "https://radio.example.com" | npx wrangler secret put RADIO_BASE_URL
npm run cf:deploy
```

---

## الصيانة وحل المشاكل

### مراقبة Fly

```bash
cd radio-server

# logs بشكل مباشر
fly logs

# الحالة الحالية
fly status

# لو عايز تعيد التشغيل
fly apps restart
```

### مراقبة Cloudflare

```bash
# logs بشكل مباشر
npx wrangler tail

# الإحصائيات في الـ dashboard:
# https://dash.cloudflare.com → Workers & Pages → egmax
```

### تحديثات الكود

كل ما تعدّل كود:

```bash
# للموقع:
npm run cf:deploy

# للراديو:
cd radio-server
fly deploy
```

أو اربط GitHub بكلاهما عشان كل push يعمل deploy تلقائي.

### مشاكل شائعة

**"Invalid Supabase URL"**
- ✅ تأكد إن `NEXT_PUBLIC_SUPABASE_URL` (الموقع) و `SUPABASE_URL` (الراديو) كلاهما مضبوط بقيمة كاملة بـ `https://`

**الراديو يعطي 404 على كل URL**
- ✅ تحقق من إنك شغّلت الـ migrations:
  ```sql
  SELECT * FROM playlists WHERE short_code IS NOT NULL LIMIT 1;
  ```

**فجوات صوت كل بضع دقائق على Cloudflare بس مش على Fly**
- ✅ معناه `RADIO_BASE_URL` مش مضبوط في Cloudflare. Cloudflare يستخدم الـ route المحلي بدل redirect لـ Fly.

**Fly تعطيك حد bandwidth**
- ✅ Free tier: 160 GB/شهر. ساعة استماع ≈ 60 MB، يعني ~2700 ساعة/شهر. لو وصلت الحد، ترقّي لـ Hobby ($5/شهر) → 250 GB.

---

## الخلاصة

بعد ما تخلص:

- 🌐 **الموقع**: `https://egmax.YOUR-SUBDOMAIN.workers.dev`
- 📻 **الراديو**: `https://egmax-radio.fly.dev/radio/{code}.mp3`
- 🔗 **الربط**: Cloudflare يحول الـ `/radio/...` requests لـ Fly تلقائياً

التكلفة الشهرية: **$0** (طول ما الـ usage داخل الـ free tiers).

المستمع في IMVU يلصق الـ Cloudflare URL، الـ redirect يحوله لـ Fly بدون ما يحس، البث يفضل شغال بدون انقطاع.
