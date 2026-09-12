/**
 * Password policy — the single source of truth.
 *
 * This module is intentionally dependency-free (no Prisma, no bcrypt) so that
 * both the server (lib/auth.js, API routes) and client-side form validation can
 * import it without dragging the database client into a browser bundle.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const WEAK_PASSWORDS = [
  "password",
  "12345678",
  "qwerty123",
  "admin123",
  "Password1",
  "11111111",
  "123456789",
  "abcd1234",
];

/**
 * Describe the policy in Persian so the UI can show the same rules the server
 * enforces, instead of a hand-written list that can drift out of sync.
 */
export const PASSWORD_REQUIREMENTS = [
  `حداقل ${PASSWORD_MIN_LENGTH} کاراکتر`,
  "حداقل یک حرف بزرگ انگلیسی (A-Z)",
  "حداقل یک حرف کوچک انگلیسی (a-z)",
  "حداقل یک عدد (0-9)",
  "شامل کلمات عبور رایج نباشد",
];

/**
 * @param {string} password
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validatePasswordStrength(password) {
  const errors = [];

  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`رمز عبور باید حداقل ${PASSWORD_MIN_LENGTH} کاراکتر باشد`);
  }
  if (password && password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`رمز عبور نباید بیش از ${PASSWORD_MAX_LENGTH} کاراکتر باشد`);
  }
  if (password && !/[A-Z]/.test(password)) {
    errors.push("رمز عبور باید حداقل یک حرف بزرگ انگلیسی داشته باشد");
  }
  if (password && !/[a-z]/.test(password)) {
    errors.push("رمز عبور باید حداقل یک حرف کوچک انگلیسی داشته باشد");
  }
  if (password && !/[0-9]/.test(password)) {
    errors.push("رمز عبور باید حداقل یک عدد داشته باشد");
  }

  if (password && WEAK_PASSWORDS.includes(password.toLowerCase())) {
    errors.push("این رمز عبور بسیار ضعیف است");
  }

  return { valid: errors.length === 0, errors };
}
