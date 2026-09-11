"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Plus } from "lucide-react";

export default function AdminGradesPage(){
  const { addToast } = useToast();
  const [grades, setGrades] = React.useState([]);
  const [students, setStudents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ studentId:"", subjectName:"", score:"", semester:"1", academicYear:"1403-1404", gradeLevel:"9" });
  const fetchData = React.useCallback(async()=>{
    try{
      const [gRes, sRes] = await Promise.all([fetch("/api/grades"), fetch("/api/students?limit=100")]);
      const g=await gRes.json(); const s=await sRes.json();
      setGrades(g.grades||[]); setStudents(s.students||[]);
      // Functional update keeps the callback independent of `form`, so the
      // hook has no missing dependency and no stale closure.
      const firstStudent = (s.students||[])[0];
      if (firstStudent) setForm(prev => (prev.studentId ? prev : { ...prev, studentId: firstStudent.id }));
    } finally{ setLoading(false); }
  },[]);
  React.useEffect(()=>{fetchData();},[fetchData]);
  const submit = async (e)=>{
    e.preventDefault();
    const r=await fetch("/api/grades", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({...form, score: Number(form.score), semester:Number(form.semester), gradeLevel:Number(form.gradeLevel)})});
    if (r.ok){ addToast({title:"موفق", description:"نمره ثبت شد", variant:"success"}); setOpen(false); fetchData(); }
    else { const d=await r.json(); addToast({title:"خطا", description:d.error, variant:"error"}); }
  };
  if (loading) return <div className="space-y-4"><Skeleton className="h-12 w-full"/><Skeleton className="h-64 w-full"/></div>;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">نمرات</h1><p className="text-muted-foreground mt-1">ثبت و مشاهده نمرات</p></div>
        <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="ml-2 h-4 w-4"/>ثبت نمره</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>ثبت نمره</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>دانش‌آموز *</Label><select value={form.studentId} onChange={e=>setForm({...form, studentId:e.target.value})} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" required>
              <option value="">انتخاب کنید</option>{students.map(s=>(<option key={s.id} value={s.id}>{s.user?.firstName} {s.user?.lastName} ({s.studentCode})</option>))}
            </select></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>درس *</Label><Input value={form.subjectName} onChange={e=>setForm({...form, subjectName:e.target.value})} required /></div><div className="space-y-2"><Label>نمره (۰-۲۰) *</Label><Input type="number" min={0} max={20} step={0.25} value={form.score} onChange={e=>setForm({...form, score:e.target.value})} required dir="ltr"/></div></div>
            <div className="grid grid-cols-3 gap-4"><div className="space-y-2"><Label>ترم</Label><select value={form.semester} onChange={e=>setForm({...form,semester:e.target.value})} className="w-full h-10 rounded-md border px-3 text-sm"><option value="1">۱</option><option value="2">۲</option></select></div><div className="space-y-2"><Label>پایه</Label><select value={form.gradeLevel} onChange={e=>setForm({...form,gradeLevel:e.target.value})} className="w-full h-10 rounded-md border px-3 text-sm"><option value="7">۷</option><option value="8">۸</option><option value="9">۹</option></select></div><div className="space-y-2"><Label>سال تحصیلی</Label><Input value={form.academicYear} onChange={e=>setForm({...form,academicYear:e.target.value})} dir="ltr" required/></div></div>
            <DialogFooter><Button type="button" variant="outline" onClick={()=>setOpen(false)}>انصراف</Button><Button type="submit">ثبت</Button></DialogFooter>
          </form>
        </DialogContent></Dialog>
      </div>
      <Card><CardContent className="p-0">
        {grades.length===0 ? <div className="p-12 text-center text-muted-foreground">نمری ثبت نشده</div> :
        <Table><TableHeader><TableRow><TableHead>دانش‌آموز</TableHead><TableHead>درس</TableHead><TableHead>نمره</TableHead><TableHead>پایه</TableHead><TableHead>ترم</TableHead><TableHead>سال</TableHead></TableRow></TableHeader>
        <TableBody>{grades.map(g=>(
          <TableRow key={g.id}><TableCell>{g.student?.user?.firstName} {g.student?.user?.lastName}</TableCell><TableCell>{g.subjectName}</TableCell><TableCell><Badge variant={g.score>=15?"default":g.score>=10?"secondary":"destructive"}>{g.score}</Badge></TableCell><TableCell>{g.gradeLevel}</TableCell><TableCell>{g.semester}</TableCell><TableCell dir="ltr">{g.academicYear}</TableCell></TableRow>
        ))}</TableBody></Table>}
      </CardContent></Card>
    </div>
  );
}
