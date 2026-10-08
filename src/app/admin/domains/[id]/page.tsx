import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User } from "lucide-react";
import {
  getDomainById,
  getDomainHistory,
  type DomainHistoryAction,
} from "@/lib/db/queries/domains";
import { getSslTarget } from "@/lib/validators/domain";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DomainRowActions } from "@/components/admin/domain-row-actions";
import { DnsInstructions } from "@/components/admin/tenant-detail/dns-instructions";

/** Fiche d’un domaine (module 8) : DNS, SSL et historique. */

export const metadata = { title: "Domaine" };

const HISTORY_LABELS: Record<DomainHistoryAction, string> = {
  "domain.add": "Domaine ajouté",
  "domain.verify": "Vérification DNS",
  "domain.ssl": "Demande SSL",
  "domain.remove": "Domaine supprimé",
};

const RESULT_VARIANTS: Record<
  string,
  "success" | "warning" | "destructive" | "secondary" | "info"
> = {
  ok: "success",
  mismatch: "warning",
  absent: "destructive",
  requested: "info",
  created: "secondary",
  deleted: "secondary",
};

export default async function DomainDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const domain = await getDomainById(id);
  if (!domain) notFound();

  const history = await getDomainHistory(domain.id, domain.tenant.id);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="break-all font-mono text-xl font-semibold tracking-tight">
            {domain.domain}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {domain.type === "SUBDOMAIN" ? "Sous-domaine" : "Domaine custom"}
            </Badge>
            <Badge
              variant={
                domain.sslStatus === "ACTIVE"
                  ? "success"
                  : domain.sslStatus === "FAILED"
                    ? "destructive"
                    : "warning"
              }
            >
              {domain.sslStatus === "ACTIVE"
                ? "SSL actif"
                : domain.sslStatus === "FAILED"
                  ? "SSL échoué"
                  : "SSL en attente"}
            </Badge>
            <Badge variant={domain.verified ? "success" : "outline"}>
              {domain.verified ? "Vérifié" : "Non vérifié"}
            </Badge>
            <Link
              href={`/admin/tenants/${domain.tenant.id}`}
              className="text-sm text-muted-foreground hover:underline"
            >
              {domain.tenant.name}
            </Link>
          </div>
        </div>

        <Link
          href="/admin/domains"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Tous les domaines
        </Link>
      </header>

      <section className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Configuration DNS</h2>
            <p className="text-sm text-muted-foreground">
              Cible attendue : <code className="font-mono">{getSslTarget()}</code>
              {domain.checkedAt && (
                <>
                  {" · "}
                  Dernier contrôle :{" "}
                  {new Date(domain.checkedAt).toLocaleString("fr-FR")}
                </>
              )}
            </p>
          </div>
          <DomainRowActions domainId={domain.id} />
        </div>

        <DnsInstructions domain={domain.domain} target={getSslTarget()} />
      </section>

      <section className="rounded-lg border bg-card p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Historique des vérifications</h2>
          <p className="text-sm text-muted-foreground">
            Journal d’audit de la boutique (ajouts, contrôles DNS, SSL).
          </p>
        </div>

        {history.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aucune vérification enregistrée pour ce domaine.
          </div>
        ) : (
          <ol className="space-y-3">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {HISTORY_LABELS[entry.action] ?? entry.action}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="size-3.5" aria-hidden />
                    {entry.user ?? "Système"} ·{" "}
                    {new Date(entry.createdAt).toLocaleString("fr-FR")}
                  </p>
                  {entry.records.length > 0 && (
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                      CNAME : {entry.records.join(", ")}
                    </p>
                  )}
                </div>

                {entry.result && (
                  <Badge variant={RESULT_VARIANTS[entry.result] ?? "secondary"}>
                    {entry.result}
                  </Badge>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
