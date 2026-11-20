"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";

const NAV_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin", label: "Dashboard", icon: "speedometer" },
  { href: "/admin/results", label: "Hasil Tes", icon: "clipboard" },
  { href: "/admin/orders", label: "Pembayaran", icon: "checkCircle" },
  { href: "/admin/certificates", label: "Sertifikat", icon: "patchCheck" },
  { href: "/admin/tests", label: "Paket Tes", icon: "collection" },
  { href: "/admin/settings", label: "Pengaturan", icon: "gear" },
];

/**
 * Menu samping admin. CSS NiceAdmin menganggap link TANPA kelas `collapsed`
 * sebagai menu aktif — jadi kelas itu harus dipasang di semua link kecuali
 * halaman yang sedang dibuka. Sebelumnya tidak ada yang memakainya, sehingga
 * keenam menu tampil biru (aktif) bersamaan.
 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <ul className="sidebar-nav" id="sidebar-nav">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <li className="nav-item" key={item.href}>
            <Link
              className={`nav-link d-flex align-items-center gap-2 ${active ? "" : "collapsed"}`}
              href={item.href}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
