"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function CounselorTestsPage() {
  const [tests, setTests] = React.useState([]);
  const [attempts, setAttempts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(()=>{
    Promise.all([fetch("/api/tests").then(r=>r.json()), fetch("/api/tests?action=attempts").then(r=>r.json())])
      .then(([t,a])=>{ setTests(t.tests||[]); setAttempts(a.attempts||[]); })
      .finally(()=>setLoading(false));
  },[]);
  if (loading) return <div className="space-y-4"><Skeleton className="h-24 w-full"/><Skeleton className="h-24 w-full"/></div>;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">آزمون‌ها</h1><p className="text-muted-foreground mt-1">آزمون‌های فعال و نتایج دانش‌آموزان شما</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        {tests.length===0 ? <p className="text-muted-foreground">آزمونی ثبت نشده است</p> : tests.map(t=>(
          <Card key={t.id}><CardHeader><CardTitle className="text-base">{t.title}</CardTitle><CardDescription>{t.description}</CardDescription></CardHeader>
          <CardContent className="flex gap-2"><Badge>{t._count?.questions ?? 0} سؤال</Badge><Badge variant="secondary">{t._count?.attempts ?? 0} شرکت‌کننده</Badge><Badge variant={t.isActive ? "default":"outline"}>{t.isActive ? "فعال":"غیرفعال"}</Badge></CardContent></Card>
        ))}
      </div>
      <Card><CardHeader><CardTitle>آخرین نتایج</CardTitle></CardHeader><CardContent>
        {attempts.length===0 ? <p className="text-sm text-muted-foreground">هنوز نتیجه‌ای ثبت نشده</p> :
        <div className="space-y-2">{attempts.slice(0,10).map(a=>(
          <div key={a.id} className="flex justify-between border-b py-2 text-sm"><span>{a.student?.user?.firstName} {a.student?.user?.lastName} — {a.test?.title}</span><Badge>{a.totalScore}</Badge></div>
        ))}</div>}
      </CardContent></Card>
    </div>
  );
}
