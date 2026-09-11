"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function StudentGradesPage() {
  const [grades, setGrades] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(()=>{ fetch("/api/grades").then(r=>r.json()).then(d=>setGrades(d.grades||[])).finally(()=>setLoading(false)); },[]);
  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full"/><Skeleton className="h-64 w-full"/></div>;
  const avg = grades.length ? (grades.reduce((s,g)=>s+g.score,0)/grades.length).toFixed(2) : 0;
  const chartData = grades.reduce((acc,g)=>{
    const ex = acc.find(x=>x.name===g.subjectName);
    if (ex) { ex.total+=g.score; ex.count++; ex.avg = +(ex.total/ex.count).toFixed(2); } else acc.push({name:g.subjectName, total:g.score, count:1, avg:g.score});
    return acc;
  },[]).map(x=>({name:x.name, میانگین: x.avg}));
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">نمرات من</h1><p className="text-muted-foreground mt-1">میانگین کل: {avg} از ۲۰</p></div>
      {chartData.length>0 && <Card><CardHeader><CardTitle>نمودار میانگین دروس</CardTitle></CardHeader><CardContent><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis domain={[0,20]}/><Tooltip/><Bar dataKey="میانگین" fill="var(--primary)" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></CardContent></Card>}
      <Card><CardContent className="p-0">
        {grades.length===0 ? <div className="p-12 text-center text-muted-foreground">هنوز نمری برای شما ثبت نشده</div> :
        <Table><TableHeader><TableRow><TableHead>درس</TableHead><TableHead>نمره</TableHead><TableHead>پایه</TableHead><TableHead>ترم</TableHead><TableHead>سال تحصیلی</TableHead></TableRow></TableHeader>
        <TableBody>{grades.map(g=>(
          <TableRow key={g.id}><TableCell>{g.subjectName}</TableCell><TableCell><Badge variant={g.score>=15?"default":g.score>=10?"secondary":"destructive"}>{g.score}</Badge></TableCell><TableCell>{g.gradeLevel}</TableCell><TableCell>{g.semester}</TableCell><TableCell dir="ltr">{g.academicYear}</TableCell></TableRow>
        ))}</TableBody></Table>}
      </CardContent></Card>
    </div>
  );
}
