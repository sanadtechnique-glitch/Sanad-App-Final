import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export function isHashed(password: string): boolean {
  return password.startsWith("$2b$") || password.startsWith("$2a$");
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (isHashed(stored)) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored;
}
