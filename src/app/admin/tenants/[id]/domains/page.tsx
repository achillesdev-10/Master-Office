import { notFound } from "next/navigation";
import { getTenantById, getRootDomain } from "@/lib/db/queries/tenants";
import { getTenantDomains } from "@/lib/db/queries/tenant-detail";
import { getSslTarget } from "@/lib/validators/domain";
import { DomainsManager } from "@/components/admin/tenant-detail/domains-manager";

/** Onglet « Domaines » : sous-domaine auto + domaines custom. */

export default async function TenantDomainsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await getTenantById(id);
  if (!tenant) notFound();

  const domains = await getTenantDomains(tenant.id);

  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold">Domaines</h2>
        <p className="text-sm text-muted-foreground">
          Sous-domaine de la plateforme{" "}
          <code className="font-mono">{tenant.slug}.{getRootDomain()}</code>{" "}
          et domaines personnalisés du client.
        </p>
      </div>
      <DomainsManager
        tenantId={tenant.id}
        domains={domains}
        target={getSslTarget()}
      />
    </section>
  );
}
