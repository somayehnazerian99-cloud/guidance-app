import { z } from "zod";

export const loginSchema = z.object({
  username: z
    .string()
    .min(1, "نام کاربری الزامی است")
    .max(50, "نام کاربری نباید بیش از ۵۰ کاراکتر باشد")
    .trim(),
  password: z
    .string()
    .min(1, "رمز عبور الزامی است")
    .max(128, "رمز عبور نباید بیش از ۱۲۸ کاراکتر باشد"),
  // Each login page sends a fixed role. The server verifies it against the
  // stored role so accounts cannot authenticate through the wrong portal.
  role: z.enum(["ADMIN", "COUNSELOR", "STUDENT"]).optional(),
});

export const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "نام کاربری باید حداقل ۳ کاراکتر باشد")
    .max(50, "نام کاربری نباید بیش از ۵۰ کاراکتر باشد")
    .regex(/^[a-zA-Z0-9_]+$/, "نام کاربری فقط شامل حروف، اعداد و زیرخط باشد"),
  password: z
    .string()
    .min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد")
    .max(128, "رمز عبور نباید بیش از ۱۲۸ کاراکتر باشد"),
  firstName: z.string().min(1, "نام الزامی است").max(100),
  lastName: z.string().min(1, "نام خانوادگی الزامی است").max(100),
  email: z.string().email("ایمیل نامعتبر است").optional().or(z.literal("")),
  role: z.enum(["ADMIN", "COUNSELOR", "STUDENT"], {
    errorMap: () => ({ message: "نقش نامعتبر است" }),
  }),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1, "نام الزامی است").max(100).optional(),
  lastName: z.string().min(1, "نام خانوادگی الزامی است").max(100).optional(),
  email: z.string().email("ایمیل نامعتبر است").optional().or(z.literal("")),
  role: z.enum(["ADMIN", "COUNSELOR", "STUDENT"]).optional(),
  isActive: z.boolean().optional(),
  password: z
    .string()
    .min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد")
    .max(128)
    .optional()
    .or(z.literal("")),
});

export const studentProfileSchema = z.object({
  firstName: z.string().min(1, "نام الزامی است").max(100),
  lastName: z.string().min(1, "نام خانوادگی الزامی است").max(100),
  studentCode: z
    .string()
    .min(1, "کد دانش‌آموزی الزامی است")
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, "کد دانش‌آموزی فقط شامل حروف، اعداد، - و _ باشد"),
  schoolId: z.string().optional().nullable(),
  classId: z.string().optional().nullable(),
  counselorId: z.string().optional().nullable(),
  grade: z.coerce.number().int().min(7, "پایه باید بین ۷ و ۹ باشد").max(9, "پایه باید بین ۷ و ۹ باشد"),
  schoolYear: z.string().min(1, "سال تحصیلی الزامی است").max(20),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  parentPhone: z.string().max(20).optional().nullable(),
});

export const updateStudentSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  schoolId: z.string().optional().nullable(),
  classId: z.string().optional().nullable(),
  counselorId: z.string().optional().nullable(),
  grade: z.coerce.number().int().min(7).max(9).optional(),
  schoolYear: z.string().min(1).max(20).optional(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  parentPhone: z.string().max(20).optional().nullable(),
  profileComplete: z.boolean().optional(),
});

export const gradeSchema = z.object({
  studentId: z.string().min(1, "دانش‌آموز الزامی است"),
  subjectName: z.string().min(1, "نام درس الزامی است").max(100),
  score: z.coerce
    .number()
    .min(0, "نمره نمی‌تواند منفی باشد")
    .max(20, "نمره نمی‌تواند بیش از ۲۰ باشد"),
  maxScore: z.coerce.number().min(1).max(100).default(20),
  semester: z.coerce.number().int().min(1).max(2),
  academicYear: z.string().min(1, "سال تحصیلی الزامی است").max(20),
  gradeLevel: z.coerce.number().int().min(7).max(9),
  evaluationType: z.string().max(50).optional().nullable(),
});

export const interestSchema = z.object({
  studentId: z.string().min(1),
  interests: z
    .array(
      z.object({
        category: z.string().min(1).max(50),
        level: z.coerce.number().int().min(1).max(5).default(1),
        notes: z.string().max(500).optional().nullable(),
      })
    )
    .max(50, "تعداد علایق بیش از حد مجاز است"),
});

