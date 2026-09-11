"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function CounselorGradesPage() {
  const [grades, setGrades] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(()=>{ fetch("/api/grades").then(r=>r.json()).then(d=>setGrades(d.grades||[])).finally(()=>setLoading(false)); },[]);
  if (loading) return <div className="space-y-4"><Skeleton className="h-12 w-full"/><Skeleton className="h-64 w-full"/></div>;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">نمرات دانش‌آموزان</h1><p className="text-muted-foreground mt-1">نمرات دانش‌آموزان تحت پوشش شما</p></div>
      <Card><CardContent className="p-0">
        {grades.length===0 ? <div className="p-12 text-center text-muted-foreground">نمری ثبت نشده</div> :
        <Table><TableHeader><TableRow><TableHead>دانش‌آموز</TableHead><TableHead>درس</TableHead><TableHead>نمره</TableHead><TableHead>پایه</TableHead><TableHead>ترم</TableHead><TableHead>سال تحصیلی</TableHead></TableRow></TableHeader>
        <TableBody>{grades.map(g=>(
          <TableRow key={g.id}><TableCell>{g.student?.user?.firstName} {g.student?.user?.lastName}</TableCell><TableCell>{g.subjectName}</TableCell><TableCell><Badge variant={g.score>=15?"default":g.score>=10?"secondary":"destructive"}>{g.score}</Badge></TableCell><TableCell>{g.gradeLevel}</TableCell><TableCell>{g.semester}</TableCell><TableCell dir="ltr">{g.academicYear}</TableCell></TableRow>
        ))}</TableBody></Table>}
      </CardContent></Card>
    </div>
  );
}
