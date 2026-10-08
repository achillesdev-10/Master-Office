import { getThemes } from "@/lib/db/queries/themes";
import { ThemesManager } from "@/components/admin/themes-manager";

/**
 * `/admin/themes` — catalogue des thèmes (module 11).
 *
 * Server Component : lecture du catalogue ; création / édition /
 * suppression déléguées au Client Component `ThemesManager`.
 */

export const metadata = { title: "Thèmes" };

export default async function ThemesPage() {
  const themes = await getThemes();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Thèmes</h1>
        <p className="text-sm text-muted-foreground">
          {themes.length} thème{themes.length > 1 ? "s" : ""} dans le
          catalogue, affectables aux boutiques.
        </p>
      </header>

      <ThemesManager themes={themes} />
    </div>
  );
}
