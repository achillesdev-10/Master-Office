"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { requestSsl, verifyDomain } from "@/lib/actions/domains";
import { Button } from "@/components/ui/button";

/**
 * Actions d’une ligne de la liste des domaines : vérification DNS
 * (`dns.promises.resolveCname`) et (re)génération du certificat SSL.
 */
export function DomainRowActions({ domainId }: { domainId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (
    action: () => Promise<{ success: boolean; error?: string; message?: string }>,
    successMessage: string,
  ) => {
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        toast.success(result.message ?? successMessage);
        router.refresh();
      } else {
        toast.error(result.error ?? "Action impossible.");
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => run(() => verifyDomain(domainId), "Domaine vérifié.")}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <ShieldCheck className="size-3.5" aria-hidden />
        )}
        Vérifier DNS
      </Button>

      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => run(() => requestSsl(domainId), "Demande SSL envoyée.")}
      >
        <Zap className="size-3.5" aria-hidden />
        Régénérer SSL
      </Button>

      <Link
        href={`/admin/domains/${domainId}`}
        className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ExternalLink className="size-3.5" aria-hidden />
        Voir
      </Link>
    </div>
  );
}
