"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentGuidancePage(){
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState("");

  const fetchResults = React.useCallback(async ()=>{
    try{
      const res = await fetch("/api/guidance");
      if (res.ok){ const d=await res.json(); setResults(d.results||[]); }
    } finally { setLoading(false); }
  },[]);
  React.useEffect(()=>{fetchResults();},[fetchResults]);

  const generate = async ()=>{
    setGenerating(true); setError("");
    try{
      const me = await fetch("/api/auth/me").then(r=>r.json());
      const sRes = await fetch("/api/students");
      const sData = await sRes.json();
      const profile = sData.students?.find(s=>s.userId===me.user.id) || sData.students?.[0];
      if (!profile) { setError("پروفایل یافت نشد"); return; }
      const res = await fetch("/api/guidance", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({studentId: profile.id})});
      const d = await res.json();
      if (!res.ok) setError(d.error||"خطا در تولید نتیجه");
      else fetchResults();
    } finally { setGenerating(false); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full"/><Skeleton className="h-32 w-full"/></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">نتیجه هدایت تحصیلی</h1><p className="text-muted-foreground mt-1">پیشنهاد اولیه برای بررسی توسط مشاور</p></div>
        <Button onClick={generate} disabled={generating}>{generating ? "در حال تولید...":"تولید نتیجه جدید"}</Button>
      </div>
      {error && <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{error}</div>}
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="pt-6 text-sm text-amber-900 dark:text-amber-100">این نتیجه صرفاً پیشنهاد اولیه است و تصمیم نهایی بر عهده مشاور و دانش‌آموز می‌باشد. Weightهای الگوریتم در lib/guidance-engine.js قابل تنظیم است.</CardContent>
      </Card>
      {results.length===0 ? <Card><CardContent className="p-12 text-center text-muted-foreground">هنوز نتیجه‌ای تولید نشده — روی «تولید نتیجه جدید» بزنید</CardContent></Card> :
      results.map(r=>{
        let parsed=null; try{ parsed = JSON.parse(r.suggestedFields); }catch{}
        const fields = parsed?.suggestedFields || [];
        return (
          <Card key={r.id}><CardHeader><CardTitle>نتیجه {new Date(r.createdAt).toLocaleDateString("fa-IR")}</CardTitle><CardDescription>{parsed?.disclaimer}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {fields.length===0 ? <p className="text-sm text-muted-foreground">داده کافی برای پیشنهاد وجود ندارد — ابتدا نمرات، علایق و توانایی‌ها را تکمیل کنید</p> :
            fields.map((f, i)=>(
              <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                <span className="font-medium">{f.field}</span>
                <div className="flex gap-2"><Badge>{f.score}</Badge><Badge variant="outline">{f.confidence}</Badge></div>
              </div>
            ))}
            {r.counselorNote && <div className="rounded-lg bg-muted p-3 text-sm"><span className="font-semibold">یادداشت مشاور: </span>{r.counselorNote}</div>}
          </CardContent></Card>
        );
      })}
    </div>
  );
}
