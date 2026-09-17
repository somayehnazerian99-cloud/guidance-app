# سیستم هدایت تحصیلی — متوسطه اول

نرم‌افزار مدیریت هدایت تحصیلی دانش‌آموزان متوسطه اول (پایه ۷ تا ۹): ثبت نمرات سه‌ساله،
علایق، توانایی‌ها، آزمون‌های مشاوره‌ای، نظر والدین و ویدئوهای آموزشی، و ارائه‌ی
**«پیشنهاد اولیه برای بررسی توسط مشاور»** بر پایه‌ی همه‌ی این داده‌ها.

سه پنل مستقل با دسترسی کاملاً تفکیک‌شده دارد:

| نقش | مسیر پنل | صفحه ورود |
|-----|----------|-----------|
| مدیر سیستم | `/admin` | `/login/admin` |
| مشاور | `/counselor` | `/login/counselor` |
| دانش‌آموز | `/student` | `/login/student` |

---

## ۱. فناوری‌ها

- **Next.js 16** (App Router) + **React 19** — تمام کد با **JavaScript** نوشته شده است (بدون TypeScript)
- **Tailwind CSS 4** + کامپوننت‌های سبک shadcn/ui (Radix UI) + `lucide-react` + `recharts`
- **Prisma 6** + **MongoDB**
- **bcryptjs** برای Hash رمز عبور، **Zod** برای Validation
- **ESLint 9** (flat config) + تست‌های `node:test` بدون وابستگی اضافه
- فونت **Vazirmatn** از طریق `next/font` (بدون درخواست شبکه‌ای در زمان اجرا و بدون Layout Shift)

---

## ۲. پیش‌نیازها

- Node.js 20 یا بالاتر
- یک MongoDB (محلی یا MongoDB Atlas)

---

## ۳. نصب و اجرا (Quick Start)

```bash
cd guidance-app
npm install

cp .env.example .env      # مقادیر واقعی را در .env بگذارید (این فایل هرگز کامیت نمی‌شود)

npm run db:check          # تست اتصال دیتابیس (Replica Set، Collectionها، ایندکس‌ها)

npx prisma generate       # تولید Prisma Client
npx prisma db push        # ساخت Collectionها و ایندکس‌ها
npm run seed              # داده‌های نمونه (فقط برای Development)
npm run dev               # http://localhost:3000
```

اگر MongoDB محلی نصب نیست: `npm run mongo:start` را قبل از `db:check` اجرا کنید.

بررسی سلامت پروژه:

```bash
npm run lint              # ESLint — باید بدون خطا و بدون Warning باشد
npm test                  # تست‌های امنیت/اعتبارسنجی (node:test)
npm run build             # Build تولیدی
npm run verify:auth       # تست HTTP واقعی روی سرور Production
npm run verify:live       # همان + یک MongoDB موقت + Seed + تست‌های زنده ورود و دسترسی
```

> `npm run verify:live` هیج نصب سیستمی لازم ندارد: یک MongoDB موقت (تک‌نودی Replica Set)
> داخل `node_modules/.cache` بالا می‌آورد، Schema را Push می‌کند، Seed می‌زند، همه‌ی
> بررسی‌ها را اجرا می‌کند و در پایان دیتابیس را کاملاً پاک می‌کند. اگر `.env` شما به
> دیتابیس واقعی وصل است، این اسکریپت به آن دست نمی‌زند (فقط `DATABASE_URL` را
> برای همان پروسه Override می‌کند).

---

## ۴. متغیرهای محیطی

```env
DATABASE_URL="mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/guidance?retryWrites=true&w=majority"
AUTH_SECRET="یک رشته تصادفی حداقل ۳۲ کاراکتری"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
```

| متغیر | کاربرد |
|-------|--------|
| `DATABASE_URL` | رشته اتصال MongoDB |
| `AUTH_SECRET` | کلید سرور برای HMAC توکن‌های بازیابی رمز عبور. در Production **الزامی** است |
| `NEXT_PUBLIC_APP_URL` | آدرس پایه‌ی سایت (لینک بازیابی رمز، Metadata و Canonical) |
| `CLOUDINARY_CLOUD_NAME` | نام Cloud Name — برای آپلود عکس/صوت/ویدیو در صفحه اصلی |
| `CLOUDINARY_API_KEY` | کلید عمومی Cloudinary |
| `CLOUDINARY_API_SECRET` | کلید محرمانه Cloudinary. **فقط سمت سرور** استفاده می‌شود و هرگز به مرورگر نمی‌رود |

> سه متغیر `CLOUDINARY_*` فقط برای بخش «مدیریت فایل‌های صفحه اصلی» لازم‌اند. اگر تنظیم
> نشده باشند، همان صفحه پیام «اتصال فضای ذخیره‌سازی فایل هنوز تنظیم نشده است.»
> را نشان می‌دهد و بقیه‌ی سامانه بدون مشکل کار می‌کند. برای بررسی وضعیت:
> `GET /api/admin/diagnostics` (فقط مدیر).

تولید مقدار تصادفی امن:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> `.env` در `.gitignore` است. فقط `.env.example` (با مقادیر Placeholder) کامیت می‌شود.
> در Production از Environment Variables سرویس میزبانی و در CI از GitHub Secrets استفاده کنید.

---

## ۵. اتصال MongoDB

**محلی:**

```env
DATABASE_URL="mongodb://localhost:27017/guidance"
```

### راه‌اندازی MongoDB محلی بدون نصب سیستمی

اگر MongoDB روی سیستم نصب نیست، پروژه می‌تواند با همان باینری که
`mongodb-memory-server` دانلود کرده یک MongoDB ماندگار بالا بیاورد (بدون دسترسی ادمین):

```bash
npm run mongo:start    # یک Replica Set تک‌نودی روی localhost:27017
npm run mongo:status   # وضعیت اتصال و Replica Set
npm run mongo:stop     # توقف (داده‌ها در .local-mongo/ باقی می‌ماند)
```

داده‌ها در `.local-mongo/data` (در `.gitignore`) نگهداری می‌شوند، پس بین اجراها پایدارند.

### بررسی اتصال

```bash
npm run db:check
```

پینگ، نسخه سرور، تشخیص Replica Set، آزمون نوشتن/خواندن، وجود ۲۰ Collection و
ایندکس‌های `User` را بررسی می‌کند و Credentials را هرگز چاپ نمی‌کند.

### مهاجرت به MongoDB Atlas

1. Cluster را بسازید، کاربر دیتابیس با دسترسی `readWrite` بگیرید و IP فعلی را در
   Network Access اضافه کنید.
2. مقدار `DATABASE_URL` را در `.env` جایگزین کنید (فقط همین فایل؛ `.env.example` را دست نزنید).
3. `npm run db:check` → باید «replica set detected» را ببینید.
4. `npx prisma db push` → ساخت Collectionها و ایندکس‌ها روی Atlas.
5. `npm run seed` → **توجه: این دستور Collections را خالی می‌کند**؛ روی دیتابیس دارای
   داده‌ی واقعی اجرا نکنید.
