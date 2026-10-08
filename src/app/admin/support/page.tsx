import { LifeBuoy } from "lucide-react";

/** `/admin/support` — tickets de support (module hors périmètre MVP). */
export const metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
        <p className="text-sm text-muted-foreground">
          Demandes d’aide des marchands et des clients.
        </p>
      </header>

      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
        <div className="rounded-full bg-muted p-4">
          <LifeBuoy aria-hidden className="size-6 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Aucun ticket</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Le module de tickets n’est pas encore connecté. Les demandes de
            support arriveront ici à terme.
          </p>
        </div>
      </div>
    </div>
  );
}
