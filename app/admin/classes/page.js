"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Plus } from "lucide-react";

export default function AdminClassesPage(){
  const { addToast } = useToast();
  const [items, setItems] = React.useState([]);
  const [schools, setSchools] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name:"", grade:"7", schoolYear:"1403-1404", schoolId:"" });
  // `loading` already starts as true, so the initial fetch must not set it
  // again from inside the effect (that would cause a cascading render).
  const fetchData = React.useCallback(async()=>{
    try{
      const [cRes, sRes] = await Promise.all([fetch("/api/classes"), fetch("/api/schools")]);
      const c=await cRes.json(); const s=await sRes.json();
      setItems(c.classes||[]); setSchools(s.schools||[]);
      // Functional update keeps the callback independent of `form`, so the
      // hook has no missing dependency and no stale closure.
      const firstSchool = (s.schools||[])[0];
      if (firstSchool) setForm(prev => (prev.schoolId ? prev : { ...prev, schoolId: firstSchool.id }));
    } finally{ setLoading(false); }
  },[]);
  React.useEffect(()=>{fetchData();},[fetchData]);
  const submit = async (e)=>{
    e.preventDefault();
    const r=await fetch("/api/classes", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({...form, grade: Number(form.grade)})});
    if (r.ok){ addToast({title:"موفق", description:"کلاس ایجاد شد", variant:"success"}); setOpen(false); fetchData(); }
    else { const d=await r.json(); addToast({title:"خطا", description:d.error, variant:"error"}); }
  };
  if (loading) return <div className="space-y-4"><Skeleton className="h-12 w-full"/><Skeleton className="h-64 w-full"/></div>;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">کلاس‌ها</h1><p className="text-muted-foreground mt-1">مدیریت کلاس‌ها</p></div>
        <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="ml-2 h-4 w-4"/>کلاس جدید</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>ایجاد کلاس</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>نام کلاس *</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="مثلاً ۹-۱" required/></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>پایه</Label><select value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="7">هفتم</option><option value="8">هشتم</option><option value="9">نهم</option></select></div>
              <div className="space-y-2"><Label>سال تحصیلی</Label><Input value={form.schoolYear} onChange={e=>setForm({...form,schoolYear:e.target.value})} dir="ltr" required/></div>
            </div>
            <div className="space-y-2"><Label>مدرسه *</Label><select value={form.schoolId} onChange={e=>setForm({...form,schoolId:e.target.value})} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" required>
              <option value="">انتخاب کنید</option>{schools.map(s=>(<option key={s.id} value={s.id}>{s.name}</option>))}
            </select></div>
            <DialogFooter><Button type="button" variant="outline" onClick={()=>setOpen(false)}>انصراف</Button><Button type="submit">ایجاد</Button></DialogFooter>
          </form>
        </DialogContent></Dialog>
      </div>
      <Card><CardContent className="p-0">
        {items.length===0 ? <div className="p-12 text-center text-muted-foreground">کلاسی ثبت نشده</div> :
        <Table><TableHeader><TableRow><TableHead>نام</TableHead><TableHead>پایه</TableHead><TableHead>سال تحصیلی</TableHead><TableHead>مدرسه</TableHead><TableHead>دانش‌آموزان</TableHead></TableRow></TableHeader>
        <TableBody>{items.map(c=>(
          <TableRow key={c.id}><TableCell className="font-medium">{c.name}</TableCell><TableCell><Badge>{c.grade}</Badge></TableCell><TableCell dir="ltr">{c.schoolYear}</TableCell><TableCell>{c.school?.name || "—"}</TableCell><TableCell>{c._count?.students ?? 0}</TableCell></TableRow>
        ))}</TableBody></Table>}
      </CardContent></Card>
    </div>
  );
}