6. `npm run verify:auth` → تست ورود سه نقش روی همان دیتابیس.

**نوشتن `DATABASE_URL` بدون ویرایشگر:** اگر ویرایشگر شما فایل را ذخیره نمی‌کند، از این
دستور استفاده کنید؛ رشته را از ورودی می‌گیرد، در `.env` می‌نویسد و هرگز آن را چاپ نمی‌کند:

```bash
npm run env:set            # مقدار را Paste کنید و Enter بزنید (کاراکترها نمایش داده نمی‌شوند)
npm run env:set -- --check # همان + اجرای خودکار db:check
npm run env:show           # تأیید: کدام فایل خوانده می‌شود و آخرین زمان ذخیره
```

اگر رشته‌ی وارد‌شده نام دیتابیس نداشته باشد، `/guidance` خودکار اضافه می‌شود.

**دو خطای رایج اتصال به Atlas** (هر دو را `npm run db:check` با پیام راهنما تشخیص می‌دهد):

| خطا | علت | راه‌حل |
|-----|-----|-------|
| `bad auth : authentication failed` | نام کاربری یا رمز دیتابیس اشتباه است | در Atlas → Database Access کاربر را بسازید یا رمز را Reset کنید. اگر رمز شامل `@ : / # %` است باید به شکل `%40 %3A %2F %23 %25` نوشته شود |
| `P1013: Database must be defined in the connection string` | دکمه‌ی «Connect» اطلس رشته را **بدون نام دیتابیس** می‌دهد (`...mongodb.net/?appName=...`) | نام دیتابیس را بعد از میزبان اضافه کنید: `...mongodb.net/guidance?retryWrites=true&w=majority` |
| `Password contains unescaped characters` | رمز دارای کاراکتر خام `@ : / # %` است | همان کاراکترها را Percent-encode کنید (`@` → `%40`) |

اگر محلی را لازم ندارید: `npm run mongo:stop`.

**MongoDB Atlas:** یک Cluster بسازید، کاربر دیتابیس با دسترسی `readWrite` روی همان دیتابیس
ایجاد کنید، IP سرور را در Network Access اضافه کنید و Connection String را در
`DATABASE_URL` قرار دهید. توصیه می‌شود کاربر دیتابیس فقط به یک دیتابیس محدود باشد
(بدون دسترسی `admin`).

> **مهم — Replica Set:** Prisma برای MongoDB از Transaction استفاده می‌کند (مثلاً در
> Seed، ثبت پاسخ‌های آزمون و جایگزینی علایق/توانایی‌ها). یک `mongod` مستقل از
> Transaction پشتیبانی نمی‌کند و خطای `P2031` می‌دهد. Atlas به‌صورت پیش‌فرض
> Replica Set است؛ اگر MongoDB را محلی اجرا می‌کنید، آن را تک‌نودی Replica Set بالا بیاورید:
>
> ```bash
> mongod --replSet rs0 --dbpath ./data --bind_ip 127.0.0.1
> # یک‌بار در mongosh:
> # rs.initiate()
> ```
>
> یا برای Development از `npm run verify:live` استفاده کنید که همین کار را خودکار انجام می‌دهد.

---

## ۶. Prisma

```bash
npx prisma validate         # اعتبارسنجی Schema
npm run prisma:generate     # تولید Prisma Client (با گارد خطای Schema)
npm run seed                # پر کردن دیتابیس با داده‌های نمونه
```

> این پروژه از `prisma db push` و Migration استفاده نمی‌کند چون MongoDB بدون Schema
> است؛ Prisma Client از `schema.prisma` ساخته می‌شود و ایندکس‌ها در سطح Application
> تعریف شده‌اند.

### چرا `prisma:generate` یک اسکریپت جداگانه است؟

`@prisma/client` در `postinstall` خودش `prisma generate` را اجرا می‌کند، اما وقتی
Schema نامعتبر باشد خطا را می‌گیرد و `process.exit(0)` می‌کند. یعنی **نصب شکست
نمی‌خورد، Build سبز می‌ماند و یک Prisma Client قدیمی در `node_modules` باقی می‌ماند**.
آن‌وقت
مدل جدید فقط لحظه‌ی درخواست غایب است و به کاربر یک خطای ۵۰۰ عمومی نشان داده می‌شود.

`scripts/prisma-generate.mjs` این حالت را به زمان Build منتقل می‌کند:

| وضعیت | نتیجه |
|-------|-------|
| Schema نامعتبر (`P1012` و مانند آن) | ❌ Build شکست می‌خورد — خطای قطعی و قابل رفع |
| Prisma CLI نصب نیست، ولی Client تولیدشده وجود دارد | ⚠️ هشدار و ادامه |
| Prisma CLI نصب نیست و هیچ Client ی وجود ندارد | ❌ شکست |
| خطای محیطی، ولی Client تولیدشده موجود است | ⚠️ هشدار و ادامه |

این اسکریپت هم در `postinstall` و هم در ابتدای `npm run build` اجرا می‌شود تا روی هر
میزبانی (نتفلی، Vercel و غیره) یک Schema خراب، Deploy را متوقف کند نه Runtime را.
همچنین `npm run db:check` یک بررسی ایستا روی فایل Schema انجام می‌دهد و مطمئن می‌شود
هر `@id` با `@default(auto())` دارای `@db.ObjectId` است.

### مدل‌های دیتابیس (۲۳ مدل)

| گروه | مدل‌ها |
|------|--------|
| احراز هویت | `User`, `Session`, `PasswordResetToken` |
| سازمانی | `School`, `Class`, `CounselorProfile`, `StudentProfile` |
| داده‌های دانش‌آموز | `Grade`, `Interest`, `Ability`, `ParentOpinion`, `Notification` |
| آزمون‌ها | `GuidanceTest`, `Question`, `Option`, `TestAttempt`, `TestAnswer` |
| خروجی و محتوا | `GuidanceResult`, `EducationalVideo`, `HomeMedia` |
| پشتیبانی | `SupportTicket`, `SupportReply` |
| حسابرسی | `AuditLog` |

`HomeMedia` فایل‌های آپلودشده‌ی صفحه اصلی (عکس/صوت/ویدیو) را نگه می‌دارد.
`createdBy` یک ارجاع اختیاری به `User` است (`HomeMediaCreator`): فایل بدون کاربر هم
معتبر است، پس نبودِ شناسه هیچ‌وقت باعث شکست ذخیره نمی‌شود.

> ⚠️ در MongoDB، **هر** فیلد `@id` که `@default(auto())` دارد باید `@db.ObjectId`
> داشته باشد. حذف آن باعث خطای `P1012` در `prisma generate` می‌شود. این مورد توسط
> `npm run db:check` و `tests/media.test.mjs` بررسی و قفل شده است.

