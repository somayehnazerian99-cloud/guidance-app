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
```

| متغیر | کاربرد |
|-------|--------|
| `DATABASE_URL` | رشته اتصال MongoDB |
| `AUTH_SECRET` | کلید سرور برای HMAC توکن‌های بازیابی رمز عبور. در Production **الزامی** است |
| `NEXT_PUBLIC_APP_URL` | آدرس پایه‌ی سایت (لینک بازیابی رمز، Metadata و Canonical) |

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
npx prisma validate     # اعتبارسنجی Schema
npx prisma generate     # تولید Prisma Client
npm run seed            # پر کردن دیتابیس با داده‌های نمونه
```

> این پروژه از `prisma db push` و Migration استفاده نمی‌کند چون MongoDB بدون Schema
> است؛ Prisma Client از `schema.prisma` ساخته می‌شود و ایندکس‌ها در سطح Application
> تعریف شده‌اند.

### مدل‌های دیتابیس (۲۰ مدل)

| گروه | مدل‌ها |
|------|--------|
| احراز هویت | `User`, `Session`, `PasswordResetToken` |
| سازمانی | `School`, `Class`, `CounselorProfile`, `StudentProfile` |
| داده‌های دانش‌آموز | `Grade`, `Interest`, `Ability`, `ParentOpinion`, `Notification` |
| آزمون‌ها | `GuidanceTest`, `Question`, `Option`, `TestAttempt`, `TestAnswer` |
| خروجی و محتوا | `GuidanceResult`, `EducationalVideo` |
| حسابرسی | `AuditLog` |

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

ماتریس بالا در `lib/permissions.js` کدنویسی شده و در `tests/security.test.mjs` تست می‌شود.

---

## ۹. ساختار پروژه

```
guidance-app/
├── app/
│   ├── layout.js  page.js  globals.css  robots.js  sitemap.js  favicon.ico
│   ├── login/{admin,counselor,student}/page.js
│   ├── reset-password/page.js
│   ├── admin/      layout.js + page.js + users students counselors schools classes
│   │               tests grades interests abilities parent-opinions videos
│   │               reports settings security-logs
│   ├── counselor/  layout.js + page.js + students tests grades reports settings
│   ├── student/    layout.js + page.js + profile grades tests interests abilities
│   │               parent-opinion guidance videos notifications settings
│   └── api/        auth/{login,logout,me,change-password,forgot-password,reset-password}
│                   users/{,[id]} students/{,[id]} grades interests abilities
│                   parent-opinions tests/{,[id],submit} videos guidance
│                   schools classes counselors notifications reports
├── components/
│   ├── ui/         button card dialog alert-dialog table badge input label
│   │               dropdown-menu progress separator skeleton toast
│   ├── layout/     dashboard-layout sidebar header
│   └── forms/      login-form reset-password-form
├── lib/            prisma auth server-auth serializers permissions validation
│                   guidance-engine utils
├── prisma/         schema.prisma seed.js
├── scripts/        verify-auth-http.mjs
├── tests/          security.test.mjs
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
- ورودهای سه پنل **Role-Locked** هستند: هر صفحه Role خودش را به سرور می‌فرستد و سرور
  آن را با Role ذخیره‌شده مقایسه می‌کند؛ بنابراین رمز مدیر روی صفحه‌ی دانش‌آموز کار نمی‌کند.
- Rate Limit ورود: ۵ تلاش ناموفق برای هر `IP + نام کاربری` و ۲۰ تلاش برای هر IP در
  بازه‌ی ۱۵ دقیقه. ورود موفق شمارنده‌ی آن حساب را صفر می‌کند.
- بازیابی رمز عبور: توکن تصادفی ۳۲ بایتی، ذخیره‌شده به‌صورت **HMAC-SHA256** با
  `AUTH_SECRET`، انقضای ۶۰ دقیقه و **یک‌بارمصرف**. پس از Reset، همه‌ی Sessionهای کاربر
  باطل می‌شوند. در Development لینک بازیابی در کنسول سرور و در پاسخ API برمی‌گردد
  (`devResetUrl`) — این فیلد در Production هرگز ارسال نمی‌شود.

---

## ۱۱. امنیت

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
  قرار نمی‌گیرد؛ پیام خطاها فارسی و عمومی است.
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
| ورود/خروج واقعی سه نقش، IDOR، Privilege Escalation، CRUD کاربر/دانش‌آموز | ✅ اسکریپت `verify:live` — ۵۶ بررسی PASS |
| چرخه‌ی کامل توکن بازیابی رمز (هش‌شدن، انقضا، یک‌بارمصرف، باطل‌شدن سشن‌ها) | ✅ `verify-password-reset` — ۱۳ بررسی PASS |

> **محدودیت شناخته‌شده:** Rate Limit در حافظه‌ی پروسه نگهداری می‌شود؛ در استقرار
> چند-Instance باید به یک Store مشترک (Redis/Upstash) منتقل شود. رابط تابع
> (`checkRateLimit` / `resetRateLimit`) طوری نوشته شده که این جابه‌جایی محلی بماند.

---

## ۱۲. تست‌ها

```bash
npm test            # ۳۳ تست امنیت/اعتبارسنجی/موتور هدایت تحصیلی (بدون نیاز به دیتابیس)
npm run verify:auth # Build تولیدی روی یک پورت آزاد + ۳۰ بررسی HTTP
npm run verify:live # همان + MongoDB موقت + Seed + ۵۶ بررسی HTTP/زنده + ۱۳ بررسی Reset
```

`npm run verify:auth` سرور Production را بالا می‌آورد، بررسی‌ها را انجام می‌دهد و
خودش آن را می‌بندد. اگر دیتابیس `DATABASE_URL` در دسترس باشد، تست‌های زنده‌ی
ورود سه نقش، IDOR، Privilege Escalation، CRUD، Logout و محدودیت‌های مشاور هم اجرا
می‌شوند؛ در غیر این صورت با برچسب `SKIP` گزارش می‌شوند. `npm run verify:live`
همه‌ی این‌ها را با یک MongoDB موقت (بدون نیاز به نصب) اجرا می‌کند و اگر سورس از
آخرین Build جدیدتر باشد، خودش دوباره Build می‌گیرد تا کد قدیمی تست نشود.

خروجی آخرین اجرا: `Schema pushed` → `Seed completed` → `PASSWORD RESET CHECKS PASSED (13/13)`
→ `ALL CHECKS PASSED (56 passed, 1 skipped)`.

---

## ۱۳. هدایت تحصیلی

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

## ۱۴. GitHub Actions

Workflow در `.github/workflows/ci.yml`:

```
npm ci → prisma generate → lint → test → build
```

هیچ Credential در Workflow نوشته نشده است. برای اجرای CI این Secretها را در
Settings → Secrets and variables → Actions تنظیم کنید:

| نوع | نام | توضیح |
|-----|-----|-------|
| Secret | `DATABASE_URL` | رشته اتصال دیتابیس تست |
| Secret | `AUTH_SECRET` | یک رشته تصادفی (فقط برای Build/CI) |
| Variable | `NEXT_PUBLIC_APP_URL` | اختیاری، پیش‌فرض `http://localhost:3000` |

