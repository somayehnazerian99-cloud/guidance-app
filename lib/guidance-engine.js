import prisma from "./prisma.js";

// Configurable weights - can be adjusted for different guidance strategies
const WEIGHTS = {
  grades: 0.35,
  interests: 0.2,
  abilities: 0.2,
  testResults: 0.15,
  parentOpinion: 0.1,
};

const FIELD_MAPPING = {
  MATH: { label: "ریاضی", relatedFields: ["ریاضی و فیزیک", "حسابداری", "اقتصاد"] },
  SCIENCE: { label: "علوم", relatedFields: ["علوم تجربی", "پزشکی", "داروسازی"] },
  TECHNOLOGY: { label: "فناوری", relatedFields: ["علوم کامپیوتر", "مهندسی کامپیوتر", "فناوری اطلاعات"] },
  ART: { label: "هنر", relatedFields: ["هنرهای زیبا", "گرافیک", "معماری"] },
  LANGUAGE: { label: "زبان", relatedFields: ["زبان و ادبیات فارسی", "مترجمی زبان", "ادبیات"] },
  LITERATURE: { label: "ادبیات", relatedFields: ["زبان و ادبیات فارسی", "فلسفه", "علوم انسانی"] },
  COMPUTER: { label: "کار با کامپیوتر", relatedFields: ["علوم کامپیوتر", "IT", "شبکه"] },
  TECHNICAL: { label: "کارهای فنی", relatedFields: ["مهندسی مکانیک", "برق", "فنی و حرفه‌ای"] },
  SOCIAL: { label: "فعالیت‌های اجتماعی", relatedFields: ["علوم اجتماعی", "روانشناسی", "جامعه‌شناسی"] },
  ENTREPRENEURSHIP: { label: "کارآفرینی", relatedFields: ["مدیریت بازرگانی", "اقتصاد", "حسابداری"] },
  SPORTS: { label: "ورزش", relatedFields: ["تربیت بدنی", "علوم ورزشی", "مربیگری"] },
};

const ABILITY_RECOMMENDATIONS = {
  MATHEMATICAL: "توانایی ریاضی بالا - رشته‌های ریاضی و مهندسی توصیه می‌شود",
  VERBAL: "توانایی کلامی بالا - رشته‌های ادبیات و زبان توصیه می‌شود",
  LOGICAL: "توانایی منطقی بالا - رشته‌های علوم و مهندسی توصیه می‌شود",
  SPATIAL: "توانایی فضایی بالا - رشته‌های معماری و هنر توصیه می‌شود",
  TECHNICAL: "توانایی فنی بالا - رشته‌های فنی و حرفه‌ای توصیه می‌شود",
  ARTISTIC: "توانایی هنری بالا - رشته‌های هنری توصیه می‌شود",
  COMMUNICATION: "توانایی ارتباطی بالا - رشته‌های اجتماعی و رسانه توصیه می‌شود",
  PROBLEM_SOLVING: "توانایی حل مسئله بالا - رشته‌های علوم و مهندسی توصیه می‌شود",
  CREATIVITY: "توانایی خلاقیت بالا - رشته‌های هنری و طراحی توصیه می‌شود",
  TEAMWORK: "توانایی کار گروهی بالا - رشته‌های مدیریت و علوم اجتماعی توصیه می‌شود",
};

export async function calculateGuidanceResult(studentId) {
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: {
      grades: true,
      interests: true,
      abilities: true,
      testAttempts: {
        where: { completed: true },
        include: { answers: true },
      },
      parentOpinions: true,
    },
  });

  if (!student) throw new Error("دانش‌آموز یافت نشد");

  const analysis = {};

  // 1. Analyze grades
  analysis.grades = analyzeGrades(student.grades);

  // 2. Analyze interests
  analysis.interests = analyzeInterests(student.interests);

  // 3. Analyze abilities
  analysis.abilities = analyzeAbilities(student.abilities);

  // 4. Analyze test results
  analysis.testResults = analyzeTestResults(student.testAttempts);

  // 5. Analyze parent opinions
  analysis.parentOpinions = analyzeParentOpinions(student.parentOpinions);

  // Calculate final suggestions
  const suggestions = calculateSuggestions(analysis);

  const result = {
    studentId,
    suggestedFields: JSON.stringify(suggestions),
    analysis: JSON.stringify(analysis),
    weightConfig: WEIGHTS,
  };

  return result;
}

