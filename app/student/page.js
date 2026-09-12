"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LoadingState, ErrorState, PageHeader } from "@/components/ui/states";
import { StatCard } from "@/components/ui/stat-card";
import { apiRequest } from "@/lib/client-api";
import {
  LayoutDashboard,
  BarChart3,
  ClipboardList,
  Star,
  Brain,
  FileText,
  Video,
  LifeBuoy,
  Info,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function StudentDashboard() {
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");

  const fetchStats = React.useCallback(() => {
    return apiRequest("/api/reports?type=dashboard")
      .then((response) => {
        if (!response.ok) {
          setLoadError("دریافت اطلاعات داشبورد با خطا مواجه شد.");
          return;
        }
        setStats(response.data);
        setLoadError("");
      })
      .catch(() => setLoadError("دریافت اطلاعات داشبورد با خطا مواجه شد."))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingState variant="cards" rows={4} />
      </div>
    );
  }

  if (loadError) {
    return <ErrorState description={loadError} onRetry={() => fetchStats()} />;
  }

  const average = stats?.avgGrade ?? 0;
  const profileComplete = Boolean(stats?.profileComplete);
  const interestsCount = stats?.interestsCount ?? 0;
  const abilitiesCount = stats?.abilitiesCount ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="داشبورد دانش‌آموز"
        description="وضعیت پرونده هدایت تحصیلی شما در یک نگاه"
        actions={
          <Button asChild variant="outline">
            <Link href="/student/guidance">
              <FileText className="h-4 w-4" />
              نتیجه هدایت تحصیلی
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="میانگین نمرات"
          value={average}
          hint="میانگین تمام نمرات ثبت‌شده"
          icon={BarChart3}
          tone="blue"
          href="/student/grades"
        />
        <StatCard
          title="آزمون‌های انجام‌شده"
          value={stats?.totalTests ?? 0}
          icon={ClipboardList}
          tone="violet"
          href="/student/tests"
        />
        <StatCard
          title="علایق ثبت‌شده"
          value={interestsCount}
          icon={Star}
          tone="amber"
          href="/student/interests"
        />
        <StatCard
          title="توانایی‌های ثبت‌شده"
          value={abilitiesCount}
          icon={Brain}
          tone="emerald"
          href="/student/abilities"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">وضعیت تکمیل پرونده</CardTitle>
            <CardDescription>
              پرونده‌ای که کامل باشد، پیشنهاد هدایت تحصیلی دقیق‌تری تولید می‌کند.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant={profileComplete ? "default" : "secondary"}>
                {profileComplete ? "پرونده کامل است" : "پرونده ناقص است"}
              </Badge>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {profileComplete ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    همه اطلاعات لازم ثبت شده است
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                    برخی اطلاعات هنوز ثبت نشده است
                  </>
                )}
              </span>
            </div>

            <Progress value={Math.min(100, (average / 20) * 100)} />

            <div className="grid gap-3 sm:grid-cols-2">
              <Button asChild variant="outline" className="justify-start">
                <Link href="/student/grades">ثبت و مشاهده نمرات</Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href="/student/profile">تکمیل پروفایل</Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href="/student/interests">علایق من</Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href="/student/abilities">توانایی‌های من</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Video className="h-4 w-4 text-primary" />
                ویدئوهای آموزشی
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm leading-6 text-muted-foreground">
                ویدئوهای معرفی رشته‌های تحصیلی و روش انتخاب مسیر را ببینید.
              </p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/student/videos">مشاهده ویدئوها</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <LifeBuoy className="h-4 w-4 text-primary" />
                پشتیبانی
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm leading-6 text-muted-foreground">
                در صورت بروز مشکل در نمرات یا آزمون‌ها، تیکت پشتیبانی ثبت کنید.
              </p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/student/support">ثبت تیکت پشتیبانی</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 p-5">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm leading-7 text-amber-900 dark:text-amber-100">
            نتیجه هدایت تحصیلی این سامانه «پیشنهاد اولیه برای بررسی توسط مشاور» است و جایگزین
            تصمیم مشاور و خانواده نیست.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
