"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

export default function ParentOpinionPage(){
  const { addToast } = useToast();
  const [studentId, setStudentId] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ parentName:"", interests:"", abilities:"", fieldInterest:"", behavioral:"", activities:"", generalNotes:"" });
  const [history, setHistory] = React.useState([]);

  React.useEffect(()=>{
    async function init(){
      try{
        const me = await fetch("/api/auth/me").then(r=>r.json());
        const sRes = await fetch("/api/students");
        const sData = await sRes.json();
        const profile = sData.students?.find(s=>s.userId===me.user.id) || sData.students?.[0];
        if (profile) {
          setStudentId(profile.id);
          const oRes = await fetch(`/api/parent-opinions?studentId=${profile.id}`);
          const oData = await oRes.json();
          setHistory(oData.opinions||[]);
          if (oData.opinions?.[0]) setForm(oData.opinions[0]);
        }
      } finally { setLoading(false); }
    }
    init();
  },[]);

  const save = async (e)=>{
    e.preventDefault();
    if (!studentId) return;
    setSaving(true);
    try{
      const res = await fetch("/api/parent-opinions", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({studentId, ...form})});
      if (res.ok) { addToast({title:"موفق", description:"نظر والدین ثبت شد", variant:"success"}); const d=await fetch(`/api/parent-opinions?studentId=${studentId}`).then(r=>r.json()); setHistory(d.opinions||[]); }
      else { const d=await res.json(); addToast({title:"خطا", description:d.error, variant:"error"}); }
    } finally { setSaving(false); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full"/><Skeleton className="h-64 w-full"/></div>;
  if (!studentId) return <div className="p-8 text-center text-muted-foreground">پروفایل یافت نشد</div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">نظر والدین</h1><p className="text-muted-foreground mt-1">والدین می‌توانند دیدگاه خود را درباره فرزند ثبت کنند</p></div>
      <Card><CardHeader><CardTitle>ثبت نظر جدید</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2"><Label>نام والد</Label><Input value={form.parentName||""} onChange={e=>setForm({...form, parentName:e.target.value})}/></div>
          <div className="space-y-2"><Label>علایق فرزند از دید والد</Label><Input value={form.interests||""} onChange={e=>setForm({...form, interests:e.target.value})}/></div>
          <div className="space-y-2"><Label>توانایی‌ها از دید والد</Label><Input value={form.abilities||""} onChange={e=>setForm({...form, abilities:e.target.value})}/></div>
          <div className="space-y-2"><Label>علاقه به رشته</Label><Input value={form.fieldInterest||""} onChange={e=>setForm({...form, fieldInterest:e.target.value})}/></div>
          <div className="space-y-2"><Label>ویژگی‌های رفتاری</Label><Input value={form.behavioral||""} onChange={e=>setForm({...form, behavioral:e.target.value})}/></div>
          <div className="space-y-2"><Label>فعالیت‌های مورد علاقه</Label><Input value={form.activities||""} onChange={e=>setForm({...form, activities:e.target.value})}/></div>
          <div className="space-y-2"><Label>نظر کلی</Label><textarea value={form.generalNotes||""} onChange={e=>setForm({...form, generalNotes:e.target.value})} className="w-full min-h-24 rounded-md border border-input p-3 text-sm" /></div>
          <Button type="submit" disabled={saving}>{saving ? "در حال ذخیره...":"ثبت نظر"}</Button>
        </form>
      </CardContent></Card>
      {history.length>0 && <Card><CardHeader><CardTitle>سوابق</CardTitle></CardHeader><CardContent className="space-y-3">
        {history.map(h=>(
          <div key={h.id} className="rounded-lg border p-3 text-sm space-y-1">
            <div className="font-medium">{h.parentName || "—"} — {new Date(h.createdAt).toLocaleDateString("fa-IR")}</div>
            {h.generalNotes && <p className="text-muted-foreground">{h.generalNotes}</p>}
          </div>
        ))}
      </CardContent></Card>}
    </div>
  );
}