فیلد `User.approvalStatus` (`PENDING` / `APPROVED` / `REJECTED`) وضعیت تأیید مشاور را
نگه می‌دارد. حساب‌هایی که پیش از افزودن این فیلد ساخته شده‌اند و حساب‌های ساخته‌شده
توسط مدیر، «تأییدشده» در نظر گرفته می‌شوند (`isCounselorApproved` در `lib/permissions.js`).

روابط با نام‌های صریح (`@relation("...")`) برای MongoDB تعریف شده و روی فیلدهای
پرتکرار (`studentId`, `testId`, `role`, `email`, `action`, ...) ایندکس وجود دارد.

> `User.email` عمداً `@unique` نیست: در MongoDB ایندکس یکتا روی یک فیلد
> اختیاری، مقدار «نداشتن مقدار» را هم Null می‌شمارد و در نتیجه فقط یک حساب
> بدون ایمیل می‌توانست وجود داشته باشد. یکتایی ایمیل‌های غیرخالی در لایه‌ی API
> (`POST/PUT /api/users`) بررسی می‌شود.
حذف داده‌های وابسته در سطح Application انجام می‌شود (MongoDB در این تنظیمات
Cascade دیتابیسی ندارد) و برای جلوگیری از باقی‌ماندن رکورد یتیم، در APIهای حذف
به‌صورت زنجیره‌ای پاک می‌شود.

---

## ۷. اجرا در حالت Development و Production

```bash
npm run dev        # Development
npm run build      # Build تولیدی
npm start          # اجرای Build تولیدی
```

---

## ۸. نقش‌ها و ماتریس دسترسی

| قابلیت | ADMIN | COUNSELOR | STUDENT |
|--------|:-----:|:---------:|:-------:|
| مدیریت کاربران، نقش‌ها و تنظیمات | ✅ | ❌ | ❌ |
| مشاهده لاگ امنیتی | ✅ | ❌ | ❌ |
| مدیریت مدارس/کلاس‌ها/آزمون‌ها/ویدئوها | ✅ | ❌ | ❌ |
| مشاهده همه دانش‌آموزان | ✅ | فقط دانش‌آموزان منتسب | فقط خودش |
| ثبت و ویرایش نمره | ✅ | فقط دانش‌آموزان خودش | ❌ |
| ثبت علایق/توانایی‌ها | ✅ | دانش‌آموزان خودش | فقط خودش |
| نظر والدین | مشاهده/ثبت | دانش‌آموزان خودش | ثبت برای خودش |
| انجام آزمون | — | — | ✅ |
| محاسبه نتیجه هدایت تحصیلی | ✅ | دانش‌آموزان خودش | ❌ |
| مشاهده نتیجه هدایت تحصیلی | ✅ | دانش‌آموزان خودش | فقط نتیجه خودش |
| ویدئوهای آموزشی | مدیریت | مشاهده | مشاهده |
| تأیید/رد ثبت‌نام مشاور | ✅ | ❌ | ❌ |
| لاگ فعالیت‌ها (Audit Log) | ✅ | ❌ | ❌ |
| صف کامل تیکت‌های پشتیبانی | ✅ (پاسخ/تغییر وضعیت/حذف) | فقط تیکت‌های خودش | فقط تیکت‌های خودش |

ماتریس بالا در `lib/permissions.js` کدنویسی شده و در `tests/security.test.mjs` و
`tests/features.test.mjs` تست می‌شود.

---

## ۹. ساختار پروژه

```
guidance-app/
├── app/
│   ├── layout.js  page.js  globals.css  robots.js  sitemap.js  favicon.ico
│   ├── login/{admin,counselor,student}/page.js
│   ├── register/page.js + register/{student,counselor}/page.js
│   ├── forgot-password/page.js  reset-password/page.js
│   ├── admin/      layout.js + page.js + users students counselors schools classes
│   │               tests grades interests abilities parent-opinions videos
│   │               reports settings security-logs support
│   ├── counselor/  layout.js + page.js + students tests grades reports settings support
│   ├── student/    layout.js + page.js + profile grades tests interests abilities
│   │               parent-opinion guidance videos notifications settings support
│   └── api/        auth/{login,logout,me,change-password,forgot-password,reset-password,register}
│                   audit-logs support/tickets/{,[id]}
│                   users/{,[id]} students/{,[id]} grades interests abilities
│                   parent-opinions tests/{,[id],submit} videos guidance
│                   schools classes counselors/{,[id]} notifications reports
├── components/
│   ├── ui/         button card dialog alert-dialog table badge input label
│   │               dropdown-menu progress separator skeleton toast
│   │               textarea states (Loading/Empty/Error/PageHeader) stat-card
│   ├── auth/       auth-shell (قاب مشترک صفحه‌های ورود/ثبت‌نام/بازیابی)
│   ├── support/    ticket-center (مشترک بین سه پنل)
│   ├── layout/     dashboard-layout sidebar header
│   └── forms/      login-form register-form forgot-password-form
│                   reset-password-form change-password-form
├── lib/            prisma auth server-auth serializers permissions validation
│                   password-policy audit-log support client-api
│                   guidance-engine utils
├── prisma/         schema.prisma seed.js
├── scripts/        verify-auth-http.mjs verify-password-reset.mjs with-mongo.mjs
│                   e2e.mjs (اجرای E2E روی دیتابیس موقت)
│                   lib/runtime.mjs (کمک‌کننده‌های مشترک اجرای Build و پردازش)
├── e2e/            helpers.mjs auth.spec.mjs register.spec.mjs
│                   support.spec.mjs change-password.spec.mjs
├── tests/          security.test.mjs features.test.mjs
├── playwright.config.mjs
├── middleware.js
└── .github/workflows/ci.yml
```

---

## ۱۰. احراز هویت

- رمز عبور با `bcryptjs` (۱۲ round) Hash می‌شود و **Hash هرگز** در هیچ پاسخ API یا
  Payload کلاینت قرار نمی‌گیرد (`lib/serializers.js` تنها شکل مجاز کاربر را تعیین می‌کند).
- Session یک توکن تصادفی ۴۸ بایتی است که در کالکشن `Session` ذخیره و در کوکی
  `guidance-session` با `HttpOnly`, `SameSite=Lax`, `Path=/` و `Secure` در Production
  نگهداری می‌شود. انقضا ۲۴ ساعت است.
- فعال/غیرفعال شدن حساب، Sessionهای موجود را در همان درخواست بعدی بی‌اعتبار می‌کند.
- `POST /api/auth/logout` رکورد Session را از دیتابیس حذف می‌کند (Logout واقعی) و کوکی را پاک می‌کند.
- تغییر رمز عبور نیازمند رمز فعلی است و پس از آن رمز جدید نباید با رمز فعلی یکسان باشد.
  پس از تغییر رمز، Sessionهای سایر دستگاه‌ها باطل می‌شوند (فقط Session جاری معتبر می‌ماند).
