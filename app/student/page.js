"use client";
import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function StudentDashboard() {
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    fetch("/api/reports?type=dashboard").then(r=>r.json()).then(setStats).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48"/><Skeleton className="h-32"/><Skeleton className="h-32"/></div>;
  const avg = stats?.avgGrade ?? 0;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">داشبورد دانش‌آموز</h1><p className="text-muted-foreground mt-1">وضعیت پرونده هدایت تحصیلی شما</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm">میانگین نمرات</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{avg}</div><Progress value={(avg/20)*100} className="mt-2"/></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">آزمون‌های انجام‌شده</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats?.totalTests ?? 0}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">وضعیت پرونده</CardTitle></CardHeader><CardContent><Badge variant={stats?.profileComplete ? "default":"secondary"}>{stats?.profileComplete ? "کامل":"ناقص"}</Badge></CardContent></Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle>علایق ثبت‌شده</CardTitle><CardDescription>{stats?.interestsCount ?? 0} مورد</CardDescription></CardHeader><CardContent><Button asChild variant="outline"><Link href="/student/interests">مدیریت علایق</Link></Button></CardContent></Card>
        <Card><CardHeader><CardTitle>توانایی‌ها</CardTitle><CardDescription>{stats?.abilitiesCount ?? 0} مورد</CardDescription></CardHeader><CardContent><Button asChild variant="outline"><Link href="/student/abilities">مدیریت توانایی‌ها</Link></Button></CardContent></Card>
      </div>
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20"><CardHeader><CardTitle className="text-amber-800 dark:text-amber-200">یادآوری</CardTitle></CardHeader><CardContent className="text-sm text-amber-900 dark:text-amber-100">نتیجه هدایت تحصیلی صرفاً «پیشنهاد اولیه برای بررسی توسط مشاور» است و تصمیم نهایی بر عهده مشاور و شما می‌باشد.</CardContent></Card>
    </div>
  );
}
