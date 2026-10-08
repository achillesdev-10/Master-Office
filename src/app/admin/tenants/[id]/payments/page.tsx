import { notFound } from "next/navigation";
import { getTenantById } from "@/lib/db/queries/tenants";
import { getTenantPayments } from "@/lib/db/queries/tenant-detail";
import { PaymentsManager } from "@/components/admin/tenant-detail/payments-manager";

/** Onglet « Paiements » : providers activés + clés API chiffrées. */

export default async function TenantPaymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await getTenantById(id);
  if (!tenant) notFound();

  const payments = await getTenantPayments(tenant.id);

  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold">Moyens de paiement</h2>
        <p className="text-sm text-muted-foreground">
          Les clés API sont chiffrées (AES-256-GCM) et ne sont jamais
          affichées en clair.
        </p>
      </div>
      <PaymentsManager tenantId={tenant.id} payments={payments} />
    </section>
  );
}
