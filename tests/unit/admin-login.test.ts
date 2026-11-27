import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

type Admin = { id: string; passwordHash: string; failedLoginCount: number; lockedUntil: Date | null };
let admin: Admin | null;

vi.mock("@/lib/db", () => ({
  prisma: {
    adminUser: {
      findUnique: vi.fn(async () => (admin ? { ...admin } : null)),
      update: vi.fn(async ({ data }: { data: Partial<Admin> }) => {
        if (admin) Object.assign(admin, data);
        return admin;
      }),
    },
  },
}));

const { attemptAdminLogin } = await import("@/lib/adminAuth");
const PASSWORD = "password-benar-123";

beforeEach(async () => {
  admin = { id: "a-1", passwordHash: await bcrypt.hash(PASSWORD, 4), failedLoginCount: 0, lockedUntil: null };
});

describe("login admin & penguncian (NFR-SEC-008)", () => {
  it("password benar → berhasil", async () => {
    expect(await attemptAdminLogin("admin@x", PASSWORD)).toEqual({ ok: true, adminUserId: "a-1" });
  });

  it("email tidak terdaftar & password salah memberi pesan yang SAMA (tidak bocorkan email valid)", async () => {
    const wrongPw = await attemptAdminLogin("admin@x", "salah");
    admin = null;
    const noUser = await attemptAdminLogin("tidakada@x", "salah");
    expect(wrongPw).toEqual(noUser);
  });

  it("5x salah berturut-turut → akun terkunci, password benar pun ditolak", async () => {
    for (let i = 0; i < 5; i++) await attemptAdminLogin("admin@x", `salah-${i}`);
    expect(admin!.lockedUntil).not.toBeNull();
    const r = await attemptAdminLogin("admin@x", PASSWORD);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Coba lagi dalam \d+ menit/);
  });

  it("kunci berlaku ±15 menit lalu terbuka lagi", async () => {
    for (let i = 0; i < 5; i++) await attemptAdminLogin("admin@x", "salah");
    const minutes = (admin!.lockedUntil!.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);
    admin!.lockedUntil = new Date(Date.now() - 1000); // waktu kunci sudah lewat
    expect((await attemptAdminLogin("admin@x", PASSWORD)).ok).toBe(true);
  });

  it("login berhasil mereset penghitung gagal", async () => {
    await attemptAdminLogin("admin@x", "salah");
    await attemptAdminLogin("admin@x", "salah");
    expect(admin!.failedLoginCount).toBe(2);
    await attemptAdminLogin("admin@x", PASSWORD);
    expect(admin!.failedLoginCount).toBe(0);
  });

  it("password kosong / sangat panjang tidak membuat error", async () => {
    expect((await attemptAdminLogin("admin@x", "")).ok).toBe(false);
    expect((await attemptAdminLogin("admin@x", "x".repeat(10_000))).ok).toBe(false);
  });
});
