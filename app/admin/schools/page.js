"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Plus } from "lucide-react";

export default function AdminSchoolsPage(){
  const { addToast } = useToast();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name:"", city:"", province:"" });
  const fetchData = React.useCallback(async()=>{ try{ const r=await fetch("/api/schools"); const d=await r.json(); setItems(d.schools||[]);} finally{ setLoading(false);} },[]);
  React.useEffect(()=>{fetchData();},[fetchData]);
  const submit = async (e)=>{
    e.preventDefault();
    const r=await fetch("/api/schools", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(form)});
    if (r.ok){ addToast({title:"موفق", description:"مدرسه ایجاد شد", variant:"success"}); setOpen(false); setForm({name:"",city:"",province:""}); fetchData(); }
    else { const d=await r.json(); addToast({title:"خطا", description:d.error, variant:"error"}); }
  };
  if (loading) return <div className="space-y-4"><Skeleton className="h-12 w-full"/><Skeleton className="h-64 w-full"/></div>;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">مدارس</h1><p className="text-muted-foreground mt-1">مدیریت مدارس</p></div>
        <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="ml-2 h-4 w-4"/>مدرسه جدید</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>ایجاد مدرسه</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>نام مدرسه *</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>شهر</Label><Input value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></div><div className="space-y-2"><Label>استان</Label><Input value={form.province} onChange={e=>setForm({...form,province:e.target.value})}/></div></div>
            <DialogFooter><Button type="button" variant="outline" onClick={()=>setOpen(false)}>انصراف</Button><Button type="submit">ایجاد</Button></DialogFooter>
          </form>
        </DialogContent></Dialog>
      </div>
      <Card><CardContent className="p-0">
        {items.length===0 ? <div className="p-12 text-center text-muted-foreground">مدرسه‌ای ثبت نشده</div> :
        <Table><TableHeader><TableRow><TableHead>نام</TableHead><TableHead>شهر</TableHead><TableHead>استان</TableHead><TableHead>کلاس‌ها</TableHead><TableHead>دانش‌آموزان</TableHead></TableRow></TableHeader>
        <TableBody>{items.map(s=>(
          <TableRow key={s.id}><TableCell className="font-medium">{s.name}</TableCell><TableCell>{s.city||"—"}</TableCell><TableCell>{s.province||"—"}</TableCell><TableCell>{s._count?.classes ?? 0}</TableCell><TableCell>{s._count?.students ?? 0}</TableCell></TableRow>
        ))}</TableBody></Table>}
      </CardContent></Card>
    </div>
  );
}
