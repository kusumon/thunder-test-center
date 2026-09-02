import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/adminSession";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { ThunderMark } from "@/components/Brand";

export default async function AdminLoginPage() {
  const admin = await getAdminSession();
  if (admin) redirect("/admin");

  return (
    <main className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: 380 }}>
        <div className="text-center mb-4">
          <div className="d-flex justify-content-center mb-2">
            <ThunderMark size={52} id="login" />
          </div>
          <div className="tp-brand fs-5">Thunder Test Center</div>
          <div className="text-muted small">Admin Dashboard</div>
        </div>
        <div className="tp-card p-4">
          <AdminLoginForm />
        </div>
      </div>
    </main>
  );
}
