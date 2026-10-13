import { Metadata } from "next";
import Link from "next/link";
import { Lock, Home, User, AlertCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Accès non autorisé",
};

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6">
          <Lock className="mx-auto h-16 w-16 text-muted-foreground/50" aria-hidden />
        </div>

        <h1 className="mb-2 text-2xl font-bold tracking-tight">Accès non autorisé</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Vous n&apos;avez pas les permissions nécessaires pour accéder à cette page.
        </p>

        <div className="space-y-3">
          <Link
            href="/login"
            className={buttonVariants({ variant: "default" })}
          >
            <User className="mr-2 h-4 w-4" aria-hidden />
            Se connecter
          </Link>

          <Link
            href="/"
            className={buttonVariants({ variant: "outline" })}
          >
            <Home className="mr-2 h-4 w-4" aria-hidden />
            Retour à l&apos;accueil
          </Link>
        </div>

        <div className="mt-8 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
          <AlertCircle className="mx-auto mb-2 h-5 w-5" aria-hidden />
          <p>
            Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, contactez l&apos;administrateur
            de la plateforme.
          </p>
        </div>
      </div>
    </div>
  );
}