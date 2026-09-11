"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

const CATEGORIES = [
  { value:"MATHEMATICAL", label:"توانایی ریاضی" },
  { value:"VERBAL", label:"توانایی کلامی" },
  { value:"LOGICAL", label:"توانایی منطقی" },
  { value:"SPATIAL", label:"توانایی فضایی" },
  { value:"TECHNICAL", label:"توانایی فنی" },
  { value:"ARTISTIC", label:"توانایی هنری" },
  { value:"COMMUNICATION", label:"توانایی ارتباطی" },
  { value:"PROBLEM_SOLVING", label:"حل مسئله" },
  { value:"CREATIVITY", label:"خلاقیت" },
  { value:"TEAMWORK", label:"کار گروهی" },
];

export default function StudentAbilitiesPage(){
  const { addToast } = useToast();
  const [studentId, setStudentId] = React.useState(null);
  const [scores, setScores] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(()=>{
    async function init(){
      try {
        const me = await fetch("/api/auth/me").then(r=>r.json());
        const sRes = await fetch("/api/students");
        const sData = await sRes.json();
        const profile = sData.students?.find(s=>s.userId===me.user.id) || sData.students?.[0];
        if (profile) {
          setStudentId(profile.id);
          const aRes = await fetch(`/api/abilities?studentId=${profile.id}`);
          const aData = await aRes.json();
          const map={};
          (aData.abilities||[]).forEach(a=>{ map[a.category]=a.score; });
          setScores(map);
        }
      } finally { setLoading(false); }
    }
    init();
  },[]);

  const save = async ()=>{
    if (!studentId) return;
    setSaving(true);
    try{
      const abilities = Object.entries(scores).filter(([,v])=>v!==undefined && v!=="").map(([category, score])=>{
        const s = Number(score);
        const level = s>=80 ? "EXCELLENT" : s>=60 ? "HIGH" : s>=40 ? "MEDIUM" : "LOW";
        return { category, score:s, level };
      });
      const res = await fetch("/api/abilities", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({studentId, abilities})});
      if (res.ok) addToast({title:"موفق", description:"توانایی‌ها ذخیره شد", variant:"success"});
      else { const d=await res.json(); addToast({title:"خطا", description:d.error, variant:"error"}); }
    } finally { setSaving(false); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full"/><Skeleton className="h-32 w-full"/></div>;
  if (!studentId) return <div className="p-8 text-center text-muted-foreground">پروفایل یافت نشد</div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">توانایی‌های من</h1><p className="text-muted-foreground mt-1">برای هر توانایی امتیاز ۰ تا ۱۰۰ وارد کنید</p></div>
      <div className="grid gap-3 md:grid-cols-2">
        {CATEGORIES.map(c=>(
          <Card key={c.value}><CardContent className="p-4 flex items-center justify-between gap-3">
            <span className="font-medium text-sm">{c.label}</span>
            <input type="number" min={0} max={100} value={scores[c.value] ?? ""} onChange={e=>setScores(s=>({...s,[c.value]: e.target.value}))}
              placeholder="۰-۱۰۰" className="w-20 h-9 rounded-md border border-input px-2 text-sm text-center" dir="ltr"/>
          </CardContent></Card>
        ))}
      </div>
      <Button onClick={save} disabled={saving}>{saving ? "در حال ذخیره...":"ذخیره توانایی‌ها"}</Button>
    </div>
  );
}