export const abilitySchema = z.object({
  studentId: z.string().min(1),
  abilities: z
    .array(
      z.object({
        category: z.string().min(1).max(50),
        score: z.coerce.number().min(0).max(100),
        level: z.enum(["LOW", "MEDIUM", "HIGH", "EXCELLENT"]).default("MEDIUM"),
        notes: z.string().max(500).optional().nullable(),
      })
    )
    .max(50, "تعداد توانایی‌ها بیش از حد مجاز است"),
});

export const parentOpinionSchema = z.object({
  studentId: z.string().min(1),
  parentName: z.string().max(150).optional().nullable(),
  interests: z.string().max(2000).optional().nullable(),
  abilities: z.string().max(2000).optional().nullable(),
  fieldInterest: z.string().max(2000).optional().nullable(),
  behavioral: z.string().max(2000).optional().nullable(),
  activities: z.string().max(2000).optional().nullable(),
  generalNotes: z.string().max(4000).optional().nullable(),
});

export const guidanceTestSchema = z.object({
  title: z.string().min(1, "عنوان آزمون الزامی است").max(200),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  questions: z
    .array(
      z.object({
        text: z.string().min(1, "متن سؤال الزامی است"),
        order: z.number().int().min(0),
        options: z.array(
          z.object({
            text: z.string().min(1),
            score: z.number().default(0),
            order: z.number().int().min(0),
          })
        ),
      })
    )
    .optional(),
});

export const testAnswerSchema = z.object({
  attemptId: z.string().min(1),
  questionId: z.string().min(1),
  optionId: z.string().min(1),
});

export const educationalVideoSchema = z.object({
  title: z.string().min(1, "عنوان ویدئو الزامی است").max(200),
  description: z.string().optional(),
  thumbnail: z.string().optional(),
  videoUrl: z
    .string()
    .url("لینک ویدئو نامعتبر است")
    .refine(
      (url) => {
        try {
          const u = new URL(url);
          return ["youtube.com", "youtu.be", "aparat.com"].some((d) =>
            u.hostname.includes(d)
          );
        } catch {
          return false;
        }
      },
      { message: "فقط لینک‌های YouTube و Aparat پشتیبانی می‌شوند" }
    ),
  category: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const schoolSchema = z.object({
  name: z.string().min(1, "نام مدرسه الزامی است").max(200),
  city: z.string().max(100).optional().nullable(),
  province: z.string().max(100).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const classSchema = z.object({
  name: z.string().min(1, "نام کلاس الزامی است").max(100),
  grade: z.coerce.number().int().min(7).max(9),
  schoolYear: z.string().min(1, "سال تحصیلی الزامی است").max(20),
  schoolId: z.string().min(1, "مدرسه الزامی است"),
  counselorId: z.string().optional().nullable(),
});

export const notificationSchema = z.object({
  studentId: z.string().min(1),
  title: z.string().min(1, "عنوان الزامی است").max(200),
  message: z.string().min(1, "متن پیام الزامی است").max(2000),
  type: z.enum(["INFO", "WARNING", "SUCCESS"]).default("INFO"),
});

export const guidanceTestUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const videoUpdateSchema = educationalVideoSchema.partial();

/**
 * Read the first human-readable message out of a Zod error.
 *
 * Zod v4 removed `error.errors`; only `error.issues` exists. Reaching for the
 * old property threw a TypeError, which every route turned into a generic 500 —
 * so validation failures never produced their Persian message.
 */
export function firstValidationError(error, fallback = "اطلاعات واردشده نامعتبر است") {
  const issues = Array.isArray(error?.issues) ? error.issues : [];
  return issues[0]?.message || fallback;
}

export const parseJsonBody = async (request) => {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return { ok: false };
  }
};

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "رمز عبور فعلی الزامی است"),
  newPassword: z
    .string()
    .min(8, "رمز عبور جدید باید حداقل ۸ کاراکتر باشد")
    .max(128),
});

export const forgotPasswordSchema = z.object({
  username: z.string().min(1, "نام کاربری الزامی است").max(50).trim(),
});

export const resetPasswordSchema = z.object({
  token: z
    .string()
    .min(32, "توکن نامعتبر است")
    .max(256, "توکن نامعتبر است")
    .regex(/^[a-f0-9]+$/i, "توکن نامعتبر است"),
  newPassword: z
    .string()
    .min(8, "رمز عبور جدید باید حداقل ۸ کاراکتر باشد")
    .max(128),
});

export const testSubmitSchema = z.object({
  testId: z.string().min(1, "شناسه آزمون الزامی است"),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        optionId: z.string().min(1),
      })
    )
    .min(1, "حداقل به یک سؤال پاسخ دهید")
    .max(200, "تعداد پاسخ‌ها بیش از حد مجاز است"),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("asc"),
});
