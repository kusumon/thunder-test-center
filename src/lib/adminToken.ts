import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token sesi admin `<adminUserId>.<expiryMs>.<signature>` — logika murni
 * (tanpa cookie/database) supaya bisa diuji sendiri; dipakai
 * lib/adminSession.ts.
 *
 * Tanda tangan = HMAC-SHA256(secret, "<payload>|<passwordHash>"): terikat ke
 * hash password admin saat token dibuat, sehingga mengganti password
 * membatalkan semua token lama.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hmac(payload: string, passwordHash: string, secret: string): string {
  return createHmac("sha256", secret).update(`${payload}|${passwordHash}`).digest("hex");
}

export function createAdminToken(adminUserId: string, expiresAt: number, passwordHash: string, secret: string): string {
  const payload = `${adminUserId}.${expiresAt}`;
  return `${payload}.${hmac(payload, passwordHash, secret)}`;
}

export type ParsedAdminToken = { adminUserId: string; expiresAt: number; payload: string; signature: string };

/** Cek bentuk & masa berlaku saja (tanpa database). Null = token pasti tidak sah. */
export function parseAdminToken(token: string | undefined | null, now = Date.now()): ParsedAdminToken | null {
  if (!token || token.length > 512) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [adminUserId, expiresAtRaw, signature] = parts;
  if (!UUID_RE.test(adminUserId)) return null;
  if (!/^\d{1,16}$/.test(expiresAtRaw)) return null;
  const expiresAt = Number(expiresAtRaw);
  if (now > expiresAt) return null;
  if (!/^[0-9a-f]{64}$/.test(signature)) return null;
  return { adminUserId, expiresAt, payload: `${adminUserId}.${expiresAtRaw}`, signature };
}

/** Bandingkan tanda tangan dengan waktu-konstan memakai hash password TERKINI dari database. */
export function verifyAdminSignature(parsed: ParsedAdminToken, passwordHash: string, secret: string): boolean {
  const expected = Buffer.from(hmac(parsed.payload, passwordHash, secret));
  const actual = Buffer.from(parsed.signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
