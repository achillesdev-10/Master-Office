import { getThemeOptions } from "@/lib/db/queries/tenants";
import { TenantWizard } from "@/components/admin/tenant-form/wizard";

export const metadata = { title: "Nouvelle boutique" };

/**
 * /admin/tenants/new — wizard de création multi-étapes (module 6).
 * Server Component : charge le catalogue de thèmes, le formulaire
 * lui-même est un Client Component (état local, aucune navigation).
 */
export default async function NewTenantPage() {
  const themes = await getThemeOptions();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nouvelle boutique
        </h1>
        <p className="text-sm text-muted-foreground">
          Renseignez les informations en 7 étapes : la boutique, son domaine
          et sa configuration sont créés en une seule opération.
        </p>
      </header>

      <TenantWizard themes={themes} />
    </div>
  );
}
