import { notFound } from "next/navigation";
import { getTenantById } from "@/lib/db/queries/tenants";
import { InfoForm } from "@/components/admin/tenant-detail/info-form";

/** Onglet « Infos » : identité, configuration et client porteur. */

export default async function TenantInfoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await getTenantById(id);
  if (!tenant) notFound();

  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold">Informations</h2>
        <p className="text-sm text-muted-foreground">
          Nom, configuration de la boutique et coordonnées du client.
          Le slug reste immuable après la création.
        </p>
      </div>
      <InfoForm tenant={tenant} />
    </section>
  );
}
