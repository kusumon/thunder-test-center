"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { adminLogout } from "@/app/admin/actions";
import { ThunderMark } from "@/components/Brand";
import { LineIcon, type LineIconName } from "@/components/LineIcon";

const NAV_ITEMS: { href: string; label: string; icon: LineIconName; hint: string }[] = [
  { href: "/admin", label: "Ringkasan", icon: "chart", hint: "Gambaran hari ini" },
  { href: "/admin/orders", label: "Pembayaran", icon: "card", hint: "Cek & setujui transfer" },
  { href: "/admin/results", label: "Peserta & Skor", icon: "user", hint: "Semua hasil tes" },
  { href: "/admin/certificates", label: "Sertifikat", icon: "award", hint: "Sertifikat yang terbit" },
  { href: "/admin/tests", label: "Paket Soal", icon: "book", hint: "Waktu, petunjuk, audio" },
  { href: "/admin/settings", label: "Pengaturan", icon: "key", hint: "Harga, rekening, WA" },
];

/**
 * Menu samping admin. Di desktop selalu tampil; di HP tersembunyi di balik
 * tombol menu dan muncul sebagai panel geser.
 */
export function AdminNav({ email, pendingOrders }: { email: string; pendingOrders: number }) {
  const pathname = usePathname();
  // Panel (di HP) terbuka untuk halaman tempat ia dibuka; begitu pindah
  // halaman, `pathname` berubah dan panel otomatis tertutup.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);

  const current = NAV_ITEMS.find((item) =>
    item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href),
  );

  return (
    <>
      {/* Bilah atas khusus HP */}
      <header className="adm-mobilebar d-lg-none">
        <button type="button" className="adm-menu-btn" onClick={() => setOpen(true)} aria-label="Buka menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
          {pendingOrders > 0 && <span className="adm-dot" />}
        </button>
        <span className="fw-bold text-dark">{current?.label ?? "Admin"}</span>
        <ThunderMark size={30} id="adm-mobile" />
      </header>

      {open && <div className="adm-backdrop d-lg-none" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside className={`adm-sidebar ${open ? "is-open" : ""}`}>
        <Link href="/admin" className="adm-brand">
          <ThunderMark size={36} id="adm-side" />
          <span>
            <span className="d-block fw-bold lh-sm">Thunder Test Center</span>
            <span className="d-block adm-brand-sub">Panel Admin</span>
          </span>
        </Link>

        <nav className="adm-nav">
          {NAV_ITEMS.map((item) => {
            const active = item === current;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`adm-nav-link ${active ? "is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <LineIcon name={item.icon} size={20} />
                <span className="flex-grow-1">
                  <span className="d-block">{item.label}</span>
                  <span className="d-block adm-nav-hint">{item.hint}</span>
                </span>
                {item.href === "/admin/orders" && pendingOrders > 0 && (
                  <span className="adm-count" title={`${pendingOrders} pembayaran perlu dicek`}>
                    {pendingOrders}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="adm-sidebar-foot">
          <a href="/" target="_blank" rel="noreferrer" className="adm-nav-link">
            <LineIcon name="arrowRight" size={18} />
            <span>Lihat website peserta</span>
          </a>
          <div className="adm-user">
            <span className="text-truncate" title={email}>
              {email}
            </span>
            <form action={adminLogout}>
              <button type="submit" className="adm-logout">
                Keluar
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
