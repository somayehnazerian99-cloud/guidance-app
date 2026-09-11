"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ClipboardCheck, FileText } from "lucide-react";

export default function CounselorDashboard() {
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    fetch("/api/reports?type=dashboard").then(r=>r.json()).then(setStats).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48"/><div className="grid gap-4 md:grid-cols-3">{[1,2,3].map(i=><Skeleton key={i} className="h-28"/>)}</div></div>;
  const cards = [
    { title: "دانش‌آموزان من", value: stats?.myStudents ?? 0, icon: Users },
    { title: "آزمون‌های تکمیل‌شده", value: stats?.completedTests ?? 0, icon: ClipboardCheck },
    { title: "نتایج هدایت", value: stats?.guidanceResults ?? 0, icon: FileText },
  ];
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">داشبورد مشاور</h1><p className="text-muted-foreground mt-1">خلاصه دانش‌آموزان تحت پوشش شما</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(c=>(
          <Card key={c.title}><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{c.title}</CardTitle><c.icon className="h-4 w-4 text-primary"/></CardHeader><CardContent><div className="text-2xl font-bold">{c.value}</div></CardContent></Card>
        ))}
      </div>
    </div>
  );
}
