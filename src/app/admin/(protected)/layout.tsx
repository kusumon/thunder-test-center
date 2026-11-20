import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/adminSession";
import { AdminNav } from "@/components/AdminNav";

/**
 * Kerangka panel admin. Tidak lagi memakai template NiceAdmin (CSS 25 KB +
 * skrip) — menu samping, warna, dan kartu kini memakai sistem desain yang
 * sama dengan halaman peserta (globals.css, kelas `adm-*` dan `tp-*`).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");

  const pendingOrders = await prisma.certificateOrder.count({ where: { status: "MENUNGGU_KONFIRMASI" } });

  return (
    <div className="adm-shell">
      <AdminNav email={admin.email} pendingOrders={pendingOrders} />
      <main className="adm-main">{children}</main>
    </div>
  );
}
