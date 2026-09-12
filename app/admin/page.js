"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState, EmptyState, PageHeader } from "@/components/ui/states";
import { StatCard } from "@/components/ui/stat-card";
import { apiRequest } from "@/lib/client-api";
import { describeAuditLog } from "@/lib/audit-log";
import { formatDateTime } from "@/lib/utils";
import {
  Users,
  GraduationCap,
  Presentation,
  School,
  ClipboardList,
  CheckCircle,
  LayoutDashboard,
  UserCheck,
  LifeBuoy,
  BarChart3,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function AdminDashboard() {
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");

  const fetchStats = React.useCallback(() => {
    return apiRequest("/api/reports?type=dashboard")
      .then((response) => {
        if (!response.ok) {
          setLoadError("دریافت آمار داشبورد با خطا مواجه شد.");
          return;
        }
        setStats(response.data);
        setLoadError("");
      })
      .catch(() => setLoadError("دریافت آمار داشبورد با خطا مواجه شد."))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingState variant="cards" rows={6} />
      </div>
    );
  }

  if (loadError) {
    return <ErrorState description={loadError} onRetry={() => fetchStats()} />;
  }

  const chartData = [
    { name: "دانش‌آموزان", تعداد: stats?.totalStudents || 0 },
    { name: "مشاوران", تعداد: stats?.totalCounselors || 0 },
    { name: "کاربران", تعداد: stats?.totalUsers || 0 },
    { name: "مدارس", تعداد: stats?.totalSchools || 0 },
  ];

  const pendingCounselors = stats?.pendingCounselors || 0;
  const openTickets = stats?.openTickets || 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="داشبورد مدیریت"
        description="نمای کلی کاربران، پرونده‌ها و فعالیت‌های سامانه هدایت تحصیلی"
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/security-logs">
              <Activity className="h-4 w-4" />
              مشاهده لاگ کامل
            </Link>
          </Button>
        }
      />

      {/* Work that is waiting on the administrator */}
      {(pendingCounselors > 0 || openTickets > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {pendingCounselors > 0 && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
                    <UserCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{pendingCounselors} درخواست تأیید مشاور</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      این مشاوران تا تأیید شما امکان ورود به سامانه را ندارند.
                    </p>
                  </div>
                </div>
                <Button asChild size="sm">
                  <Link href="/admin/counselors">بررسی</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {openTickets > 0 && (
            <Card className="border-blue-500/40 bg-blue-500/5">
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-600">
                    <LifeBuoy className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{openTickets} تیکت پشتیبانی باز</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      تیکت‌های باز یا در حال بررسی کاربران.
                    </p>
                  </div>
                </div>
                <Button asChild size="sm">
                  <Link href="/admin/support">پاسخ‌دهی</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="کل کاربران"
          value={stats?.totalUsers || 0}
          icon={Users}
          tone="primary"
          href="/admin/users"
        />
        <StatCard
          title="دانش‌آموزان"
          value={stats?.totalStudents || 0}
          icon={GraduationCap}
          tone="emerald"
          href="/admin/students"
        />
        <StatCard
          title="مشاوران"
          value={stats?.totalCounselors || 0}
          icon={Presentation}
          tone="blue"
          href="/admin/counselors"
        />
        <StatCard
          title="مدارس"
          value={stats?.totalSchools || 0}
          icon={School}
          tone="amber"
          href="/admin/schools"
        />
        <StatCard
          title="آزمون‌های انجام‌شده"
          value={stats?.totalTests || 0}
          icon={ClipboardList}
          tone="violet"
          href="/admin/tests"
        />
        <StatCard
          title="پرونده‌های کامل"
          value={stats?.completedProfiles || 0}
          icon={CheckCircle}
          tone="emerald"
          hint="دانش‌آموزانی که اطلاعات پرونده‌شان تکمیل شده است"
          href="/admin/reports"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              نمودار آماری سامانه
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ direction: "rtl", fontFamily: "inherit" }}
                    formatter={(value) => [value, "تعداد"]}
                  />
                  <Bar dataKey="تعداد" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              فعالیت‌های اخیر
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/security-logs">همه</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats?.recentActivity?.length ? (
              <ul className="space-y-3">
                {stats.recentActivity.map((activity) => {
                  // The raw audit row is rendered with the shared Persian
                  // formatter, so the dashboard and the audit page word the
                  // same event identically.
                  const described = describeAuditLog(activity);
                  return (
                    <li
                      key={activity.id}
                      className="border-b border-dashed pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{described.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(activity.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm leading-6">{described.sentence}</p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={Activity}
                title="فعالیتی ثبت نشده است"
                description="به‌محض انجام عملیات توسط کاربران، رویدادها در این بخش نمایش داده می‌شوند."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
