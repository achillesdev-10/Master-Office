"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Globe, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addTenantDomain,
  removeTenantDomain,
  requestSsl,
  verifyDomain,
} from "@/lib/actions/domains";
import type { TenantDomainItem } from "@/lib/db/queries/tenant-detail";
import { Field } from "@/components/admin/tenant-form/field";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DnsInstructions } from "./dns-instructions";

const SSL_BADGES: Record<
  string,
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  ACTIVE: { label: "SSL actif", variant: "success" },
  PENDING: { label: "SSL en attente", variant: "warning" },
  FAILED: { label: "SSL échoué", variant: "destructive" },
};

function SslBadge({ status }: { status: string }) {
  const badge = SSL_BADGES[status] ?? {
    label: status,
    variant: "warning" as const,
  };
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}

/**
 * Onglet « Domaines » : ajout d’un domaine custom, vérification DNS,
 * demande SSL et suppression (sous-domaine auto protégé).
 */
export function DomainsManager({
  tenantId,
  domains,
  target,
}: {
  tenantId: string;
  domains: TenantDomainItem[];
  target: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [domain, setDomain] = useState("");

  const run = async (
    action: () => Promise<{ success: boolean; error?: string; message?: string }>,
    successMessage: string,
  ): Promise<boolean> => {
    const result = await action();
    if (result.success) {
      toast.success(result.message ?? successMessage);
      router.refresh();
      return true;
    }
    toast.error(result.error ?? "Action impossible.");
    return false;
  };

  const handleAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    startTransition(async () => {
      const ok = await run(
        () => addTenantDomain({ tenantId, domain: domain.trim() }),
        "Domaine ajouté.",
      );
      if (ok) setDomain("");
    });
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleAdd}
        className="grid gap-4 rounded-lg border border-dashed p-4 sm:grid-cols-[1fr_auto] sm:items-end"
        noValidate
      >
        <Field
          label="Ajouter un domaine"
          htmlFor="new-domain"
          error={errors.domain}
          hint="Le domaine doit être déjà enregistré chez un registrar."
        >
          <Input
            id="new-domain"
            placeholder="shop.exemple.com"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            className="font-mono"
          />
        </Field>
        <Button type="submit" disabled={pending} className="h-9">
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          Ajouter
        </Button>
      </form>

      {domains.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aucun domaine associé à cette boutique.
        </div>
      ) : (
        <ul className="space-y-4">
          {domains.map((item) => (
            <li key={item.id} className="rounded-lg border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Globe className="size-4 text-muted-foreground" aria-hidden />
                    <span className="break-all font-mono text-sm font-medium">
                      {item.domain}
                    </span>
                    <Badge variant="secondary">
                      {item.type === "SUBDOMAIN" ? "Sous-domaine" : "Custom"}
                    </Badge>
                    <SslBadge status={item.sslStatus} />
                    <Badge variant={item.verified ? "success" : "outline"}>
                      {item.verified ? "Vérifié" : "Non vérifié"}
                    </Badge>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.checkedAt
                      ? `Dernière vérification : ${new Date(item.checkedAt).toLocaleString("fr-FR")}`
                      : "Jamais vérifié"}
                    {item.verifiedAt &&
                      ` · vérifié le ${new Date(item.verifiedAt).toLocaleDateString("fr-FR")}`}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        await run(
                          () => verifyDomain(item.id),
                          "Domaine vérifié.",
                        );
                      });
                    }}
                  >
                    <ShieldCheck className="size-3.5" aria-hidden />
                    Vérifier DNS
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        await run(() => requestSsl(item.id), "Demande SSL envoyée.");
                      });
                    }}
                  >
                    SSL
                  </Button>

                  <Link
                    href={`/admin/domains/${item.id}`}
                    className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    Fiche
                  </Link>

                  {item.type === "CUSTOM" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Supprimer ${item.domain}`}
                      disabled={pending}
                      onClick={() => {
                        const confirmed = window.confirm(
                          `Supprimer le domaine ${item.domain} ?`,
                        );
                        if (!confirmed) return;
                        startTransition(async () => {
                          await run(
                            () => removeTenantDomain(item.id),
                            "Domaine supprimé.",
                          );
                        });
                      }}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <DnsInstructions domain={item.domain} target={target} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
