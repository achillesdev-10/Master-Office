import Link from "next/link";
import { ThemeNewForm } from "@/components/admin/theme-new-form";

/** `/admin/themes/new` — création d’un thème du catalogue (module 11). */
export const metadata = { title: "Nouveau thème" };

export default function NewThemePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/admin/themes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Thèmes
        </Link>
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            Nouveau thème
          </h1>
          <p className="text-sm text-muted-foreground">
            Ajoutez un thème au catalogue : aperçu, catégorie et option
            premium.
          </p>
        </header>
      </div>

      <ThemeNewForm />
    </div>
  );
}
