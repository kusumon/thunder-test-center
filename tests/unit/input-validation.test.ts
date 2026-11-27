import { describe, expect, it } from "vitest";
import { sanitizeParticipantName } from "@/lib/name";
import { normalizeClaimCode } from "@/lib/claimCode";
import { safeAudioName } from "@/lib/audioName";
import { readEnv } from "@/lib/env";
import { waMeLink } from "@/lib/adminLabels";

describe("nama peserta (FR-001)", () => {
  const ok = (v: string) => {
    const r = sanitizeParticipantName(v);
    expect(r.ok).toBe(true);
    return r.ok ? r.value : "";
  };
  const err = (v: unknown) => {
    const r = sanitizeParticipantName(v as FormDataEntryValue | null);
    expect(r.ok).toBe(false);
  };

  it("menerima nama normal & merapikan spasi", () => {
    expect(ok("  Budi   Santoso  ")).toBe("Budi Santoso");
  });

  it("mempertahankan nama non-Latin / beraksen", () => {
    expect(ok("José Ñúñez")).toBe("José Ñúñez");
    expect(ok("王小明")).toBe("王小明");
  });

  it("membuang tag HTML/script (XSS)", () => {
    expect(ok("<script>alert(1)</script>Budi")).toBe("alert(1)Budi");
    expect(ok('Budi<img src=x onerror="alert(1)">')).toBe("Budi");
    expect(ok("<b>Budi</b> <i>S</i>")).toBe("Budi S");
  });

  it("menolak yang kosong setelah tag dibuang", () => {
    err("<script></script>");
    err("   ");
  });

  it("batas panjang 2–120 karakter", () => {
    err("A");
    expect(ok("Ab")).toBe("Ab");
    expect(ok("A".repeat(120)).length).toBe(120);
    err("A".repeat(121));
  });

  it("menolak input yang bukan teks (mis. File dari form)", () => {
    err(null);
    err(new Blob(["x"]));
  });

  it("payload SQL injection hanya diperlakukan sebagai teks biasa", () => {
    expect(ok("Robert'); DROP TABLE attempts;--")).toBe("Robert'); DROP TABLE attempts;--");
  });
});

describe("kode klaim", () => {
  it.each([
    ["TPC-AB12-CD34", "TPC-AB12-CD34"],
    ["tpc-ab12-cd34", "TPC-AB12-CD34"],
    ["ab12 cd34", "TPC-AB12-CD34"],
    ["AB12CD34", "TPC-AB12-CD34"],
    ["  TPC AB12 CD34  ", "TPC-AB12-CD34"],
  ])("'%s' → %s", (input, expected) => {
    expect(normalizeClaimCode(input)).toBe(expected);
  });

  it("kosong → null", () => {
    expect(normalizeClaimCode("")).toBeNull();
    expect(normalizeClaimCode("  - - ")).toBeNull();
    expect(normalizeClaimCode(null)).toBeNull();
  });

  it("karakter berbahaya dibuang (SQL/HTML tidak lolos ke query)", () => {
    expect(normalizeClaimCode("' OR 1=1 --")).toBe("OR11");
    expect(normalizeClaimCode("<script>")).toBe("SCRIPT");
  });

  it("input sangat panjang dipotong (tidak membebani database)", () => {
    expect(normalizeClaimCode("A".repeat(10_000))!.length).toBeLessThanOrEqual(32);
  });
});

describe("nama file audio (unggah admin)", () => {
  it.each([
    ["listening.mp3", "listening.mp3"],
    ["Listening Test 1.MP3", "Listening-Test-1.mp3"],
    ["../../etc/passwd.mp3", "etc-passwd.mp3"],
    ["..\\..\\windows\\win.ini", "windows-win-ini.mp3"],
    ["%2e%2e%2fsecret.mp3", "2e-2e-2fsecret.mp3"],
    ["....mp3", "listening.mp3"],
    ["", "listening.mp3"],
  ])("'%s' → '%s'", (input, expected) => {
    expect(safeAudioName(input)).toBe(expected);
  });

  it("tidak pernah mengandung '/', '\\' atau '..'", () => {
    for (const evil of ["../a", "a/../../b", "..\\x", "/abs/path", "a/b/c.mp3"]) {
      const out = safeAudioName(evil);
      expect(out).not.toMatch(/[\\/]|\.\./);
      expect(out.endsWith(".mp3")).toBe(true);
    }
  });

  it("panjang dibatasi", () => {
    expect(safeAudioName("a".repeat(500) + ".mp3").length).toBeLessThanOrEqual(84);
  });
});

describe("env var", () => {
  it("nilai hanya-spasi dianggap kosong (bug APP_BASE_URL=\" \")", () => {
    process.env.__T = " ";
    expect(readEnv("__T")).toBeUndefined();
    process.env.__T = "  https://x.test  ";
    expect(readEnv("__T")).toBe("https://x.test");
    delete process.env.__T;
    expect(readEnv("__T")).toBeUndefined();
  });
});

describe("tautan WhatsApp peserta", () => {
  it.each([
    ["081234567890", "https://wa.me/6281234567890"],
    ["+62 812-3456-7890", "https://wa.me/6281234567890"],
    ["6281234567890", "https://wa.me/6281234567890"],
  ])("'%s' → %s", (input, expected) => {
    expect(waMeLink(input)).toBe(expected);
  });

  it("nomor tidak valid / kosong → null (tidak membuat tautan rusak)", () => {
    expect(waMeLink("123")).toBeNull();
    expect(waMeLink("")).toBeNull();
    expect(waMeLink(null)).toBeNull();
    expect(waMeLink("javascript:alert(1)")).toBeNull();
  });
});
