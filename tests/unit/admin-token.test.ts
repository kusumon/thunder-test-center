import { describe, expect, it } from "vitest";
import { createAdminToken, parseAdminToken, verifyAdminSignature } from "@/lib/adminToken";

const SECRET = "test-secret-yang-panjang-sekali-0123456789";
const ADMIN_ID = "6f1c2b9e-3a4d-4c5e-8f90-1a2b3c4d5e6f";
const HASH = "$2a$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123";
const NOW = 1_800_000_000_000;

const valid = () => createAdminToken(ADMIN_ID, NOW + 60_000, HASH, SECRET);
const check = (token: string, hash = HASH, secret = SECRET, now = NOW) => {
  const parsed = parseAdminToken(token, now);
  return parsed !== null && verifyAdminSignature(parsed, hash, secret);
};

describe("token sesi admin", () => {
  it("token asli diterima", () => {
    expect(check(valid())).toBe(true);
  });

  it("kedaluwarsa → ditolak", () => {
    expect(check(valid(), HASH, SECRET, NOW + 60_001)).toBe(false);
  });

  it("GANTI PASSWORD → semua token lama ditolak", () => {
    expect(check(valid(), "$2a$12$hash-password-baru-yang-berbeda")).toBe(false);
  });

  it("secret server berbeda → ditolak", () => {
    expect(check(valid(), HASH, "secret-lain")).toBe(false);
  });

  it("mengubah id admin di token (menyamar jadi admin lain) → ditolak", () => {
    const [, exp, sig] = valid().split(".");
    expect(check(`7a1c2b9e-3a4d-4c5e-8f90-1a2b3c4d5e6f.${exp}.${sig}`)).toBe(false);
  });

  it("memperpanjang masa berlaku di token → ditolak", () => {
    const [id, , sig] = valid().split(".");
    expect(check(`${id}.${NOW + 10 ** 12}.${sig}`)).toBe(false);
  });

  it("satu karakter tanda tangan diubah → ditolak", () => {
    const t = valid();
    const flipped = t.slice(0, -1) + (t.endsWith("0") ? "1" : "0");
    expect(check(flipped)).toBe(false);
  });

  it.each([
    ["kosong", ""],
    ["bukan 3 bagian", "a.b"],
    ["bagian ekstra", `${ADMIN_ID}.${NOW + 1000}.${"a".repeat(64)}.x`],
    ["id bukan UUID (injeksi)", `' OR 1=1--.${NOW + 1000}.${"a".repeat(64)}`],
    ["expiry bukan angka", `${ADMIN_ID}.Infinity.${"a".repeat(64)}`],
    ["expiry negatif", `${ADMIN_ID}.-1.${"a".repeat(64)}`],
    ["tanda tangan bukan hex", `${ADMIN_ID}.${NOW + 1000}.${"z".repeat(64)}`],
    ["tanda tangan kependekan", `${ADMIN_ID}.${NOW + 1000}.abc`],
    ["sangat panjang (DoS)", "x".repeat(100_000)],
  ])("bentuk tidak sah ditolak sebelum menyentuh database: %s", (_label, token) => {
    expect(parseAdminToken(token, NOW)).toBeNull();
  });

  it("tanda tangan palsu berbentuk sah tetap ditolak", () => {
    expect(check(`${ADMIN_ID}.${NOW + 1000}.${"a".repeat(64)}`)).toBe(false);
  });
});
