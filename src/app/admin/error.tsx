"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Frontière d’erreur de la zone `/admin` (modules 1 → 12).
 * Affiche un message générique + « Réessayer » (le détail technique
 * n’est exposé qu’au développement via `error.digest`).
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertTriangle aria-hidden className="size-6 text-destructive" />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold">
          Une erreur est survenue
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Le dashboard n’a pas pu charger cette section. Réessayez ; si le
          problème persiste, vérifiez la connexion à la base de données.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground">
            Référence : {error.digest}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={reset}>
          <RotateCcw className="size-4" aria-hidden />
          Réessayer
        </Button>
        <Button variant="outline" onClick={() => window.location.assign("/admin/dashboard")}>
          Tableau de bord
        </Button>
      </div>

      {process.env.NODE_ENV === "development" && (
        <pre className="max-w-2xl overflow-auto rounded-md border bg-muted/50 p-3 text-left font-mono text-xs">
          {error.message}
        </pre>
      )}
    </div>
  );
}
