"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CounselorReportsPage() {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(()=>{
    Promise.all([fetch("/api/reports?type=dashboard").then(r=>r.json()), fetch("/api/reports?type=grade-summary").then(r=>r.json())])
      .then(([d,g])=>setData({dashboard:d, grades:g})).finally(()=>setLoading(false));
  },[]);
  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full"/><Skeleton className="h-32 w-full"/></div>;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">گزارش‌ها</h1><p className="text-muted-foreground mt-1">گزارش عملکرد دانش‌آموزان</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm">تعداد دانش‌آموزان</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data?.dashboard?.myStudents ?? 0}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">آزمون‌های تکمیل‌شده</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data?.dashboard?.completedTests ?? 0}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">تعداد نمرات ثبت‌شده</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data?.grades?.totalGrades ?? 0}</div></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>میانگین نمرات به تفکیک درس</CardTitle></CardHeader><CardContent>
        {!data?.grades?.summary?.length ? <p className="text-sm text-muted-foreground">داده‌ای وجود ندارد</p> :
        <div className="space-y-2">{data.grades.summary.map(s=>(
          <div key={s.subject} className="flex justify-between border-b py-2 text-sm"><span>{s.subject}</span><span className="font-bold">{s.average} ({s.count} نمره)</span></div>
        ))}</div>}
      </CardContent></Card>
    </div>
  );
}
