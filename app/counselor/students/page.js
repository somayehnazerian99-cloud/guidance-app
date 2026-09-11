"use client";
import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Eye } from "lucide-react";

export default function CounselorStudentsPage() {
  const [students, setStudents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pagination, setPagination] = React.useState({});
  const fetchData = React.useCallback(async () => {    try{
      const params = new URLSearchParams({ page, limit: 10, search });
      const res = await fetch(`/api/students?${params}`);
      if (res.ok) { const d=await res.json(); setStudents(d.students); setPagination(d.pagination); }
    } finally { setLoading(false); }
  }, [page, search]);
  React.useEffect(()=>{fetchData();},[fetchData]);
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">دانش‌آموزان من</h1><p className="text-muted-foreground mt-1">لیست دانش‌آموزان تحت پوشش شما</p></div>
      <div className="flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground"/><Input placeholder="جستجو بر اساس کد دانش‌آموزی..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} className="max-w-sm"/></div>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-6 space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-12 w-full"/>)}</div>
        : students.length===0 ? <div className="p-12 text-center text-muted-foreground">دانش‌آموزی یافت نشد</div>
        : <Table><TableHeader><TableRow><TableHead>نام</TableHead><TableHead>کد</TableHead><TableHead>پایه</TableHead><TableHead>سال تحصیلی</TableHead><TableHead className="text-center">عملیات</TableHead></TableRow></TableHeader>
          <TableBody>{students.map(s=>(
            <TableRow key={s.id}><TableCell className="font-medium">{s.user?.firstName} {s.user?.lastName}</TableCell><TableCell dir="ltr">{s.studentCode}</TableCell><TableCell>{s.grade}</TableCell><TableCell dir="ltr">{s.schoolYear}</TableCell>
            <TableCell className="text-center"><Button asChild variant="ghost" size="icon"><Link href={`/student/guidance`}><Eye className="h-4 w-4"/></Link></Button></TableCell></TableRow>
          ))}</TableBody></Table>}
      </CardContent></Card>
      {pagination.totalPages>1 && <div className="flex justify-center gap-2"><Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(page-1)}>قبلی</Button><span className="text-sm text-muted-foreground py-2">صفحه {page} از {pagination.totalPages}</span><Button variant="outline" size="sm" disabled={page>=pagination.totalPages} onClick={()=>setPage(page+1)}>بعدی</Button></div>}
    </div>
  );
}
