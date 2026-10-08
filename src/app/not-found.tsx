import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** 404 racine — affiché pour toute route inconnue (dont slug boutique inexistant). */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="rounded-full bg-muted p-4">
        <Compass aria-hidden className="size-6 text-muted-foreground" />
      </div>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight">
        Page introuvable
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        La page demandée n’existe pas ou la boutique est introuvable.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link href="/admin/dashboard" className={buttonVariants()}>
          Tableau de bord
        </Link>
        <Link
          href="/login"
          className={buttonVariants({ variant: "outline" })}
        >
          Connexion
        </Link>
      </div>
    </div>
  );
}
