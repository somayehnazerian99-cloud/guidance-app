"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/toast";
import { Plus, Trash2, Eye } from "lucide-react";

export default function AdminTestsPage(){
  const { addToast } = useToast();
  const [tests, setTests] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [detail, setDetail] = React.useState(null);
  const [form, setForm] = React.useState({ title:"", description:"" });
  const [questions, setQuestions] = React.useState([{text:"", options:[{text:"",score:5},{text:"",score:3},{text:"",score:1}]}]);

  const fetchData = React.useCallback(async()=>{
    try{ const r=await fetch("/api/tests"); const d=await r.json(); setTests(d.tests||[]); } finally{ setLoading(false); }
  },[]);
  React.useEffect(()=>{fetchData();},[fetchData]);

  const create = async (e)=>{
    e.preventDefault();
    const payload = { title: form.title, description: form.description, questions: questions.filter(q=>q.text.trim()).map((q, qi)=>({ text:q.text, order:qi, options: q.options.filter(o=>o.text.trim()).map((o, oi)=>({text:o.text, score:Number(o.score), order:oi})) })) };
    const r=await fetch("/api/tests", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)});
    if (r.ok){ addToast({title:"موفق", description:"آزمون ایجاد شد", variant:"success"}); setOpen(false); setForm({title:"",description:""}); setQuestions([{text:"", options:[{text:"",score:5},{text:"",score:3},{text:"",score:1}]}]); fetchData(); }
    else { const d=await r.json(); addToast({title:"خطا", description:d.error, variant:"error"}); }
  };

  const toggleActive = async (id, isActive)=>{
    const r=await fetch(`/api/tests/${id}`, {method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({isActive: !isActive})});
    if (r.ok) fetchData();
  };

  const remove = async (id)=>{
    const r=await fetch(`/api/tests/${id}`, {method:"DELETE"});
    if (r.ok){ addToast({title:"موفق", description:"حذف شد", variant:"success"}); fetchData(); }
  };

  const openDetail = async (id)=>{
    const r=await fetch(`/api/tests/${id}`);
    if (r.ok){ const d=await r.json(); setDetail(d.test); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-24 w-full"/><Skeleton className="h-24 w-full"/></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">آزمون‌های هدایت تحصیلی</h1><p className="text-muted-foreground mt-1">ایجاد و مدیریت آزمون‌ها</p></div>
        <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="ml-2 h-4 w-4"/>آزمون جدید</Button></DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>ایجاد آزمون</DialogTitle></DialogHeader>
          <form onSubmit={create} className="space-y-4">
            <div className="space-y-2"><Label>عنوان *</Label><Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/></div>
            <div className="space-y-2"><Label>توضیحات</Label><Input value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
            <div className="space-y-4">
              <div className="flex items-center justify-between"><Label>سؤالات</Label><Button type="button" variant="outline" size="sm" onClick={()=>setQuestions([...questions, {text:"", options:[{text:"",score:5},{text:"",score:3}]}])}>افزودن سؤال</Button></div>
              {questions.map((q, qi)=>(
                <Card key={qi}><CardContent className="pt-4 space-y-3">
                  <div className="flex gap-2"><Input placeholder={`متن سؤال ${qi+1}`} value={q.text} onChange={e=>{const n=[...questions]; n[qi].text=e.target.value; setQuestions(n);}} className="flex-1"/><Button type="button" variant="ghost" size="sm" onClick={()=>setQuestions(questions.filter((_,i)=>i!==qi))}><Trash2 className="h-4 w-4"/></Button></div>
                  {q.options.map((o, oi)=>(
                    <div key={oi} className="flex gap-2">
                      <Input placeholder={`گزینه ${oi+1}`} value={o.text} onChange={e=>{const n=[...questions]; n[qi].options[oi].text=e.target.value; setQuestions(n);}} className="flex-1"/>
                      <Input type="number" value={o.score} onChange={e=>{const n=[...questions]; n[qi].options[oi].score=e.target.value; setQuestions(n);}} className="w-20" dir="ltr" placeholder="امتیاز"/>
                      <Button type="button" variant="ghost" size="sm" onClick={()=>{const n=[...questions]; n[qi].options=n[qi].options.filter((_,j)=>j!==oi); setQuestions(n);}}>×</Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={()=>{const n=[...questions]; n[qi].options.push({text:"",score:1}); setQuestions(n);}}>افزودن گزینه</Button>
                </CardContent></Card>
              ))}
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={()=>setOpen(false)}>انصراف</Button><Button type="submit">ایجاد</Button></DialogFooter>
          </form>
        </DialogContent></Dialog>
      </div>

      {tests.length===0 ? <Card><CardContent className="p-12 text-center text-muted-foreground">آزمونی ثبت نشده</CardContent></Card> :
      <div className="grid gap-4 md:grid-cols-2">
        {tests.map(t=>(
          <Card key={t.id}><CardHeader><CardTitle className="text-base">{t.title}</CardTitle><CardDescription>{t.description}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2"><Badge>{t._count?.questions ?? 0} سؤال</Badge><Badge variant="secondary">{t._count?.attempts ?? 0} شرکت‌کننده</Badge><Badge variant={t.isActive?"default":"outline"}>{t.isActive?"فعال":"غیرفعال"}</Badge></div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={()=>openDetail(t.id)}><Eye className="ml-1 h-4 w-4"/>جزئیات</Button>
              <Button size="sm" variant="outline" onClick={()=>toggleActive(t.id, t.isActive)}>{t.isActive?"غیرفعال‌سازی":"فعال‌سازی"}</Button>
              <AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="destructive"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>حذف آزمون؟</AlertDialogTitle><AlertDialogDescription>تمام سؤالات و پاسخ‌ها حذف می‌شود</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>انصراف</AlertDialogCancel><AlertDialogAction onClick={()=>remove(t.id)} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
            </div>
          </CardContent></Card>
        ))}
      </div>}

      <Dialog open={!!detail} onOpenChange={()=>setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto"><DialogHeader><DialogTitle>{detail?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {detail?.questions?.map((q, i)=>(
              <div key={q.id} className="rounded-lg border p-3 space-y-2"><p className="font-medium text-sm">{i+1}. {q.text}</p><div className="space-y-1">{q.options?.map(o=>(<div key={o.id} className="flex justify-between text-sm bg-muted rounded px-2 py-1"><span>{o.text}</span><Badge variant="outline">{o.score}</Badge></div>))}</div></div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
