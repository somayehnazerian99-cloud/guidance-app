import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hashPassword(p) {
  return bcrypt.hash(p, 12);
}

async function main() {
  console.log("🌱 Seeding database...");

  // Clean in development only
  console.log("Cleaning existing data...");
  await prisma.testAnswer.deleteMany({});
  await prisma.testAttempt.deleteMany({});
  await prisma.option.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.guidanceTest.deleteMany({});
  await prisma.guidanceResult.deleteMany({});
  await prisma.parentOpinion.deleteMany({});
  await prisma.ability.deleteMany({});
  await prisma.interest.deleteMany({});
  await prisma.grade.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.studentProfile.deleteMany({});
  await prisma.counselorProfile.deleteMany({});
  await prisma.class.deleteMany({});
  await prisma.school.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  // Keep users last due to relations, then recreate
  await prisma.user.deleteMany({});

  console.log("Creating users...");

  const adminPassword = await hashPassword("Admin@12345");
  const counselorPassword = await hashPassword("Counselor@12345");
  const studentPassword = await hashPassword("Student@12345");

  const admin = await prisma.user.create({
    data: {
      username: "admin",
      password: adminPassword,
      firstName: "مدیر",
      lastName: "سیستم",
      email: "admin@example.local",
      role: "ADMIN",
    },
  });

  const counselor = await prisma.user.create({
    data: {
      username: "counselor",
      password: counselorPassword,
      firstName: "علی",
      lastName: "مشاور",
      email: "counselor@example.local",
      role: "COUNSELOR",
    },
  });
  await prisma.counselorProfile.create({
    data: { userId: counselor.id, expertise: "هدایت تحصیلی", phone: "09120000001" },
  });

  const school = await prisma.school.create({
    data: { name: "مدرسه نمونه دولتی شهید بهشتی", city: "تهران", province: "تهران" },
  });

  const cls7 = await prisma.class.create({
    data: { name: "۷-۱", grade: 7, schoolYear: "1403-1404", schoolId: school.id, counselorId: counselor.id },
  });
  const cls8 = await prisma.class.create({
    data: { name: "۸-۱", grade: 8, schoolYear: "1403-1404", schoolId: school.id, counselorId: counselor.id },
  });
  const cls9 = await prisma.class.create({
    data: { name: "۹-۱", grade: 9, schoolYear: "1403-1404", schoolId: school.id, counselorId: counselor.id },
  });

  const studentsData = [
    { firstName: "محمد", lastName: "احمدی", code: "1001", grade: 7, classId: cls7.id },
    { firstName: "زهرا", lastName: "حسینی", code: "1002", grade: 8, classId: cls8.id },
    { firstName: "علی", lastName: "رضایی", code: "1003", grade: 9, classId: cls9.id },
    { firstName: "فاطمه", lastName: "کریمی", code: "1004", grade: 9, classId: cls9.id },
  ];

  const createdStudents = [];
  for (const s of studentsData) {
    const user = await prisma.user.create({
      data: {
        username: `student_${s.code}`,
        password: studentPassword,
        firstName: s.firstName,
        lastName: s.lastName,
        role: "STUDENT",
      },
    });
    const profile = await prisma.studentProfile.create({
      data: {
        userId: user.id,
        studentCode: s.code,
        schoolId: school.id,
        classId: s.classId,
        counselorId: counselor.id,
        grade: s.grade,
        schoolYear: "1403-1404",
        phone: "09120000000",
        parentPhone: "09120000002",
      },
    });
    createdStudents.push({ profile, user, data: s });
  }

  console.log("Creating grades...");
  const subjects = ["ریاضی", "علوم", "فارسی", "عربی", "انگلیسی", "مطالعات اجتماعی", "هنر"];
  for (const { profile } of createdStudents) {
    for (const subject of subjects) {
      for (const semester of [1, 2]) {
        const score = Math.round((12 + Math.random() * 7) * 100) / 100;
        await prisma.grade.create({
          data: {
            studentId: profile.id,
            subjectName: subject,
            score,
            maxScore: 20,
            semester,
            academicYear: "1403-1404",
            gradeLevel: profile.grade,
          },
        });
      }
    }
  }

  console.log("Creating interests & abilities...");
  const interestCats = ["MATH", "SCIENCE", "ART", "TECHNOLOGY", "SPORTS"];
  const abilityCats = ["MATHEMATICAL", "VERBAL", "LOGICAL", "CREATIVITY", "TEAMWORK"];
  for (const { profile } of createdStudents) {
    for (const cat of interestCats.slice(0, 3)) {
      await prisma.interest.create({
        data: { studentId: profile.id, category: cat, level: Math.ceil(Math.random() * 5) },
      });
    }
    for (const cat of abilityCats.slice(0, 3)) {
      const score = Math.round(Math.random() * 100);
      const level = score >= 80 ? "EXCELLENT" : score >= 60 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
      await prisma.ability.create({
        data: { studentId: profile.id, category: cat, score, level },
      });
    }
  }

  console.log("Creating guidance tests...");
  const test = await prisma.guidanceTest.create({
    data: {
      title: "آزمون رغبت شغلی هالند",
      description: "این آزمون به شناسایی علایق شغلی شما کمک می‌کند",
      createdBy: admin.id,
    },
  });

  const questionsData = [
    { text: "دوست دارم مسائل ریاضی را حل کنم", options: ["کاملاً موافقم", "موافقم", "نظری ندارم", "مخالفم", "کاملاً مخالفم"] },
    { text: "از کارهای هنری و طراحی لذت می‌برم", options: ["کاملاً موافقم", "موافقم", "نظری ندارم", "مخالفم", "کاملاً مخالفم"] },
    { text: "دوست دارم با دیگران کار گروهی انجام دهم", options: ["کاملاً موافقم", "موافقم", "نظری ندارم", "مخالفم", "کاملاً مخالفم"] },
    { text: "به آزمایش‌های علمی علاقه دارم", options: ["کاملاً موافقم", "موافقم", "نظری ندارم", "مخالفم", "کاملاً مخالفم"] },
    { text: "دوست دارم چیزهای جدید بسازم", options: ["کاملاً موافقم", "موافقم", "نظری ندارم", "مخالفم", "کاملاً مخالفم"] },
  ];

  for (let qi = 0; qi < questionsData.length; qi++) {
    const q = questionsData[qi];
    const question = await prisma.question.create({
      data: { testId: test.id, text: q.text, order: qi },
    });
    for (let oi = 0; oi < q.options.length; oi++) {
      await prisma.option.create({
        data: { questionId: question.id, text: q.options[oi], score: 5 - oi, order: oi },
      });
    }
  }

  console.log("Creating videos...");
  await prisma.educationalVideo.create({
    data: {
      title: "معرفی رشته ریاضی و فیزیک",
      description: "آشنایی با رشته ریاضی و فیزیک و آینده شغلی آن",
      videoUrl: "https://www.aparat.com/v/example1",
      category: "معرفی رشته",
      createdBy: admin.id,
    },
  });
  await prisma.educationalVideo.create({
    data: {
      title: "معرفی رشته علوم تجربی",
      description: "آشنایی با رشته علوم تجربی",
      videoUrl: "https://www.aparat.com/v/example2",
      category: "معرفی رشته",
      createdBy: admin.id,
    },
  });
  await prisma.educationalVideo.create({
    data: {
      title: "چگونه رشته مناسب خود را انتخاب کنیم؟",
      description: "راهنمای انتخاب رشته برای دانش‌آموزان متوسطه اول",
      videoUrl: "https://www.aparat.com/v/example3",
      category: "راهنما",
      createdBy: admin.id,
    },
  });

  console.log("Creating parent opinion sample...");
  await prisma.parentOpinion.create({
    data: {
      studentId: createdStudents[0].profile.id,
      parentName: "پدر محمد احمدی",
      interests: "به ریاضی و کامپیوتر علاقه دارد",
      abilities: "در حل مسائل ریاضی توانمند است",
      fieldInterest: "ریاضی و فیزیک",
      generalNotes: "امیدواریم در رشته مهندسی موفق شود",
    },
  });

  console.log("Creating notifications...");
  for (const { profile } of createdStudents.slice(0, 2)) {
    await prisma.notification.create({
      data: { studentId: profile.id, title: "خوش آمدید", message: "به سیستم هدایت تحصیلی خوش آمدید", type: "INFO" },
    });
  }

  console.log("✅ Seed completed!");
  console.log("\n📋 Development Credentials (DO NOT USE IN PRODUCTION):");
  console.log("  Admin:     admin / Admin@12345");
  console.log("  Counselor: counselor / Counselor@12345");
  console.log("  Students:  student_1001..1004 / Student@12345");
  console.log("  Students created from the admin panel get a random strong password.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
