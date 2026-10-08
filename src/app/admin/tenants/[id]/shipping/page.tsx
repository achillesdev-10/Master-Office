import { notFound } from "next/navigation";
import { getTenantById } from "@/lib/db/queries/tenants";
import { getTenantShipping } from "@/lib/db/queries/tenant-detail";
import { ShippingManager } from "@/components/admin/tenant-detail/shipping-manager";

/** Onglet « Livraison » : méthodes (nom, prix, activation). */

export default async function TenantShippingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await getTenantById(id);
  if (!tenant) notFound();

  const methods = await getTenantShipping(tenant.id);

  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold">Méthodes de livraison</h2>
        <p className="text-sm text-muted-foreground">
          Prix exprimés en {tenant.currency} (stockés en centimes).
        </p>
      </div>
      <ShippingManager tenantId={tenant.id} methods={methods} />
    </section>
  );
}
