import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/adminSession";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { ThunderMark } from "@/components/Brand";

export default async function AdminLoginPage() {
  const admin = await getAdminSession();
  if (admin) redirect("/admin");

  return (
    <main
      className="tp-hero d-flex align-items-center justify-content-center"
      style={{ minHeight: "100vh", padding: "2rem 0" }}
    >
      <div className="container" style={{ maxWidth: 400 }}>
        <div className="text-center mb-4">
          <div className="d-flex justify-content-center mb-3 tp-logo-glow">
            <ThunderMark size={60} id="login" />
          </div>
          <div className="tp-brand fs-5">THUNDER TEST CENTER</div>
          <div className="tp-eyebrow mt-1">Admin Dashboard</div>
        </div>
        <div className="tp-card p-4 text-start" style={{ color: "var(--tp-text)" }}>
          <AdminLoginForm />
        </div>
      </div>
    </main>
  );
}