- ثبت‌نام عمومی فقط برای دانش‌آموز و مشاور است؛ رمز پیش‌فرض یا مشترکی وجود ندارد و هر
  کاربر رمز خودش را با رعایت سیاست رمز انتخاب می‌کند (بخش ۱۱).
- ورودهای سه پنل **Role-Locked** هستند: هر صفحه Role خودش را به سرور می‌فرستد و سرور
  آن را با Role ذخیره‌شده مقایسه می‌کند؛ بنابراین رمز مدیر روی صفحه‌ی دانش‌آموز کار نمی‌کند.
- Rate Limit ورود: ۵ تلاش ناموفق برای هر `IP + نام کاربری` و ۲۰ تلاش برای هر IP در
  بازه‌ی ۱۵ دقیقه. ورود موفق شمارنده‌ی آن حساب را صفر می‌کند.
- بازیابی رمز عبور: توکن تصادفی ۳۲ بایتی، ذخیره‌شده به‌صورت **HMAC-SHA256** با
  `AUTH_SECRET`، انقضای ۶۰ دقیقه و **یک‌بارمصرف**. پس از Reset، همه‌ی Sessionهای کاربر
  باطل می‌شوند. در Development لینک بازیابی در کنسول سرور و در پاسخ API برمی‌گردد
  (`devResetUrl`) — این فیلد در Production هرگز ارسال نمی‌شود.

---

## ۱۱. ثبت‌نام، پشتیبانی و لاگ فعالیت‌ها

### ثبت‌نام کاربران

| مسیر | چه کسی | نتیجه |
|------|--------|-------|
| `/register` | همه | انتخاب نوع حساب |
| `/register/student` | همه | ثبت‌نام دانش‌آموز — بلافاصله قابل ورود |
| `/register/counselor` | همه | ثبت‌نام مشاور — نیازمند تأیید مدیر |
| `/admin/counselors` | مدیر | صف تأیید: تأیید یا رد + ثبت علت |

- **ثبت‌نام مدیر وجود ندارد.** `registerSchema` یک Discriminated Union است که فقط
  `STUDENT` و `COUNSELOR` را می‌پذیرد و در API هم نقش دوباره بررسی می‌شود؛ بنابراین
  ارسال `role=ADMIN` به این Endpoint نتیجه‌ای جز ۴۰۰ ندارد.
- نام کاربری و رمز عبور را **خود کاربر** انتخاب می‌کند و هر دو فقط شامل حروف انگلیسی و
  اعداد هستند (`^[a-zA-Z0-9]+$` برای نام کاربری و سیاست رمز عبور برای رمز). یکسان بودن
  این قواعد در کلاینت و سرور از `lib/validation.js` و `lib/password-policy.js` می‌آید.
- مشاور تازه‌ثبت‌نام‌شده با `approvalStatus = PENDING` ذخیره می‌شود، رمز او Hash شده است
  اما **اجازه ورود ندارد** (۴۰۳ با پیام فارسی و ثبت در Audit Log). `validateSession` هم
  این وضعیت را در هر درخواست دوباره بررسی می‌کند، پس لغو تأیید یا رد شدن، Sessionهای
  موجود را فوراً بی‌اعتبار می‌کند.
- ثبت‌نام عمومی با Rate Limit روی IP محدود می‌شود (۱۰ ثبت‌نام در ساعت).
- کد دانش‌آموزی اگر وارد نشود، در سرور به‌صورت یکتا ساخته می‌شود.

### بازیابی رمز عبور

| مسیر | کار |
|------|-----|
| `/forgot-password` | درخواست لینک بازیابی بر اساس نام کاربری |
| `/reset-password?token=…` | تعیین رمز جدید با توکن یک‌بارمصرف |
| `POST /api/auth/forgot-password` | ساخت توکن (HMAC-SHA256، انقضای ۶۰ دقیقه) |
| `POST /api/auth/reset-password` | اعمال رمز جدید و باطل‌کردن همه Sessionها |
| `POST /api/auth/change-password` | تغییر رمز با دانستن رمز فعلی (Sessionهای دیگر باطل می‌شوند) |

پاسخ `/forgot-password` همیشه یکسان است تا نام‌های کاربری قابل شناسایی نباشند.

### تیکت پشتیبانی

| مسیر | چه کسی |
|------|--------|
| `/student/support` · `/counselor/support` | ثبت تیکت و پیگیری گفت‌وگو |
| `/admin/support` | مشاهده صف، پاسخ، تغییر وضعیت، حذف |
| `GET/POST /api/support/tickets` | فهرست و ثبت (مالکیت از Session خوانده می‌شود) |
| `GET/PATCH/DELETE /api/support/tickets/[id]` | جزئیات، پاسخ/تغییر وضعیت، حذف (فقط مدیر) |

- وضعیت‌ها: **باز** → **در حال بررسی** → **بسته شده**. پاسخ کارشناس، تیکت `OPEN` را
  خودکار به `IN_PROGRESS` می‌برد.
- تیکت هر کاربر فقط برای خودش و مدیر قابل مشاهده است؛ درخواست تیکت دیگران **۴۰۴**
  می‌گیرد (نه ۴۰۳) تا شناسه‌های معتبر قابل حدس زدن نباشند.
- تیکت بسته‌شده پیام جدید کاربر نمی‌پذیرد؛ تغییر وضعیت فقط برای مدیر مجاز است. مدیر
  می‌تواند در هر وضعیتی به گفت‌وگو پاسخ دهد و از همان صفحه، تیکت را باز/در حال بررسی/بسته کند.
- فلگ‌های `canReply` / `canChangeStatus` در **سرور** محاسبه و به کلاینت داده می‌شوند
  (`toPublicTicket`) و از همان توابعی می‌آیند که خودِ Endpoint اعمال می‌کند
  (`canReplyToTicket` / `canChangeTicketStatus` در `lib/support.js`)، بنابراین دکمه‌هایی که
  کاربر می‌بیند هرگز با آنچه API می‌پذیرد اختلاف ندارند — هیچ UI نمی‌تواند مجوزی به خودش بدهد.

### لاگ فعالیت‌ها (Audit Log)

- صفحه `/admin/security-logs` و Endpoint `GET /api/audit-logs` (فقط مدیر، ۴۰۱ برای
  ناشناس و ۴۰۳ برای سایر نقش‌ها) با فیلتر نوع رویداد، جست‌وجو و صفحه‌بندی.
- هر رکورد در سرور به یک **جمله فارسی** تبدیل می‌شود؛ مثلاً:
  «علی احمدی (دانش‌آموز) وارد سیستم شد» یا «مدیر سیستم ثبت‌نام مشاور «مریم رضایی» را تأیید کرد».
  منطق متن در `lib/audit-log.js` است و هم صفحه‌ی لاگ و هم داشبورد مدیر از همان استفاده می‌کنند.
