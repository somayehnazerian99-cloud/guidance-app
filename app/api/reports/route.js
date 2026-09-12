import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "dashboard";

    if (type === "dashboard") {
      const stats = await getDashboardStats(auth.user);
      return NextResponse.json(stats);
    }

    if (type === "grade-summary") {
      const gradeStats = await getGradeSummary(auth.user);
      return NextResponse.json(gradeStats);
    }

    return NextResponse.json({ error: "نوع گزارش نامعتبر" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}

async function getDashboardStats(user) {
  if (user.role === "ADMIN") {
    const [
      totalUsers,
      totalStudents,
      totalCounselors,
      totalSchools,
      totalTests,
      completedProfiles,
      pendingCounselors,
      openTickets,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.studentProfile.count(),
      prisma.user.count({ where: { role: "COUNSELOR" } }),
      prisma.school.count(),
      prisma.testAttempt.count({ where: { completed: true } }),
      prisma.studentProfile.count({ where: { profileComplete: true } }),
      // Work waiting on the administrator, surfaced on the dashboard so it is
      // not missed behind its own menu entry.
      prisma.user.count({ where: { role: "COUNSELOR", approvalStatus: "PENDING" } }),
      prisma.supportTicket.count({ where: { NOT: { status: "CLOSED" } } }),
    ]);

    const recentActivity = await prisma.auditLog.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { firstName: true, lastName: true, role: true } },
      },
    });

    return {
      totalUsers,
      totalStudents,
      totalCounselors,
      totalSchools,
      totalTests,
      completedProfiles,
      pendingCounselors,
      openTickets,
      recentActivity,
    };
  }

  if (user.role === "COUNSELOR") {
    const [myStudents, completedTests, guidanceResults] = await Promise.all([
      prisma.studentProfile.count({ where: { counselorId: user.id } }),
      prisma.testAttempt.count({
        where: { completed: true, student: { counselorId: user.id } },
      }),
      prisma.guidanceResult.count({
        where: { student: { counselorId: user.id } },
      }),
    ]);

    return { myStudents, completedTests, guidanceResults };
  }

  // Student
  const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return {};

  const [grades, attempts, interests, abilities] = await Promise.all([
    prisma.grade.findMany({ where: { studentId: profile.id } }),
    prisma.testAttempt.findMany({ where: { studentId: profile.id, completed: true } }),
    prisma.interest.findMany({ where: { studentId: profile.id } }),
    prisma.ability.findMany({ where: { studentId: profile.id } }),
  ]);

  const avgGrade =
    grades.length > 0 ? grades.reduce((s, g) => s + g.score, 0) / grades.length : 0;

  return {
    profileComplete: profile.profileComplete,
    avgGrade: Math.round(avgGrade * 100) / 100,
    totalTests: attempts.length,
    interestsCount: interests.length,
    abilitiesCount: abilities.length,
    hasGuidance: false,
  };
}

async function getGradeSummary(user) {
  const where = {};
  if (user.role === "COUNSELOR") {
    where.student = { counselorId: user.id };
  } else if (user.role === "STUDENT") {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
    if (profile) where.studentId = profile.id;
  }

  const grades = await prisma.grade.findMany({
    where,
    select: {
      subjectName: true,
      score: true,
      gradeLevel: true,
      academicYear: true,
    },
  });

  // Group by subject
  const bySubject = {};
  grades.forEach((g) => {
    if (!bySubject[g.subjectName]) bySubject[g.subjectName] = [];
    bySubject[g.subjectName].push(g.score);
  });

  const summary = Object.entries(bySubject).map(([subject, scores]) => ({
    subject,
    average: Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100,
    count: scores.length,
  }));

  return { summary, totalGrades: grades.length };
}