function analyzeGrades(grades) {
  if (!grades.length) return { average: 0, strengths: [], weaknesses: [], trend: "stable" };

  const subjectAverages = {};
  grades.forEach((g) => {
    if (!subjectAverages[g.subjectName]) {
      subjectAverages[g.subjectName] = { total: 0, count: 0 };
    }
    subjectAverages[g.subjectName].total += g.score;
    subjectAverages[g.subjectName].count++;
  });

  const averages = Object.entries(subjectAverages).map(([subject, data]) => ({
    subject,
    average: data.total / data.count,
  }));

  const overallAverage = averages.reduce((sum, a) => sum + a.average, 0) / averages.length;
  const strengths = averages.filter((a) => a.average >= 15).map((a) => a.subject);
  const weaknesses = averages.filter((a) => a.average < 12).map((a) => a.subject);

  return { average: overallAverage, strengths, weaknesses, subjectAverages: averages };
}

function analyzeInterests(interests) {
  if (!interests.length) return { topInterests: [], categories: {} };

  const categories = {};
  interests.forEach((i) => {
    categories[i.category] = i.level;
  });

  const topInterests = interests
    .sort((a, b) => b.level - a.level)
    .slice(0, 5)
    .map((i) => ({ category: i.category, level: i.level }));

  return { topInterests, categories };
}

function analyzeAbilities(abilities) {
  if (!abilities.length) return { topAbilities: [], overallLevel: "UNKNOWN", categories: {} };

  const categories = {};
  abilities.forEach((a) => {
    categories[a.category] = { score: a.score, level: a.level };
  });

  const avgScore = abilities.reduce((sum, a) => sum + a.score, 0) / abilities.length;
  let overallLevel = "MEDIUM";
  if (avgScore >= 80) overallLevel = "EXCELLENT";
  else if (avgScore >= 60) overallLevel = "HIGH";
  else if (avgScore < 40) overallLevel = "LOW";

  const topAbilities = abilities
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((a) => ({ category: a.category, score: a.score, level: a.level }));

  return { topAbilities, overallLevel, categories, averageScore: avgScore };
}

function analyzeTestResults(attempts) {
  if (!attempts.length) return { completed: 0, averageScore: 0 };

  const totalScore = attempts.reduce((sum, a) => sum + a.totalScore, 0);

  return {
    completed: attempts.length,
    averageScore: totalScore / attempts.length,
  };
}

function analyzeParentOpinions(opinions) {
  if (!opinions.length) return { hasOpinions: false };

  return {
    hasOpinions: true,
    latest: opinions[opinions.length - 1],
  };
}

function calculateSuggestions(analysis) {
  const fieldScores = {};

  // Score fields based on grades
  if (analysis.grades.strengths.length) {
    analysis.grades.strengths.forEach((subject) => {
      Object.entries(FIELD_MAPPING).forEach(([key, mapping]) => {
        if (mapping.relatedFields && Array.isArray(mapping.relatedFields)) {
          mapping.relatedFields.forEach((f) => {
            if (f.includes(subject) || subject.includes(mapping.label)) {
              fieldScores[f] = (fieldScores[f] || 0) + WEIGHTS.grades * 100;
            }
          });
        }
      });
    });
  }

  // Score fields based on interests
  if (analysis.interests.topInterests) {
    analysis.interests.topInterests.forEach((interest) => {
      const mapping = FIELD_MAPPING[interest.category];
      if (mapping && mapping.relatedFields && Array.isArray(mapping.relatedFields)) {
        mapping.relatedFields.forEach((f) => {
          fieldScores[f] = (fieldScores[f] || 0) + WEIGHTS.interests * interest.level * 20;
        });
      }
    });
  }

  // Score fields based on abilities
  if (analysis.abilities.topAbilities) {
    analysis.abilities.topAbilities.forEach((ability) => {
      const recommendation = ABILITY_RECOMMENDATIONS[ability.category];
      if (recommendation) {
        Object.entries(FIELD_MAPPING).forEach(([key, mapping]) => {
          if (mapping.relatedFields && Array.isArray(mapping.relatedFields)) {
            mapping.relatedFields.forEach((f) => {
              fieldScores[f] = (fieldScores[f] || 0) + WEIGHTS.abilities * (ability.score / 100) * 100;
            });
          }
        });
      }
    });
  }

  // Sort and get top suggestions
  const sortedFields = Object.entries(fieldScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([field, score]) => ({
      field,
      score: Math.round(score),
      confidence: score > 200 ? "بالا" : score > 100 ? "متوسط" : "پایین",
    }));

  return {
    suggestedFields: sortedFields,
    disclaimer: "این پیشنهاد صرفاً برای بررسی توسط مشاور ارائه شده است و تصمیم نهایی بر عهده مشاور و دانش‌آموز می‌باشد.",
  };
}

export {
  WEIGHTS,
  FIELD_MAPPING,
  ABILITY_RECOMMENDATIONS,
  analyzeGrades,
  analyzeInterests,
  analyzeAbilities,
  analyzeTestResults,
  analyzeParentOpinions,
  calculateSuggestions,
};