---

## ۱۵. استقرار (Deploy)

1. دیتابیس MongoDB (Atlas) بسازید و کاربری با حداقل دسترسی بگیرید.
2. در سرویس میزبانی (مثلاً Vercel) متغیرهای `DATABASE_URL`, `AUTH_SECRET`,
   `NEXT_PUBLIC_APP_URL` را تنظیم کنید.
3. `npm run build` (یا Build خودکار) و سپس `npm start`.
4. **یک‌بار و فقط یک‌بار** کاربر مدیر اولیه را بسازید. Seed فقط برای Development است؛
   در Production یک Admin با رمز قوی بسازید و بلافاصله رمز را تغییر دهید.
5. اطمینان حاصل کنید سایت روی HTTPS سرو می‌شود (کوکی Session در Production فقط
   روی HTTPS ارسال می‌شود و HSTS فعال است).

---

## ۱۶. اعتبارات Development (فقط محلی)

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

## ۱۷. محدودیت‌ها و کارهای بعدی

- **Data Fetching سمت کلاینت**: صفحات پنل داده را از APIهای محافظت‌شده در
  Client Component می‌گیرند (به همین دلیل Authorization در APIها خط دفاعی اصلی است).
  مسیر توسعه‌ی طبیعی، انتقال صفحه‌های خواندنی به Server Component با Query مستقیم
  Prisma و استفاده از یک هوک مشترک/کتابخانه‌ی Data Fetching برای بقیه است.
- **Rate Limit در حافظه**: برای استقرار چند-Instance به Store مشترک منتقل شود.
- **ارسال ایمیل بازیابی رمز**: در حال حاضر لینک Reset در Production به کاربر
  ایمیل نمی‌شود (Provider ایمیل متصل نیست)؛ باید یک سرویس ایمیل متصل شود.
- **آپلود فایل**: Thumbnail ویدئو و تصاویر پروفایل فعلاً فقط لینک هستند.
- **تست مرورگر (E2E)**: تست‌های فعلی در سطح HTTP/دیتابیس هستند؛ برای پوشش کلیک‌به‌کلیک
  رابط کاربری می‌توان Playwright اضافه کرد.
- **`mongodb-memory-server`** به‌عنوان devDependency فقط برای `npm run verify:live` است
  و در Production نصب/اجرا نمی‌شود.

---

## ۱۸. عیب‌یابی

| مشکل | راه‌حل |
|------|-------|
| `Error: P1001 Can't reach database server` | `DATABASE_URL` و دسترسی شبکه (Atlas IP Allowlist) را بررسی کنید |
| ورود با «نام کاربری یا رمز عبور صحیح نیست» در حالی که رمز درست است | مطمئن شوید از صفحه‌ی ورود همان نقش استفاده می‌کنید (سه پنل جداگانه‌اند) |
| «تعداد تلاش‌های ورود بیش از حد مجاز است» | ۱۵ دقیقه صبر کنید یا سرور Development را دوباره اجرا کنید (شمارنده در حافظه است) |
| «حساب کاربری غیرفعال است» | کاربر در پنل مدیر غیرفعال شده است |
| فونت فارسی بارگذاری نمی‌شود | `next/font` در زمان Build فونت را می‌گیرد؛ Build را با دسترسی شبکه اجرا کنید |
| لاگین در CI کار نمی‌کند | Secretهای `DATABASE_URL` و `AUTH_SECRET` را تنظیم کنید |
