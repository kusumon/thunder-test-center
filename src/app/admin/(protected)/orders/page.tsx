import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatRupiah } from "@/lib/settings";
import { approveOrderAction, rejectOrderAction } from "@/app/admin/actions";
import { OrderReviewForm } from "@/components/OrderReviewForm";

const STATUS_BADGE: Record<string, string> = {
  MENUNGGU_PEMBAYARAN: "bg-secondary",
  MENUNGGU_KONFIRMASI: "bg-warning text-dark",
  DISETUJUI: "bg-success",
  DITOLAK: "bg-danger",
};

const STATUS_LABEL: Record<string, string> = {
  MENUNGGU_PEMBAYARAN: "Menunggu Pembayaran",
  MENUNGGU_KONFIRMASI: "Perlu Diverifikasi",
  DISETUJUI: "Disetujui",
  DITOLAK: "Ditolak",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  // Default menampilkan yang butuh tindakan, karena itulah alasan admin
  // membuka halaman ini.
  const statusFilter = params.status ?? "MENUNGGU_KONFIRMASI";

  const orders = await prisma.certificateOrder.findMany({
    where: statusFilter === "SEMUA" ? {} : { status: statusFilter as never },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      attempt: {
        select: { id: true, publicCode: true, participantNameSnapshot: true, overallScore: true },
      },
      reviewedBy: { select: { email: true } },
    },
  });

  const tabs = ["MENUNGGU_KONFIRMASI", "MENUNGGU_PEMBAYARAN", "DISETUJUI", "DITOLAK", "SEMUA"];

  return (
    <div className="pagetitle mb-4">
      <h1>Pembayaran Sertifikat</h1>

      <div className="mb-3 d-flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <Link
            key={tab}
            href={`/admin/orders?status=${tab}`}
            className={`btn btn-sm ${statusFilter === tab ? "tp-btn-primary" : "btn-outline-secondary"}`}
          >
            {STATUS_LABEL[tab] ?? "Semua"}
          </Link>
        ))}
      </div>

      {orders.length === 0 && (
        <div className="card">
          <div className="card-body text-center text-muted py-5">
            Tidak ada pesanan pada status ini.
          </div>
        </div>
      )}

      {orders.map((order) => (
        <div className="card mb-3" key={order.id}>
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <h5 className="card-title mb-1">
                  <Link href={`/admin/results/${order.attempt.id}`}>
                    {order.attempt.participantNameSnapshot}
                  </Link>
                </h5>
                <div className="small text-muted">
                  Tes <span className="font-monospace">{order.attempt.publicCode}</span> · Skor{" "}
                  {order.attempt.overallScore}
                </div>
              </div>
              <span className={`badge ${STATUS_BADGE[order.status]}`}>
                {STATUS_LABEL[order.status]}
              </span>
            </div>

            <div className="row g-3 mt-1">
              <div className="col-md-3">
                <div className="text-muted small">Nominal dicari di mutasi</div>
                <div className="fw-bold fs-5 text-primary">{formatRupiah(order.amount)}</div>
              </div>
              <div className="col-md-3">
                <div className="text-muted small">Kode klaim</div>
                <div className="font-monospace">{order.claimCode}</div>
              </div>
              <div className="col-md-3">
                <div className="text-muted small">WhatsApp</div>
                <div>{order.whatsappNumber ?? <span className="text-muted">—</span>}</div>
              </div>
              <div className="col-md-3">
                <div className="text-muted small">Peserta klaim bayar</div>
                <div className="small">
                  {order.paidClaimedAt
                    ? new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(order.paidClaimedAt)
                    : "—"}
                </div>
              </div>
            </div>

            {order.reviewedAt && (
              <div className="alert alert-light border small mt-3 mb-0">
                Ditinjau {order.reviewedBy?.email ?? "—"} pada{" "}
                {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(
                  order.reviewedAt,
                )}
                {order.reviewNote && <div className="mt-1">Catatan: {order.reviewNote}</div>}
              </div>
            )}

            {order.status !== "DISETUJUI" && (
              <OrderReviewForm
                orderId={order.id}
                approveAction={approveOrderAction.bind(null, order.id)}
                rejectAction={rejectOrderAction.bind(null, order.id)}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
