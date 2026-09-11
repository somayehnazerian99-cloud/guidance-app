"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

export default function StudentTestsPage() {
  const { addToast } = useToast();
  const [tests, setTests] = React.useState([]);
  const [attempts, setAttempts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTest, setActiveTest] = React.useState(null);
  const [answers, setAnswers] = React.useState({});
  const [submitting, setSubmitting] = React.useState(false);

  const fetchAll = React.useCallback(async ()=>{    try{
      const [tRes, aRes] = await Promise.all([fetch("/api/tests"), fetch("/api/tests?action=attempts")]);
      const t = await tRes.json(); const a = await aRes.json();
      setTests(t.tests||[]); setAttempts(a.attempts||[]);
    } finally { setLoading(false); }
  },[]);
  React.useEffect(()=>{fetchAll();},[fetchAll]);

  const completedIds = new Set(attempts.filter(a=>a.completed).map(a=>a.testId));

  const openTest = async (id) => {
    const res = await fetch(`/api/tests/${id}`);
    if (res.ok) { const d=await res.json(); setActiveTest(d.test); setAnswers({}); }
  };

  const submit = async () => {
    if (!activeTest) return;
    const payload = activeTest.questions.map(q=>({ questionId: q.id, optionId: answers[q.id] })).filter(x=>x.optionId);
    if (payload.length !== activeTest.questions.length) { addToast({title:"خطا", description:"به تمام سؤالات پاسخ دهید", variant:"error"}); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tests/submit", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ testId: activeTest.id, answers: payload })});
      const d = await res.json();
      if (res.ok) { addToast({title:"موفق", description:`آزمون ثبت شد. امتیاز: ${d.totalScore}`, variant:"success"}); setActiveTest(null); fetchAll(); }
      else addToast({title:"خطا", description:d.error, variant:"error"});
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-24 w-full"/><Skeleton className="h-24 w-full"/></div>;

  if (activeTest) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between"><h1 className="text-xl font-bold">{activeTest.title}</h1><Button variant="outline" onClick={()=>setActiveTest(null)}>بازگشت</Button></div>
        <p className="text-muted-foreground text-sm">{activeTest.description}</p>
        <div className="space-y-4">
          {activeTest.questions.map((q, idx)=>(
            <Card key={q.id}><CardHeader><CardTitle className="text-base">{idx+1}. {q.text}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {q.options.map(o=>(
                <label key={o.id} className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer ${answers[q.id]===o.id ? "border-primary bg-primary/5":""}`}>
                  <input type="radio" name={q.id} value={o.id} checked={answers[q.id]===o.id} onChange={()=>setAnswers(a=>({...a,[q.id]:o.id}))} className="accent-primary"/>
                  <span className="text-sm">{o.text}</span>
                </label>
              ))}
            </CardContent></Card>
          ))}
        </div>
        <Button onClick={submit} disabled={submitting} className="w-full">{submitting ? "در حال ارسال..." : "ثبت پاسخ‌ها"}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">آزمون‌های هدایت تحصیلی</h1><p className="text-muted-foreground mt-1">آزمون‌های فعال را انجام دهید</p></div>
      {tests.length===0 ? <p className="text-muted-foreground">آزمونی موجود نیست</p> :
      <div className="grid gap-4 md:grid-cols-2">
        {tests.map(t=>(
          <Card key={t.id}><CardHeader><CardTitle className="text-base">{t.title}</CardTitle><CardDescription>{t.description}</CardDescription></CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="flex gap-2"><Badge>{t._count?.questions ?? 0} سؤال</Badge>{completedIds.has(t.id) && <Badge variant="secondary">انجام‌شده</Badge>}</div>
            <Button size="sm" disabled={completedIds.has(t.id)} onClick={()=>openTest(t.id)}>{completedIds.has(t.id) ? "انجام شده" : "شروع آزمون"}</Button>
          </CardContent></Card>
        ))}
      </div>}
      {attempts.length>0 && <Card><CardHeader><CardTitle>سوابق من</CardTitle></CardHeader><CardContent className="space-y-2">
        {attempts.map(a=>(<div key={a.id} className="flex justify-between border-b py-2 text-sm"><span>{a.test?.title}</span><Badge>{a.totalScore}</Badge></div>))}
      </CardContent></Card>}
    </div>
  );
}
