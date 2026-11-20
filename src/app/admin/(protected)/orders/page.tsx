import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatRupiah } from "@/lib/settings";
import { approveOrderAction, rejectOrderAction } from "@/app/admin/actions";
import { ORDER_STATUS, formatDateTime, waMeLink } from "@/lib/adminLabels";
import { OrderReviewForm } from "@/components/OrderReviewForm";
import { CopyButton } from "@/components/CopyButton";
import { LineIcon } from "@/components/LineIcon";

const TABS = [
  { key: "MENUNGGU_KONFIRMASI", label: "Perlu dicek", hint: "Peserta sudah menekan \"Saya sudah transfer\"." },
  { key: "MENUNGGU_PEMBAYARAN", label: "Belum bayar", hint: "Peserta sudah memesan tapi belum mengonfirmasi transfer. Kalau uangnya ternyata sudah masuk, Anda tetap bisa menyetujuinya." },
  { key: "DISETUJUI", label: "Disetujui", hint: "Sertifikat sudah terbit." },
  { key: "DITOLAK", label: "Ditolak", hint: "Peserta melihat alasan penolakan dan bisa mengonfirmasi ulang." },
  { key: "SEMUA", label: "Semua", hint: "" },
] as const;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  // Default: yang butuh tindakan, karena itulah alasan admin membuka halaman ini.
  const statusFilter = TABS.some((t) => t.key === params.status) ? params.status! : "MENUNGGU_KONFIRMASI";

  const [orders, groups] = await Promise.all([
    prisma.certificateOrder.findMany({
      where: statusFilter === "SEMUA" ? {} : { status: statusFilter as never },
      orderBy: [{ paidClaimedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 100,
      include: {
        attempt: { select: { id: true, participantNameSnapshot: true, overallScore: true } },
        reviewedBy: { select: { email: true } },
      },
    }),
    prisma.certificateOrder.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const counts = Object.fromEntries(groups.map((g) => [g.status, g._count._all])) as Record<string, number>;
  counts.SEMUA = groups.reduce((n, g) => n + g._count._all, 0);
  const activeTab = TABS.find((t) => t.key === statusFilter)!;

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Pembayaran Sertifikat</h1>
          <p>Setujui pembayaran yang sudah masuk ke rekening — sertifikat peserta langsung terbit.</p>
        </div>
      </div>

      {statusFilter === "MENUNGGU_KONFIRMASI" && (
        <div className="tp-card p-3 p-md-4 mb-4">
          <div className="fw-bold text-dark mb-2">Cara mengecek</div>
          <ol className="tp-steps small">
            <li>Buka mutasi rekening Anda (aplikasi bank).</li>
            <li>
              Cari transfer dengan <strong>nominal persis sama</strong> — 3 angka terakhirnya unik untuk
              tiap peserta.
            </li>
            <li>
              Kalau ada, tekan <strong>Setujui</strong>. Kalau tidak ada, tekan <strong>Tolak</strong> dan
              tulis alasannya.
            </li>
          </ol>
        </div>
      )}

      <div className="adm-tabs mb-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/orders?status=${tab.key}`}
            className={`adm-tab ${statusFilter === tab.key ? "is-active" : ""}`}
          >
            {tab.label}
            <span className="adm-tab-count">{counts[tab.key] ?? 0}</span>
          </Link>
        ))}
      </div>
      {activeTab.hint && <p className="small text-muted mb-3">{activeTab.hint}</p>}

      {orders.length === 0 && (
        <div className="tp-card p-5 text-center text-muted">
          <div className="d-flex justify-content-center mb-2 text-success">
            <LineIcon name="check" size={32} strokeWidth={2.5} />
          </div>
          Tidak ada pesanan di sini.
        </div>
      )}

      <div className="row g-3">
        {orders.map((order) => {
          const status = ORDER_STATUS[order.status];
          const wa = waMeLink(order.whatsappNumber);
          return (
            <div className="col-xl-6" key={order.id}>
              <div className="tp-card p-4 h-100">
                <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                  <div>
                    <Link
                      href={`/admin/results/${order.attempt.id}`}
                      className="fw-bold fs-5 text-dark text-decoration-none"
                    >
                      {order.attempt.participantNameSnapshot}
                    </Link>
                    <div className="small text-muted">Skor {order.attempt.overallScore ?? "—"}</div>
                  </div>
                  <span className={`badge rounded-pill ${status.badge}`}>{status.label}</span>
                </div>

                <div
                  className="d-flex justify-content-between align-items-center rounded-4 p-3 mb-3"
                  style={{ background: "linear-gradient(135deg, #eff6ff, #ecfeff)" }}
                >
                  <div>
                    <div className="adm-label">Cari nominal ini di mutasi</div>
                    <div className="fs-3 fw-bold tp-text-gradient lh-sm">{formatRupiah(order.amount)}</div>
                  </div>
                  <CopyButton value={String(order.amount)} />
                </div>

                <div className="row g-2 small mb-1">
                  <div className="col-6">
                    <div className="adm-label">WhatsApp</div>
                    {wa ? (
                      <a href={wa} target="_blank" rel="noreferrer" className="fw-semibold text-decoration-none">
                        {order.whatsappNumber} ↗
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </div>
                  <div className="col-6">
                    <div className="adm-label">Kode klaim</div>
                    <span className="font-monospace text-dark text-nowrap">{order.claimCode}</span>
                  </div>
                  <div className="col-6">
                    <div className="adm-label">Dipesan</div>
                    <span>{formatDateTime(order.createdAt)}</span>
                  </div>
                  <div className="col-6">
                    <div className="adm-label">Konfirmasi transfer</div>
                    <span>{order.paidClaimedAt ? formatDateTime(order.paidClaimedAt) : "Belum"}</span>
                  </div>
                </div>

                {order.reviewedAt && (
                  <div className="tp-note small mt-3">
                    {order.status === "DISETUJUI" ? "Disetujui" : "Ditinjau"} oleh {order.reviewedBy?.email ?? "—"}
                    , {formatDateTime(order.reviewedAt)}
                    {order.reviewNote && <div className="mt-1">Catatan: {order.reviewNote}</div>}
                  </div>
                )}

                {order.status !== "DISETUJUI" && (
                  <OrderReviewForm
                    orderId={order.id}
                    amountLabel={formatRupiah(order.amount)}
                    approveAction={approveOrderAction.bind(null, order.id)}
                    rejectAction={rejectOrderAction.bind(null, order.id)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
