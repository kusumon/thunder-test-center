import Link from "next/link";
import Script from "next/script";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/adminSession";
import { adminLogout } from "@/app/admin/actions";
import { Icon, type IconName } from "@/components/Icon";
import { ThunderMark } from "@/components/Brand";

const NAV_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin", label: "Dashboard", icon: "speedometer" },
  { href: "/admin/results", label: "Hasil Tes", icon: "clipboard" },
  { href: "/admin/orders", label: "Pembayaran", icon: "checkCircle" },
  { href: "/admin/certificates", label: "Sertifikat", icon: "patchCheck" },
  { href: "/admin/tests", label: "Paket Tes", icon: "collection" },
  { href: "/admin/settings", label: "Pengaturan", icon: "gear" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");

  return (
    <>
      <link rel="stylesheet" href="/niceadmin/css/style.css" />

      <header id="header" className="header fixed-top d-flex align-items-center">
        <div className="d-flex align-items-center justify-content-between">
          <Link href="/admin" className="logo d-flex align-items-center gap-2">
            <ThunderMark size={30} id="admin" />
            <span className="d-none d-lg-block">Thunder Test Center</span>
          </Link>
          <button type="button" className="btn btn-link toggle-sidebar-btn p-0 border-0" aria-label="Buka/tutup menu">
            <Icon name="list" size={22} />
          </button>
        </div>

        {/* Sengaja TIDAK memakai dropdown Bootstrap: komponen itu butuh
            bootstrap.bundle.min.js (~80 KB) hanya untuk satu menu, dan tanpa
            JS tersebut menunya tidak pernah terbuka sehingga tombol Keluar
            jadi tidak bisa diklik sama sekali. Tombol datar ini bekerja
            tanpa JavaScript apa pun. */}
        <nav className="header-nav ms-auto">
          <div className="d-flex align-items-center gap-3 pe-3">
            <span className="d-none d-md-flex align-items-center gap-2 text-muted small">
              <Icon name="person" />
              {admin.email}
            </span>
            <form action={adminLogout}>
              <button type="submit" className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1">
                <Icon name="logout" />
                <span>Keluar</span>
              </button>
            </form>
          </div>
        </nav>
      </header>

      <aside id="sidebar" className="sidebar">
        <ul className="sidebar-nav" id="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <li className="nav-item" key={item.href}>
              <Link className="nav-link d-flex align-items-center gap-2" href={item.href}>
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <main id="main" className="main">
        {children}
      </main>

      <footer id="footer" className="footer">
        <div className="copyright">
          &copy; TOEFL Prediction Test — <strong>Dashboard Admin</strong>
        </div>
        <div className="credits">Prediction/simulation platform. Bukan layanan resmi ETS.</div>
      </footer>

      <Script src="/niceadmin/js/main.js" strategy="afterInteractive" />
    </>
  );
}