- رویدادهای ثبت‌شده: ورود، خروج، ورود ناموفق، مسدودسازی موقت ورود، تغییر رمز،
  درخواست/انجام/شکست بازیابی رمز، ثبت‌نام، تأیید/رد مشاور، ایجاد/ویرایش/حذف کاربر و
  دانش‌آموز، تغییر نقش، رویدادهای آزمون و نمره، و رویدادهای تیکت پشتیبانی.
- `sanitizeAuditDetails` پیش از ذخیره، کلیدهای حساس (`password`, `token`, `secret`, …) را
  حذف می‌کند و متن را محدود می‌کند؛ زمان (UTC) و IP (از `x-forwarded-for` /
  `x-real-ip`) ثبت می‌شود. `details` خام هرگز در پاسخ API برنمی‌گردد.

### فایل‌های صفحه اصلی (آپلود مستقیم)

صفحه `/admin/homepage` امکان آپلود مستقیم **عکس، صوت و ویدیو** را از کامپیوتر یا
گوشی می‌دهد. فایل‌ها در Cloudinary ذخیره می‌شوند و فقط Metadata آن‌ها در مدل
`HomeMedia` می‌ماند.

| مسیر | چه کسی |
|------|--------|
| `/admin/homepage` | آپلود، فعال/مخفی کردن، حذف کامل |
| `POST /api/admin/home-media/sign` | صدور امضای کوتاه‌عمر Cloudinary (فقط مدیر) |
| `GET/POST/PATCH/DELETE /api/admin/home-media` | فهرست، ثبت، ویرایش، حذف (فقط مدیر) |
| `GET /api/home-media` | فهرست عمومی موارد فعال (بدون `publicId`) |

**مسیر سه‌مرحله‌ای آپلود:**

```
مرورگر → POST /api/admin/home-media/sign   (امضا؛ API Secret فقط سمت سرور)
       → POST api.cloudinary.com/.../upload (فایل مستقیم به Cloudinary)
       → POST /api/admin/home-media         (ثبت Metadata در MongoDB)
```

فایل از سرور Next عبور نمی‌کند، بنابراین محدودیت حجم بدنه‌ی توابع Serverless
(روی نتفلی حدود ۶ مگابایت) مانع آپلود ویدیو نمی‌شود.

**نکات پیاده‌سازی:**

- صوت با `resourceType = "video"` امضا می‌شود، چون Cloudinary فایل صوتی را به‌عنوان
  منبع ویدیویی ذخیره می‌کند.
- آدرس ذخیره‌شده باید `https` باشد؛ آدرس‌های دیگر با ۴۰۰ رد می‌شوند.
- `createdBy` یک ارجاع **اختیاری** به کاربر است و فقط وقتی نوشته می‌شود که یک
  ObjectId معتبر باشد، پس نبود آن هیچ‌وقت باعث شکست ذخیره نمی‌شود.
- **پاک‌سازی فایل یتیم:** اگر آپلود به Cloudinary موفق شود ولی ثبت در دیتابیس
  شکست بخورد، همان فایل خودکار از Cloudinary حذف می‌شود (با یک بررسی امنیتی: اگر
  رکوردی از قبل به آن `publicId` ارجاع بدهد، حذف انجام نمی‌شود).
- **حذف مقاوم:** اگر پاک‌سازی در Cloudinary شکست بخورد، رکورد دیتابیس باز هم حذف
  می‌شود تا فایل از صفحه اصلی پایین بیاید؛ پاسخ شامل `storageRemoved: false` است.
- **دانلود تشخیصی:** `GET /api/admin/diagnostics` (فقط مدیر) وضعیت پیکربندی را فقط به
  شکل Boolean و شمارنده برمی‌گرداند — بدون هیچ مقدار محیطی. با `?probe=1` یک تست
  نوشتن/خواندن/حذف واقعی هم روی `HomeMedia` اجرا می‌شود.

---

## ۱۲. امنیت

### کنترل‌های پیاده‌شده

- **Authorization سمت سرور** در سه لایه:
  1. `middleware.js` — نبود کوکی را می‌گیرد و به صفحه ورود همان پنل هدایت می‌کند،
     هدرهای امنیتی می‌گذارد، درخواست‌های Cross-Origin را رد می‌کند.
  2. `app/{admin,counselor,student}/layout.js` — با `requireRole()` روی Server
     Session را از دیتابیس اعتبارسنجی و Role را اجبار می‌کند (کاربر نقش‌نامتناسب
     هرگز حتی یک بایت از پنل را دریافت نمی‌کند).
  3. هر API Route — `authenticateRequest()` + بررسی Role + بررسی مالکیت رکورد.
- **IDOR**: هیچ‌جا `studentId` / `userId` / `counselorId` ارسالی کلاینت بدون مقایسه با
  Session استفاده نمی‌شود. فیلترها در خواندن‌ها از Session ساخته می‌شوند و در نوشتن‌ها
  مالکیت رکورد بررسی می‌شود.
- **Mass Assignment**: در همه‌ی `update`ها فقط فیلدهای Whitelist شده کپی می‌شوند و
  Zod کلیدهای ناشناخته را حذف می‌کند.
- **Privilege Escalation**: کاربر نمی‌تواند نقش خودش را تغییر دهد، خودش را غیرفعال یا
  حذف کند. تغییر نقش و حذف کاربر فقط برای ADMIN و با Audit Log انجام می‌شود.
- **CSRF**: کوکی `SameSite=Lax` + بررسی سخت‌گیرانه‌ی هدر `Origin` روی متدهای
  POST/PUT/PATCH/DELETE در Middleware.
- **XSS**: React به‌صورت پیش‌فرض Escape می‌کند؛ `dangerouslySetInnerHTML` در پروژه
  استفاده نشده است؛ CSP در Middleware اعمال می‌شود.
- **Injection**: تمام دسترسی‌ها از Prisma ORM می‌گذرند؛ فیلد Sort با Whitelist محدود شده
  است (`createdAt`, `firstName`, `lastName`, `username`, `role`).
- **Validation**: تمام بدنه‌های ورودی با Zod اعتبارسنجی می‌شوند (طول، نوع، بازه، دامنه‌ی
  مجاز لینک ویدئو، محدودیت تعداد آیتم‌ها).
- **اطلاعات حساس**: هرگز رمز عبور، Hash، Token یا Stack Trace در پاسخ API یا Log
  قرار نمی‌گیرد؛ پیام خطاها فارسی و عمومی است. ماژول `lib/diagnostics.js` پیش از
  نوشتن هر خط لاگ، مقدار `DATABASE_URL`، `AUTH_SECRET`، کلیدهای Cloudinary، رمز
  داخل Connection String و الگوهای `mongodb://` / `cloudinary://` / `Bearer` را
  حذف می‌کند و از `error.meta` فقط کلیدهای Whitelist شده را برمی‌دارد.
