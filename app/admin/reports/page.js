"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function AdminReportsPage(){
  const [data, setData] = React.useState(null);
  const [grades, setGrades] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(()=>{
    Promise.all([fetch("/api/reports?type=dashboard").then(r=>r.json()), fetch("/api/reports?type=grade-summary").then(r=>r.json())])
      .then(([d,g])=>{ setData(d); setGrades(g); }).finally(()=>setLoading(false));
  },[]);
  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full"/><Skeleton className="h-64 w-full"/></div>;
  const chartData = grades?.summary?.map(s=>({ name:s.subject, میانگین: s.average })) || [];
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">گزارش‌ها</h1><p className="text-muted-foreground mt-1">گزارش کلی سیستم</p></div>
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">کل کاربران</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data?.totalUsers ?? 0}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">دانش‌آموزان</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data?.totalStudents ?? 0}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">آزمون‌های انجام‌شده</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data?.totalTests ?? 0}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">تعداد نمرات</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{grades?.totalGrades ?? 0}</div></CardContent></Card>
      </div>
      {chartData.length>0 && <Card><CardHeader><CardTitle>میانگین نمرات به تفکیک درس</CardTitle></CardHeader><CardContent><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis domain={[0,20]}/><Tooltip/><Bar dataKey="میانگین" fill="var(--primary)" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></CardContent></Card>}
      {data?.recentActivity?.length>0 && <Card><CardHeader><CardTitle>فعالیت‌های اخیر</CardTitle></CardHeader><CardContent className="space-y-2">
        {data.recentActivity.map(a=>(
          <div key={a.id} className="flex justify-between border-b py-2 text-sm"><span>{a.user?.firstName} {a.user?.lastName} — {a.action}</span><span className="text-muted-foreground">{new Date(a.createdAt).toLocaleDateString("fa-IR")}</span></div>
        ))}
      </CardContent></Card>}
    </div>
  );
}
