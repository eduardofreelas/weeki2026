import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
import { PaymentError } from "./errors.js";
export const randomToken = () => randomBytes(32).toString("base64url");
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const challenge = (value: string) =>
  createHash("sha256").update(value).digest("base64url");
export function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function seal(value: unknown, key: Buffer, context: string) {
  if (key.length !== 32) throw new PaymentError("NOT_CONFIGURED", 503);
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}
export function unseal<T>(value: string, key: Buffer, context: string): T {
  try {
    const [version, iv, tag, data] = value.split(".");
    if (version !== "v1") throw new PaymentError("INVALID_CREDENTIAL", 503);
    const cipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "base64url"),
    );
    cipher.setAAD(Buffer.from(context));
    cipher.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(
      Buffer.concat([
        cipher.update(Buffer.from(data, "base64url")),
        cipher.final(),
      ]).toString(),
    ) as T;
  } catch {
    throw new PaymentError("INVALID_CREDENTIAL", 503);
  }
}
export function verifyHmac(secret: string, input: string, signature: string) {
  if (
    !secret ||
    !/^[a-f0-9]{64}$/i.test(signature) ||
    !equal(createHmac("sha256", secret).update(input).digest("hex"), signature)
  )
    throw new PaymentError("INVALID_WEBHOOK", 401);
}
export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return domain ? `${name[0] || ""}••••@${domain}` : "";
}