- **Endpoint تشخیصی**: `GET /api/admin/diagnostics` فقط برای ADMIN و فقط Boolean/عدد
  برمی‌گرداند؛ برای سایر نقش‌ها ۴۰۳ است تا حتی وجود آن هم علنی نشود.
- **کش مرورگر**: پاسخ‌های `/api/*` و صفحات پنل با `Cache-Control: no-store` ارسال می‌شوند.
- **SEO خصوصی**: تمام صفحات پنل `noindex/nofollow` هستند و در `robots.js` مسدود شده‌اند.
- **Security Headers**: `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`
  (با `frame-ancestors 'none'` و `object-src 'none'`) و `Strict-Transport-Security`
  در Production.
- **Audit Log** برای Login، Failed Login، Rate Limited Login، Logout،
  Create/Update/Delete کاربر و دانش‌آموز، Role Change، Password Change،
  Password Reset (درخواست/انجام/شکست) و محاسبه‌ی هدایت تحصیلی.

### تست‌های امنیتی انجام‌شده

موارد زیر با `npm test` و `npm run verify:auth` (روی سرور Production واقعی) بررسی می‌شوند:

| بررسی | نتیجه |
|-------|-------|
| خالی‌بودن پاسخ‌ها از Hash رمز | ✅ تست خودکار |
| سیاست رمز عبور (طول، دسته‌های کاراکتر، رمزهای ضعیف) | ✅ تست خودکار |
| Rate Limit و بازنشانی آن | ✅ تست خودکار |
| یک‌بارمصرف و دارای انقضا بودن توکن Reset | ✅ تست خودکار |
| امن بودن کوکی Session (HttpOnly/SameSite/Secure) | ✅ تست خودکار |
| نقش‌بندی پنل‌ها (دانش‌آموز → `/admin`) | ✅ تست خودکار |
| دسترسی بدون احراز هویت به APIها (401/403) | ✅ تست HTTP |
| CSRF (Origin بیگانه) | ✅ تست HTTP |
| عدم افشای Stack Trace در خطاها | ✅ تست HTTP |
| هدرهای امنیتی و `no-store` | ✅ تست HTTP |
| ورود/خروج واقعی سه نقش، IDOR، Privilege Escalation، CRUD کاربر/دانش‌آموز | ✅ اسکریپت `verify:live` — PASS |
| چرخه‌ی کامل توکن بازیابی رمز (هش‌شدن، انقضا، یک‌بارمصرف، باطل‌شدن سشن‌ها) | ✅ `verify-password-reset` — ۱۳ بررسی PASS |
| غیرقابل‌ساخت بودن حساب ADMIN از طریق ثبت‌نام عمومی | ✅ تست خودکار + HTTP |
| اجبار قواعد نام کاربری/رمز در ثبت‌نام (حروف انگلیسی و اعداد) | ✅ تست خودکار + HTTP |
| عدم امکان ورود مشاور تا تأیید مدیر، و امکان ورود پس از تأیید | ✅ تست HTTP |
| فقط مدیر بودن تأیید/رد مشاور (۴۰۳ برای سایر نقش‌ها) | ✅ تست HTTP |
| ۴۰۱/۴۰۳ برای خواندن لاگ فعالیت‌ها توسط ناشناس و سایر نقش‌ها | ✅ تست HTTP |
| فارسی، صفحه‌بندی‌شده و بدون Secret بودن خروجی لاگ فعالیت‌ها | ✅ تست HTTP |
| جداسازی تیکت‌ها (۴۰۴ برای تیکت دیگران) و فقط-مدیر بودن حذف/تغییر وضعیت | ✅ تست HTTP |
| جلوگیری از ارسال تکراری با Coalescing درخواست‌های یکسان | ✅ تست خودکار |
| نامعتبر بودن Schema پریزما که Client را قدیمی باقی می‌گذارد (P1012) | ✅ `npm test` + `npm run db:check` + گارد Build |
| عدم نشت Secret در لاگ و پاسخ تشخیصی | ✅ `npm test` + `npm run verify:auth` |
| بسته بودن `home-media` و `diagnostics` برای ناشناس و غیرمدیر | ✅ `npm run verify:auth` |
| پاک‌سازی فایل یتیم Cloudinary پس از شکست ثبت | ✅ `npm test` (منطق حذف و امضا) |
| مسیرهای پنل در مرورگر واقعی (۳۰۷ بدون Session، ریدایرکت بین‌نقشی) | ✅ `npm run test:e2e` |
| کوکی Session در مرورگر (HttpOnly + `SameSite=Lax` + خارج از دسترس جاوااسکریپت) | ✅ `npm run test:e2e` |
| بی‌اعتبار شدن کوکی قدیمی پس از Logout (Replay حمله) | ✅ `npm run test:e2e` |
| رد شدن رمز نادرست و ورود از پنل اشتباه در مرورگر | ✅ `npm run test:e2e` |
| عدم امکان ثبت‌نام ADMIN از UI و API، و نبود صفحه‌ی `/register/admin` | ✅ `npm run test:e2e` |
| ورود مشاور معلق ممنوع و فعال‌شدن پس از تأیید مدیر | ✅ `npm run test:e2e` |
| جداسازی تیکت بین دو دانش‌آموز در سطح مرورگر (۴۰۴) | ✅ `npm run test:e2e` |
| باطل شدن نشست دستگاه دیگر پس از تغییر رمز | ✅ `npm run test:e2e` |

> **محدودیت شناخته‌شده:** Rate Limit در حافظه‌ی پروسه نگهداری می‌شود؛ در استقرار
> چند-Instance باید به یک Store مشترک (Redis/Upstash) منتقل شود. رابط تابع
> (`checkRateLimit` / `resetRateLimit`) طوری نوشته شده که این جابه‌جایی محلی بماند.

---

## ۱۳. تست‌ها

```bash
npm test               # ۹۲ تست امنیت/اعتبارسنجی/ثبت‌نام/پشتیبانی/لاگ/مدیا (بدون نیاز به دیتابیس)
npm run verify:auth    # Build تولیدی روی یک پورت آزاد + بررسی‌های HTTP (۸۰ بررسی روی دیتابیس متصل)
npm run verify:live    # همان + MongoDB موقت + Seed
npm run test:e2e       # ۲۷ تست انتها‌به‌انتها با Playwright روی MongoDB موقت
npm run diagnose:media # تشخیص گام‌به‌گام مسیر ذخیره‌سازی فایل‌های صفحه اصلی
npm run db:check       # اتصال دیتابیس + بررسی ایستای schema.prisma
```

### تست‌های انتها به انتها (Playwright)

`npm run test:e2e` کل استک را موقت و جداگانه بالا می‌آورد: یک **MongoDB موقت
(تک‌نودی ReplicaSet)**، `prisma db push`، `npm run seed`، Build تولیدی و یک سرور
Next روی پورت `3100`. سپس ۲۷ سناریو در **مرورگر واقعی** اجرا می‌شود و در پایان
همه‌چیز (سرور و دیتابیس) متوقف و حذف می‌شود. هیچ داده‌ای به `DATABASE_URL` فایل
`.env` دست نمی‌زند و هیچ Secret یا دیتابیس واقعی لازم نیست.

