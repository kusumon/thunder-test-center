import { describe, expect, it, vi } from "vitest";
import { startOfTodayJakarta } from "@/lib/date";
import { formatDate, formatDateTime } from "@/lib/adminLabels";

vi.mock("@/lib/db", () => ({ prisma: {} }));
const { isSectionTimeUp } = await import("@/lib/sections");

describe("awal hari WIB (server Vercel berjalan di UTC)", () => {
  it("16:59 UTC masih hari yang sama di WIB (23:59 WIB)", () => {
    const start = startOfTodayJakarta(new Date("2026-11-20T16:59:00Z"));
    expect(start.toISOString()).toBe("2026-11-19T17:00:00.000Z");
  });

  it("17:00 UTC sudah hari berikutnya di WIB (00:00 WIB)", () => {
    const start = startOfTodayJakarta(new Date("2026-11-20T17:00:00Z"));
    expect(start.toISOString()).toBe("2026-11-20T17:00:00.000Z");
  });

  it("dini hari WIB (00:30 WIB = 17:30 UTC kemarin) tidak dihitung ke hari sebelumnya", () => {
    const start = startOfTodayJakarta(new Date("2026-11-20T17:30:00Z")); // 21 Nov 00:30 WIB
    expect(start.toISOString()).toBe("2026-11-20T17:00:00.000Z"); // 21 Nov 00:00 WIB
  });
});

describe("format tanggal admin selalu WIB", () => {
  it("20:30 UTC tampil sebagai tanggal berikutnya 03.30 WIB", () => {
    const d = new Date("2026-11-22T20:30:00Z");
    expect(formatDate(d)).toMatch(/23/);
    expect(formatDateTime(d)).toMatch(/03[.:]30/);
    expect(formatDateTime(d)).toMatch(/WIB$/);
  });

  it("null → tanda strip", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });
});

describe("waktu bagian tes (server-authoritative timer)", () => {
  const session = { endsAt: new Date("2026-01-01T10:00:00Z") } as Parameters<typeof isSectionTimeUp>[0];
  it("belum habis 1 ms sebelum batas", () => {
    expect(isSectionTimeUp(session, new Date("2026-01-01T09:59:59.999Z"))).toBe(false);
  });
  it("habis tepat di batas dan sesudahnya", () => {
    expect(isSectionTimeUp(session, new Date("2026-01-01T10:00:00Z"))).toBe(true);
    expect(isSectionTimeUp(session, new Date("2026-01-01T12:00:00Z"))).toBe(true);
  });
});
