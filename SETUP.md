# 📘 Setup Guide — Step by Step | دليل الإعداد

## Prerequisites | المتطلبات

- Node.js 18+ مثبت
- حساب على [GitHub](https://github.com)
- حساب على [Vercel](https://vercel.com) (مجاني)
- حساب على [Supabase](https://supabase.com) (مجاني)

---

## Step 1: Setup Supabase | إعداد Supabase

### 1.1 — Create Project | إنشاء المشروع

1. روح [supabase.com](https://supabase.com) واعمل sign in
2. اضغط **"New Project"**
3. املأ:
   - **Name:** `spotify-clone` (أو أي اسم تختاره)
   - **Database Password:** اختار password قوي (احفظه)
   - **Region:** اختار أقرب region ليك (Frankfurt للشرق الأوسط)
4. استنى ~2 دقيقة عشان المشروع يتعمل

### 1.2 — Run Database Schema | تشغيل قاعدة البيانات

1. في Supabase dashboard → **SQL Editor** (في الـ sidebar)
2. اضغط **"New Query"**
3. افتح الملف `database/schema.sql` من المشروع
4. انسخ المحتوى كله والصقه في SQL Editor
5. اضغط **"Run"** (Ctrl + Enter)
6. لو شفت "Success" — تمام، الـ schema اتعمل

### 1.3 — Configure Email Auth | إعداد Auth

1. روح **Authentication** → **Providers**
2. تأكد إن **Email** مفعّل
3. روح **Authentication** → **Email Templates**
4. **مهم جداً:** روح **Authentication** → **Settings**
   - شيل علامة الصح من **"Enable email confirmations"**
   - ده عشان الـ users يقدروا يـ login مباشرة بعد signup
5. Save

### 1.4 — Get API Keys | احصل على المفاتيح

1. روح **Project Settings** → **API**
2. هتلاقي:
   - **Project URL** → ده `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → ده `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → ده `SUPABASE_SERVICE_ROLE_KEY` (سري جداً!)

---

## Step 2: Setup SoundCloud API | إعداد SoundCloud

> ⚠️ **مهم:** SoundCloud أوقفوا تسجيل تطبيقات جديدة بشكل عام. عندك خياران:

### Option A — Apply for Official API Access
1. روح [developers.soundcloud.com](https://developers.soundcloud.com)
2. اعمل طلب — ممكن يستغرق أسابيع للموافقة

### Option B — Use Public Web Client ID (للتطوير)
ده اللي معظم الـ open-source SoundCloud clients بتستخدمه:

1. روح [soundcloud.com](https://soundcloud.com) في browser
2. افتح DevTools (F12) → Network tab
3. اعمل refresh للصفحة
4. ابحث في الـ requests عن `client_id=`
5. هتلاقيه في requests كتيرة لـ `api-v2.soundcloud.com`
6. انسخ القيمة

> 📝 **Note:** الـ client_id ده ممكن يتغير. للإنتاج الحقيقي، تواصل مع SoundCloud للحصول على access رسمي.

---

## Step 3: Local Setup | الإعداد المحلي

### 3.1 — Clone & Install

```bash
git clone <your-repo-url>
cd spotify-clone
npm install
```

### 3.2 — Environment Variables

```bash
cp .env.local.example .env.local
```

افتح `.env.local` وضع القيم اللي حصلت عليها:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SOUNDCLOUD_CLIENT_ID=your_soundcloud_client_id
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3.3 — Run Development Server

```bash
npm run dev
```

افتح [http://localhost:3000](http://localhost:3000) — لازم تشوف الـ login page.

### 3.4 — Test the Flow | اختبار التدفق

1. اعمل **Sign up** بـ username جديد
2. هيـ redirect على الـ home page
3. روح **Search** → ابحث عن أغنية
4. اضغط الـ + → **Create new playlist** (من الـ sidebar)
5. اضغط الـ + جنب الأغنية → اختار الـ playlist
6. روح الـ playlist → انسخ الـ Stream URL
7. افتح VLC → Media → Open Network Stream → الصق الـ URL
8. لو شغل ✅ — كل حاجة تمام!

---

## Step 4: Deploy to Vercel | الـ Deployment

### 4.1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/spotify-clone.git
git push -u origin main
```

### 4.2 — Deploy to Vercel

1. روح [vercel.com](https://vercel.com) → **New Project**
2. اختار الـ repo بتاعك
3. **Framework:** Next.js (هيتعرف عليه تلقائياً)
4. ضيف الـ environment variables (كلهم):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SOUNDCLOUD_CLIENT_ID`
   - `NEXT_PUBLIC_SITE_URL` → ضع الـ Vercel URL (مثل `https://your-app.vercel.app`)
5. اضغط **Deploy**
6. استنى دقيقتين

### 4.3 — Update Site URL

بعد الـ deploy، رجع للـ Settings → Environment Variables:
- عدّل `NEXT_PUBLIC_SITE_URL` للـ Vercel URL الفعلي
- اضغط **Redeploy**

---

## Step 5: Custom Domain (اختياري)

1. في Vercel → **Settings** → **Domains**
2. ضيف الـ domain بتاعك
3. حدّث الـ DNS records زي ما Vercel هيقولك
4. عدّل `NEXT_PUBLIC_SITE_URL` للـ domain الجديد

---

## 🎯 Testing Checklist | قائمة الاختبار

- [ ] Signup يعمل
- [ ] Login يعمل
- [ ] Search يرجع نتائج
- [ ] إنشاء playlist يعمل
- [ ] إضافة track للـ playlist
- [ ] الـ Stream URL ينسخ صح
- [ ] الـ Stream URL يفتح في VLC
- [ ] الـ Stream URL يفتح في browser (تحفظ كملف m3u)
- [ ] حذف track يعمل
- [ ] حذف playlist يعمل
- [ ] Logout يعمل

---

## 🔧 Troubleshooting | حل المشاكل

### Error: "Invalid SoundCloud client ID"
- تأكد إن الـ `SOUNDCLOUD_CLIENT_ID` في `.env.local` صح
- جرب client ID جديد من SoundCloud

### Error: "Stream URL doesn't work in VLC"
- افتح الـ URL في browser الأول — هل بيرجع m3u؟
- لو رجع 404، الـ playlist فاضية أو الـ token غلط
- لو رجع 500، شيك على Vercel logs

### Error: "Username already taken" but it's not
- في Supabase: SQL Editor:
```sql
DELETE FROM auth.users WHERE email = 'username@users.local';
```

### Error: "Failed to fetch tracks"
- SoundCloud client_id انتهى صلاحيته — احصل على واحد جديد

---

## 💡 Tips | نصائح

1. **Performance:** Vercel Edge Functions أسرع من Serverless للـ stream endpoint
2. **Costs:** ابقى تحت 100GB bandwidth في Vercel للـ free tier
3. **Security:** ميتشاركش الـ `SUPABASE_SERVICE_ROLE_KEY` أبداً
4. **Backup:** Supabase بيعمل backups تلقائي للـ Pro plan

---

## 📚 Next Steps | الخطوات التالية

بعد ما يشتغل كل حاجة، فيه features تقدر تضيفها:
- [ ] Audio player في الموقع نفسه
- [ ] Drag-and-drop لترتيب الـ tracks
- [ ] Playlist covers مخصصة
- [ ] Share playlists مع users تانيين
- [ ] Listen history و recommendations
- [ ] Multiple sources (Audius, Jamendo)
- [ ] Mobile app بـ React Native
