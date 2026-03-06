import crypto from "node:crypto";
import { env } from "@/lib/config";

export function verifyLineSignature(rawBody: string, signatureHeader: string | null) {
  if (!signatureHeader) {
    return false;
  }

  const hmac = crypto.createHmac("sha256", env.LINE_CHANNEL_SECRET);
  hmac.update(rawBody);
  const expected = hmac.digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signatureHeader);
  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}
