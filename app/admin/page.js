"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, GraduationCap, User, School, ClipboardList, CheckCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function AdminDashboard() {
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/reports?type=dashboard");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch {
        // Handle error
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { title: "کل کاربران", value: stats?.totalUsers || 0, icon: Users, color: "text-blue-600" },
    { title: "دانش‌آموزان", value: stats?.totalStudents || 0, icon: GraduationCap, color: "text-green-600" },
    { title: "مشاوران", value: stats?.totalCounselors || 0, icon: User, color: "text-purple-600" },
    { title: "مدارس", value: stats?.totalSchools || 0, icon: School, color: "text-amber-600" },
    { title: "آزمون‌های انجام‌شده", value: stats?.totalTests || 0, icon: ClipboardList, color: "text-indigo-600" },
    { title: "پرونده‌های کامل", value: stats?.completedProfiles || 0, icon: CheckCircle, color: "text-emerald-600" },
  ];

  const chartData = [
    { name: "کاربران", تعداد: stats?.totalUsers || 0 },
    { name: "دانش‌آموزان", تعداد: stats?.totalStudents || 0 },
    { name: "مشاوران", تعداد: stats?.totalCounselors || 0 },
    { name: "مدارس", تعداد: stats?.totalSchools || 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">داشبورد مدیریت</h1>
        <p className="text-muted-foreground mt-1">خلاصه‌ای از وضعیت سیستم</p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>نمودار آماری</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="تعداد" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      {stats?.recentActivity?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>فعالیت‌های اخیر</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="text-sm">
                      {activity.user?.firstName} {activity.user?.lastName} - {activity.action}
                    </p>
                    {activity.details && (
                      <p className="text-xs text-muted-foreground">{activity.details}</p>
                    )}
                  </div>
                  <Badge variant="secondary">
                    {new Date(activity.createdAt).toLocaleDateString("fa-IR")}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
