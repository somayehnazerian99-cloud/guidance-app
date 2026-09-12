"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState, PageHeader } from "@/components/ui/states";
import { StatCard } from "@/components/ui/stat-card";
import { apiRequest } from "@/lib/client-api";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  FileText,
  BarChart3,
  LifeBuoy,
  Info,
} from "lucide-react";

export default function CounselorDashboard() {
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
        <LoadingState variant="cards" rows={3} />
      </div>
    );
  }

  if (loadError) {
    return <ErrorState description={loadError} onRetry={() => fetchStats()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="داشبورد مشاور"
        description="خلاصه وضعیت دانش‌آموزان تحت پوشش شما — فقط دانش‌آموزان تخصیص‌یافته به شما نمایش داده می‌شوند."
        actions={
          <Button asChild variant="outline">
            <Link href="/counselor/students">
              <Users className="h-4 w-4" />
              دانش‌آموزان من
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="دانش‌آموزان من"
          value={stats?.myStudents ?? 0}
          icon={Users}
          tone="blue"
          href="/counselor/students"
        />
        <StatCard
          title="آزمون‌های تکمیل‌شده"
          value={stats?.completedTests ?? 0}
          icon={ClipboardCheck}
          tone="violet"
          href="/counselor/tests"
        />
        <StatCard
          title="نتایج هدایت تحصیلی"
          value={stats?.guidanceResults ?? 0}
          icon={FileText}
          tone="emerald"
          href="/counselor/reports"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">کارهای پیشنهادی</CardTitle>
            <CardDescription>
              مسیرهای پرکاربرد برای بررسی پرونده دانش‌آموزان و ثبت اطلاعات مشاوره‌ای.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button asChild variant="outline" className="justify-start">
              <Link href="/counselor/students">بررسی پرونده دانش‌آموزان</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/counselor/grades">مشاهده و ثبت نمرات</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/counselor/tests">آزمون‌های مشاوره‌ای</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/counselor/reports">
                <BarChart3 className="h-4 w-4" />
                گزارش‌ها
              </Link>
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
              برای اعلام مشکل دسترسی یا اطلاعات نادرست، تیکت پشتیبانی ثبت کنید.
            </p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/counselor/support">ثبت تیکت پشتیبانی</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 p-5">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm leading-7 text-amber-900 dark:text-amber-100">
            نتیجه تولیدشده توسط سامانه فقط «پیشنهاد اولیه» است؛ بررسی نهایی و ثبت نظر مشاور
            بر عهده شماست.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
