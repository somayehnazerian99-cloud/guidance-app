import Link from "next/link";
import { GraduationCap, Presentation, PlayCircle, ShieldCheck, ExternalLink } from "lucide-react";
import prisma from "@/lib/prisma";

export const metadata = {
  title: "سیستم هدایت تحصیلی",
  description: "سیستم جامع هدایت تحصیلی دانش‌آموزان متوسطه اول",
  robots: { index: true, follow: true },
};

export const dynamic = "force-dynamic";

const INTRO_VIDEO_URL =
  "https://www.picofile.com/f/pMzB7cBxj0/InShot-20260914-125859871.mp4";

async function getHomepageItems() {
  try {
    return await prisma.educationalVideo.findMany({
      where: { isActive: true, category: "HOMEPAGE" },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    return [];
  }
}

function getContentType(item) {
  if (item.thumbnail && item.videoUrl === item.thumbnail) return "IMAGE";
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(item.videoUrl)) return "VIDEO";
  return "LINK";
}

export default async function HomePage() {
  const items = await getHomepageItems();

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 px-4 py-8 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-4xl shadow-xl ring-8 ring-primary/10">
            🎓
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground md:text-5xl">سیستم هدایت تحصیلی</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            سامانه جامع هدایت تحصیلی دانش‌آموزان متوسطه اول
          </p>
        </section>

        <section className="overflow-hidden rounded-3xl border bg-card shadow-xl">
          <div className="border-b bg-primary/5 px-5 py-4 md:px-7">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><PlayCircle className="h-6 w-6" /></div>
              <div>
                <h2 className="text-lg font-bold md:text-xl">معرفی سامانه</h2>
                <p className="text-sm text-muted-foreground">برای آشنایی با سامانه، ویدیوی معرفی را مشاهده کنید.</p>
              </div>
            </div>
          </div>
          <div className="bg-black p-0">
            <video className="mx-auto aspect-video w-full max-h-[620px] object-contain" controls playsInline preload="metadata" src={INTRO_VIDEO_URL}>
              مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند.
              <a href={INTRO_VIDEO_URL}>مشاهده مستقیم ویدیو</a>
            </video>
          </div>
        </section>

        {items.length > 0 && (
          <section className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-bold md:text-2xl">مطالب و لینک‌های مهم</h2>
              <p className="mt-1 text-sm text-muted-foreground">مطالبی که مدیر سامانه برای شما منتشر کرده است.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((item) => {
                const type = getContentType(item);
                if (type === "IMAGE") {
                  return (
                    <article key={item.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                      <img src={item.videoUrl} alt={item.title} className="max-h-[360px] w-full object-cover" />
                      <div className="p-5">
                        <h3 className="font-bold">{item.title}</h3>
                        {item.description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>}
                      </div>
                    </article>
                  );
                }
                if (type === "VIDEO") {
                  return (
                    <article key={item.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                      <video src={item.videoUrl} controls playsInline preload="metadata" className="aspect-video w-full bg-black object-contain" />
                      <div className="p-5">
                        <h3 className="font-bold">{item.title}</h3>
                        {item.description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>}
                      </div>
                    </article>
                  );
                }
                return (
                  <a key={item.id} href={item.videoUrl} target="_blank" rel="noreferrer" className="group flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                    <div>
                      <h3 className="font-bold group-hover:text-primary">{item.title}</h3>
                      {item.description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>}
                    </div>
                    <ExternalLink className="h-5 w-5 shrink-0 text-primary" />
                  </a>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <div className="mb-4 text-center">
            <h2 className="text-xl font-bold md:text-2xl">ورود به سامانه</h2>
            <p className="mt-1 text-sm text-muted-foreground">نقش کاربری خود را انتخاب کنید.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/login/admin" className="group"><div className="h-full rounded-2xl border bg-card p-6 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-2xl dark:bg-red-900/30">🛡️</div><h3 className="text-lg font-bold">مدیریت</h3><p className="mt-1 text-sm text-muted-foreground">ورود مدیر سیستم</p></div></Link>
            <Link href="/login/counselor" className="group"><div className="h-full rounded-2xl border bg-card p-6 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-2xl dark:bg-blue-900/30">👨‍🏫</div><h3 className="text-lg font-bold">مشاوره</h3><p className="mt-1 text-sm text-muted-foreground">ورود مشاور</p></div></Link>
            <Link href="/login/student" className="group"><div className="h-full rounded-2xl border bg-card p-6 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-2xl dark:bg-green-900/30">📚</div><h3 className="text-lg font-bold">دانش‌آموز</h3><p className="mt-1 text-sm text-muted-foreground">ورود دانش‌آموز</p></div></Link>
          </div>
        </section>

        <section className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur md:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="h-6 w-6" /></div>
            <h2 className="text-lg font-bold">حساب کاربری ندارید؟</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">دانش‌آموزان می‌توانند ثبت‌نام کنند و ثبت‌نام مشاوران پس از تأیید مدیر سیستم فعال می‌شود.</p>
          </div>
          <div className="mx-auto mt-5 grid max-w-2xl gap-3 sm:grid-cols-2">
            <Link href="/register/student" className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"><GraduationCap className="h-4 w-4" />ثبت‌نام دانش‌آموز</Link>
            <Link href="/register/counselor" className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors hover:border-primary/50"><Presentation className="h-4 w-4" />ثبت‌نام مشاور</Link>
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground">ثبت‌نام مدیر سیستم به‌صورت عمومی امکان‌پذیر نیست. رمز عبور خود را فراموش کرده‌اید؟ <Link href="/forgot-password" className="font-medium text-primary hover:underline">بازیابی رمز عبور</Link></p>
        </section>

        <footer className="pb-4 text-center text-sm text-muted-foreground">© {new Date().getFullYear()} سیستم هدایت تحصیلی - تمامی حقوق محفوظ است</footer>
      </div>
    </main>
  );
}
