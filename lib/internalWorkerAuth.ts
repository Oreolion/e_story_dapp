import { timingSafeEqual } from "node:crypto";
export function workerAuthorized(request: Request, secret: string | undefined) {
  if (!secret || secret.length < 32) return false;
  const expected = Buffer.from(`Bearer ${secret}`), supplied = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