| فایل | پوشش |
|------|------|
| `e2e/auth.spec.mjs` | مسیرهای محافظت‌شده، ورود سه نقش، رمز نادرست، پنل اشتباه، کوکی HttpOnly، Logout و Replay کوکی |
| `e2e/register.spec.mjs` | ثبت‌نام دانش‌آموز، پالایش نام کاربری، رمز ضعیف، نام تکراری، نبود ثبت‌نام مدیر، تأیید مشاور توسط مدیر |
| `e2e/support.spec.mjs` | ثبت تیکت، گفت‌وگو، پاسخ و تغییر وضعیت توسط مدیر، مشاهده‌ی نتیجه توسط دانش‌آموز، عدم دسترسی دانش‌آموز دیگر |
| `e2e/change-password.spec.mjs` | خطاهای اعتبارسنجی فرم، تغییر رمز موفق، باطل‌شدن نشست دستگاه دیگر، کارکرد رمز جدید و بی‌اعتبار شدن رمز قدیمی |
| `e2e/media.spec.mjs` | کل زنجیره‌ی آپلود در پنل مدیر: امضا → آپلود → ثبت → انتشار در صفحه اصلی → مخفی کردن → حذف، به‌همراه تست کلیک تکراری و بررسی امضای صوت |

> در `e2e/media.spec.mjs` سرویس Cloudinary در سطح شبکه با `page.route` شبیه‌سازی
> می‌شود، بنابراین تست بدون اینترنت و بدون Credential واقعی اجرا می‌شود. امضای سمت
> سرور واقعی است و همین بخش است که یک Schema خراب را تشخیص می‌دهد.

اجرای فقط بخشی از تست‌ها (آرگومان‌ها به Playwright پاس داده می‌شوند):

```bash
npm run test:e2e -- --grep "ورود"     # فیلتر بر اساس عنوان
npm run test:e2e -- e2e/auth.spec.mjs  # فقط یک فایل
E2E_PORT=3200 npm run test:e2e         # تغییر پورت سرور
```

**مرورگر:** به‌صورت پیش‌فرض از Chromium خودِ Playwright استفاده می‌شود
(`npx playwright install chromium`). اگر دانلود آن در شبکه‌ی شما مسدود بود،
کانفیگ خودکار به Chrome نصب‌شده روی سیستم برمی‌گردد؛ برای انتخاب دستی:

```bash
npx playwright install chromium
E2E_BROWSER_CHANNEL=chrome   npm run test:e2e   # Chrome نصب‌شده
E2E_BROWSER_CHANNEL=msedge   npm run test:e2e   # Edge نصب‌شده
E2E_BROWSER_CHANNEL=chromium npm run test:e2e   # اجبار به Chromium بسته‌بندی‌شده
```

> نکته: چون Rate Limit روی `x-forwarded-for` کلید می‌خورد، هر Context تست آدرس
> مستقل و مستند (بازه‌ی `198.51.100.0/24`) می‌فرستد تا سناریوها روی هم اثر نگذارند —
> خودِ محدودیت‌ها اما فعال می‌مانند و بخشی از تست‌ها هستند.

`npm run verify:auth` سرور Production را بالا می‌آورد، بررسی‌ها را انجام می‌دهد و
خودش آن را می‌بندد. اگر دیتابیس `DATABASE_URL` در دسترس باشد، تست‌های زنده‌ی
ورود سه نقش، IDOR، Privilege Escalation، CRUD، Logout و محدودیت‌های مشاور هم اجرا
می‌شوند؛ در غیر این صورت با برچسب `SKIP` گزارش می‌شوند. `npm run verify:live`
همه‌ی این‌ها را با یک MongoDB موقت (بدون نیاز به نصب) اجرا می‌کند و اگر سورس از
آخرین Build جدیدتر باشد، خودش دوباره Build می‌گیرد تا کد قدیمی تست نشود.

آخرین اجرا: `npm test` → ۶۸/۶۸ · `npm run verify:live` →
`ALL CHECKS PASSED — 70 passed, 0 skipped` · `npm run verify:password-reset` → ۱۳/۱۳ ·
`npm run test:e2e` → **۲۵ passed** (Chromium، حدود یک دقیقه).
اسکریپت بررسی، داده‌های آزمایشی خودش را در پایان پاک می‌کند (کاربران و تیکت‌های تستی).

---

## ۱۴. هدایت تحصیلی

الگوریتم در `lib/guidance-engine.js`:

```
WEIGHTS = { grades: 0.35, interests: 0.2, abilities: 0.2, testResults: 0.15, parentOpinion: 0.1 }
```

- ورودی‌ها: نمرات سه سال، علایق، توانایی‌ها، نتایج آزمون‌ها، نظر والدین
- خروجی: حداکثر ۵ رشته‌ی پیشنهادی همراه امتیاز و سطح اطمینان + تحلیل نقاط قوت/ضعف
- خروجی همیشه با این هشدار ذخیره و نمایش داده می‌شود: **«این پیشنهاد صرفاً برای بررسی
  توسط مشاور ارائه شده است و تصمیم نهایی بر عهده مشاور و دانش‌آموز می‌باشد.»**
- وزن‌ها در ابتدای فایل و به‌صورت مستقل قابل تغییرند تا سیاست‌های مختلف هدایت تحصیلی
  بدون دست‌زدن به منطق پیاده‌سازی شوند.

---

## ۱۵. GitHub Actions

Workflow در `.github/workflows/ci.yml`:

```
npm ci → prisma generate → lint → test → build
```

و یک Job مستقل برای تست‌های مرورگری که **هیچ Secretی لازم ندارد** (چون دیتابیس
موقت خودش را می‌سازد):

```
npm ci → prisma generate → npx playwright install --with-deps chromium → npm run test:e2e
```

در صورت شکست E2E، گزارش HTML و Screenshot/Trace به‌صورت Artifact با نام
`playwright-report` آپلود می‌شود (`e2e-report/` و `e2e-artifacts/`).

هیچ Credential در Workflow نوشته نشده است. برای اجرای CI این Secretها را در
Settings → Secrets and variables → Actions تنظیم کنید:

| نوع | نام | توضیح |
|-----|-----|-------|
| Secret | `DATABASE_URL` | رشته اتصال دیتابیس تست |
| Secret | `AUTH_SECRET` | یک رشته تصادفی (فقط برای Build/CI) |
| Variable | `NEXT_PUBLIC_APP_URL` | اختیاری، پیش‌فرض `http://localhost:3000` |

---

## ۱۶. استقرار (Deploy)

