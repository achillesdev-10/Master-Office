import { notFound } from "next/navigation";
import { getTenantById } from "@/lib/db/queries/tenants";
import { DangerZone } from "@/components/admin/tenant-detail/danger-zone";

/** Onglet « Zone de danger » : suspendre, archiver, supprimer. */

export default async function TenantDangerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await getTenantById(id);
  if (!tenant) notFound();

  return (
    <section className="rounded-lg border border-destructive/40 bg-card p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-destructive">
          Zone de danger
        </h2>
        <p className="text-sm text-muted-foreground">
          Ces actions sont auditées. La suppression est une suppression
          logique : les données restent en base et l’action reste réversible.
        </p>
      </div>
      <DangerZone tenant={tenant} />
    </section>
  );
}
