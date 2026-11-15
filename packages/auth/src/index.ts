import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [scheme, salt, hex] = encoded.split(":");
  if (scheme !== "scrypt" || !salt || !hex) return false;
  const expected = Buffer.from(hex, "hex");
  const actual = await scrypt(password, salt, 64) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const newSessionToken = () => randomBytes(32).toString("hex");
export const sessionDigest = (token: string) => createHash("sha256").update(token).digest("hex");