1. دیتابیس MongoDB (Atlas) بسازید و کاربری با حداقل دسترسی بگیرید.
2. در سرویس میزبانی (مثلاً Vercel) متغیرهای `DATABASE_URL`, `AUTH_SECRET`,
   `NEXT_PUBLIC_APP_URL` را تنظیم کنید.
3. `npm run build` (یا Build خودکار) و سپس `npm start`.
4. **یک‌بار و فقط یک‌بار** کاربر مدیر اولیه را بسازید. Seed فقط برای Development است؛
   در Production یک Admin با رمز قوی بسازید و بلافاصله رمز را تغییر دهید.
5. اطمینان حاصل کنید سایت روی HTTPS سرو می‌شود (کوکی Session در Production فقط
   روی HTTPS ارسال می‌شود و HSTS فعال است).

---

## ۱۷. اعتبارات Development (فقط محلی)

`npm run seed` این داده‌ها را می‌سازد. **هرگز در Production استفاده نکنید.**

| نقش | نام کاربری | رمز عبور |
|-----|-----------|----------|
| مدیر | `admin` | `Admin@12345` |
| مشاور | `counselor` | `Counselor@12345` |
| دانش‌آموز | `student_1001` .. `student_1004` | `Student@12345` |

دانش‌آموزان جدیدی که از پنل مدیر ساخته می‌شوند، رمز عبور تصادفی امن می‌گیرند
(نه رمز قابل‌حدس بر اساس کد دانش‌آموزی) و رمز فقط یک‌بار در همان پاسخ نمایش داده
می‌شود؛ اگر گم شد، مدیر باید رمز را بازنشانی کند.

---

## ۱۸. محدودیت‌ها و کارهای بعدی

- **Data Fetching سمت کلاینت**: صفحات پنل داده را از APIهای محافظت‌شده در
  Client Component می‌گیرند (به همین دلیل Authorization در APIها خط دفاعی اصلی است).
  مسیر توسعه‌ی طبیعی، انتقال صفحه‌های خواندنی به Server Component با Query مستقیم
  Prisma و استفاده از یک هوک مشترک/کتابخانه‌ی Data Fetching برای بقیه است.
- **Rate Limit در حافظه**: برای استقرار چند-Instance به Store مشترک منتقل شود.
- **ارسال ایمیل بازیابی رمز**: در حال حاضر لینک Reset در Production به کاربر
  ایمیل نمی‌شود (Provider ایمیل متصل نیست)؛ باید یک سرویس ایمیل متصل شود.
- **اطلاع‌رسانی به مشاور داوطلب**: پس از تأیید/رد شدن درخواست، تا اتصال سرویس ایمیل
  خبری به متقاضی ارسال نمی‌شود؛ نتیجه فقط در پنل مدیر قابل مشاهده است.
- **بخش‌های باقی‌مانده پنل مشاور**: صفحه‌های علایق، توانایی‌ها، نظر والدین، نتیجه
  هدایت و ویدئوهای پنل مشاور هنوز جداگانه ساخته نشده‌اند (داده‌ها از طریق پرونده
  دانش‌آموز و آزمون‌ها در دسترس است).
- **آپلود فایل**: فقط بخش صفحه اصلی (عکس/صوت/ویدیو) آپلود مستقیم دارد؛ Thumbnail
  ویدئوهای آموزشی و تصاویر پروفایل فعلاً لینک هستند.
- **مرتب‌سازی کشیدنی**: `sortOrder` روی هر فایل ثبت و رعایت می‌شود، اما جابه‌جایی با
  Drag & Drop در پنل هنوز پیاده نشده است.
- **`mongodb-memory-server`** به‌عنوان devDependency فقط برای `npm run verify:live` است
  و در Production نصب/اجرا نمی‌شود.

---

## ۱۹. عیب‌یابی

| مشکل | راه‌حل |
|------|-------|
| `Error: P1001 Can't reach database server` | `DATABASE_URL` و دسترسی شبکه (Atlas IP Allowlist) را بررسی کنید |
| ورود با «نام کاربری یا رمز عبور صحیح نیست» در حالی که رمز درست است | مطمئن شوید از صفحه‌ی ورود همان نقش استفاده می‌کنید (سه پنل جداگانه‌اند) |
| «تعداد تلاش‌های ورود بیش از حد مجاز است» | ۱۵ دقیقه صبر کنید یا سرور Development را دوباره اجرا کنید (شمارنده در حافظه است) |
| «حساب کاربری غیرفعال است» | کاربر در پنل مدیر غیرفعال شده است |
| «حساب کاربری شما در انتظار تأیید مدیر سیستم است» | مشاور خودش ثبت‌نام کرده است؛ از `/admin/counselors` تأییدش کنید |
| «ثبت‌نام شما توسط مدیر سیستم رد شده است» | درخواست مشاور رد شده است؛ برای بازگشت، مدیر باید حساب را تأیید کند |
| «تیکت یافت نشد» در صفحه پشتیبانی | تیکت متعلق به حساب دیگری است (یا حذف شده است)؛ هر کاربر فقط تیکت‌های خودش را می‌بیند |
| **«ذخیره فایل در سامانه انجام نشد.» در `/admin/homepage`** | `npm run diagnose:media` و `npm run db:check` را اجرا کنید. رایج‌ترین علت، **Schema نامعتبر** است (`@db.ObjectId` جاافتاده) که `prisma generate` را بی‌صدا شکست می‌دهد و یک Prisma Client قدیمی بدون مدل `HomeMedia` باقی می‌گذارد. با `npx prisma validate` و سپس `npm run prisma:generate` رفع می‌شود |
| آپلود کار می‌کند ولی فایل در صفحه اصلی دیده نمی‌شود | وضعیت «نمایش/مخفی» را بررسی کنید؛ فقط موارد `isActive` در `GET /api/home-media` برمی‌گردند |
| «اتصال فضای ذخیره‌سازی فایل هنوز تنظیم نشده است.» | `CLOUDINARY_CLOUD_NAME`، `CLOUDINARY_API_KEY` و `CLOUDINARY_API_SECRET` را تنظیم کنید و سرور را دوباره اجرا کنید (متغیرها در زمان اجرا خوانده می‌شوند) |
| فایل آپلود می‌شود ولی در Cloudinary باقی می‌ماند | اگر ثبت در دیتابیس شکست بخورد، فایل خودکار حذف می‌شود. پیام همراه خطا (`cleanup`) نشان می‌دهد که پاک‌سازی انجام شده یا نه |
| بعد از تغییر رمز، دستگاه دیگر خارج شده است | رفتار عمدی: با تغییر رمز، Sessionهای قبلی باطل می‌شوند |
| فونت فارسی بارگذاری نمی‌شود | `next/font` در زمان Build فونت را می‌گیرد؛ Build را با دسترسی شبکه اجرا کنید |
| لاگین در CI کار نمی‌کند | Secretهای `DATABASE_URL` و `AUTH_SECRET` را تنظیم کنید |
