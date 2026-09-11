"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

const CATEGORIES = [
  { value:"MATH", label:"ریاضی" },{ value:"SCIENCE", label:"علوم" },{ value:"TECHNOLOGY", label:"فناوری" },
  { value:"ART", label:"هنر" },{ value:"LANGUAGE", label:"زبان" },{ value:"LITERATURE", label:"ادبیات" },
  { value:"COMPUTER", label:"کار با کامپیوتر" },{ value:"TECHNICAL", label:"کارهای فنی" },
  { value:"SOCIAL", label:"فعالیت‌های اجتماعی" },{ value:"ENTREPRENEURSHIP", label:"کارآفرینی" },
  { value:"SPORTS", label:"ورزش" },
];
const LABEL_MAP = Object.fromEntries(CATEGORIES.map(c=>[c.value,c.label]));

export default function StudentInterestsPage() {
  const { addToast } = useToast();
  const [studentId, setStudentId] = React.useState(null);
  const [selected, setSelected] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(()=>{
    async function init(){
      try {
        const me = await fetch("/api/auth/me").then(r=>r.json());
        // get student profile id
        const sRes = await fetch("/api/students");
        const sData = await sRes.json();
        const profile = sData.students?.find(s=>s.userId===me.user.id) || sData.students?.[0];
        if (profile) {
          setStudentId(profile.id);
          const iRes = await fetch(`/api/interests?studentId=${profile.id}`);
          const iData = await iRes.json();
          const map={};
          (iData.interests||[]).forEach(i=>{ map[i.category]=i.level; });
          setSelected(map);
        }
      } finally { setLoading(false); }
    }
    init();
  },[]);

  const toggle = (cat) => {
    setSelected(prev=>{
      const n={...prev};
      if (n[cat]) delete n[cat]; else n[cat]=3;
      return n;
    });
  };

  const save = async ()=>{
    if (!studentId) return;
    setSaving(true);
    try {
      const interests = Object.entries(selected).map(([category, level])=>({category, level}));
      const res = await fetch("/api/interests", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ studentId, interests })});
      if (res.ok) addToast({title:"موفق", description:"علایق ذخیره شد", variant:"success"});
      else { const d=await res.json(); addToast({title:"خطا", description:d.error, variant:"error"}); }
    } finally { setSaving(false); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full"/><Skeleton className="h-32 w-full"/></div>;
  if (!studentId) return <div className="p-8 text-center text-muted-foreground">پروفایل دانش‌آموزی یافت نشد</div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">علایق من</h1><p className="text-muted-foreground mt-1">علایق خود را انتخاب کنید و سطح علاقه را مشخص کنید</p></div>
      <div className="grid gap-3 md:grid-cols-2">
        {CATEGORIES.map(c=>{
          const active = selected[c.value] !== undefined;
          return (
            <Card key={c.value} className={active ? "border-primary" : ""}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input type="checkbox" checked={active} onChange={()=>toggle(c.value)} className="accent-primary h-4 w-4"/>
                  <span className="font-medium">{c.label}</span>
                </label>
                {active && (
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(n=>(
                      <button key={n} onClick={()=>setSelected(s=>({...s,[c.value]:n}))}
                        className={`h-7 w-7 rounded text-xs font-bold border ${selected[c.value]>=n ? "bg-primary text-primary-foreground border-primary":"bg-muted"}`}>{n}</button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Button onClick={save} disabled={saving} className="w-full md:w-auto">{saving ? "در حال ذخیره...":"ذخیره علایق"}</Button>
    </div>
  );
}
