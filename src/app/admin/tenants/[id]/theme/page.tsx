import { notFound } from "next/navigation";
import { getTenantById, getThemeOptions } from "@/lib/db/queries/tenants";
import { ThemeForm } from "@/components/admin/tenant-detail/theme-form";

/** Onglet « Thème » : thème du catalogue + apparence (logo, couleur). */

export default async function TenantThemePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tenant, themes] = await Promise.all([
    getTenantById(id),
    getThemeOptions(),
  ]);
  if (!tenant) notFound();

  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold">Thème &amp; apparence</h2>
        <p className="text-sm text-muted-foreground">
          Thème appliqué à la boutique, logo et couleur principale.
        </p>
      </div>
      <ThemeForm tenant={tenant} themes={themes} />
    </section>
  );
}
