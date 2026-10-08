import Link from "next/link";
import { ChevronLeft, ChevronRight, Globe } from "lucide-react";
import { SslStatus } from "@prisma/client";
import {
  getDomains,
  type DomainSslFilter,
  type DomainVerifiedFilter,
} from "@/lib/db/queries/domains";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DomainsToolbar } from "@/components/admin/domains-toolbar";
import { DomainRowActions } from "@/components/admin/domain-row-actions";

/**
 * `/admin/domains` — liste paginée des domaines (module 8).
 *
 * Server Component : lecture de l'URL + requête Prisma ici ; seuls la
 * barre d'outils et les actions de ligne sont des Client Components.
 */

export const metadata = { title: "Domaines" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseSsl(value: string | undefined): DomainSslFilter {
  if (value && Object.values(SslStatus).includes(value as SslStatus)) {
    return value as SslStatus;
  }
  return "ALL";
}

function parseVerified(value: string | undefined): DomainVerifiedFilter {
  return value === "yes" || value === "no" ? value : "ALL";
}

function SslBadge({ status }: { status: string }) {
  const badge =
    status === SslStatus.ACTIVE
      ? { label: "SSL actif", variant: "success" as const }
      : status === SslStatus.FAILED
        ? { label: "SSL échoué", variant: "destructive" as const }
        : { label: "SSL en attente", variant: "warning" as const };
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <Badge variant={verified ? "success" : "outline"}>
      {verified ? "Vérifié" : "Non vérifié"}
    </Badge>
  );
}

function Pagination({
  page,
  pageCount,
  total,
}: {
  page: number;
  pageCount: number;
  total: number;
}) {
  if (total === 0) return null;

  const href = (target: number) => `/admin/domains?page=${target}`;

  return (
    <nav
      aria-label="Pagination des domaines"
      className="flex flex-col items-center justify-between gap-3 sm:flex-row"
    >
      <p className="text-sm text-muted-foreground">
        Page {page} sur {pageCount} · {total} domaine{total > 1 ? "s" : ""}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={href(page - 1)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ChevronLeft className="size-4" aria-hidden />
            Précédent
          </Link>
        ) : (
          <span
            className={`${buttonVariants({ variant: "outline", size: "sm" })} pointer-events-none opacity-50`}
          >
            <ChevronLeft className="size-4" aria-hidden />
            Précédent
          </span>
        )}
        {page < pageCount ? (
          <Link
            href={href(page + 1)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Suivant
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <span
            className={`${buttonVariants({ variant: "outline", size: "sm" })} pointer-events-none opacity-50`}
          >
            Suivant
            <ChevronRight className="size-4" aria-hidden />
          </span>
        )}
      </div>
    </nav>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="rounded-full bg-muted p-4">
        <Globe aria-hidden className="size-6 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">
          {hasFilters
            ? "Aucun domaine ne correspond aux filtres"
            : "Aucun domaine enregistré"}
        </h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {hasFilters
            ? "Essayez d’élargir la recherche ou de réinitialiser les filtres."
            : "Les domaines apparaissent ici dès qu’une boutique est créée ou qu’un domaine custom est ajouté."}
        </p>
      </div>
      {hasFilters && (
        <Link
          href="/admin/domains"
          className={buttonVariants({ variant: "outline" })}
        >
          Réinitialiser les filtres
        </Link>
      )}
    </div>
  );
}

export default async function DomainsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const search = first(sp.search) ?? "";
  const ssl = parseSsl(first(sp.ssl));
  const verified = parseVerified(first(sp.verified));
  const page = parsePage(first(sp.page));

  const result = await getDomains({ search, ssl, verified, page });
  const hasFilters = Boolean(search || ssl !== "ALL" || verified !== "ALL");

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Domaines</h1>
          <p className="text-sm text-muted-foreground">
            {result.total} domaine{result.total > 1 ? "s" : ""} géré
            {result.total > 1 ? "s" : ""} sur la plateforme.
          </p>
        </div>
        <Link
          href="/admin/tenants"
          className={buttonVariants({ variant: "outline" })}
        >
          Gérer depuis les boutiques
        </Link>
      </header>

      <DomainsToolbar search={search} ssl={ssl} verified={verified} />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Domaine</th>
              <th className="px-4 py-2.5 font-medium">Boutique</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">SSL</th>
              <th className="px-4 py-2.5 font-medium">Vérifié</th>
              <th className="px-4 py-2.5 font-medium">Ajouté le</th>
              <th className="px-4 py-2.5 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-0">
                  <EmptyState hasFilters={hasFilters} />
                </td>
              </tr>
            ) : (
              result.items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/domains/${item.id}`}
                      className="block truncate font-mono text-xs font-medium hover:underline"
                    >
                      {item.domain}
                    </Link>
                    {item.checkedAt && (
                      <span className="block text-xs text-muted-foreground">
                        Vérifié le{" "}
                        {new Date(item.checkedAt).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/tenants/${item.tenant.id}`}
                      className="truncate hover:underline"
                    >
                      {item.tenant.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">
                      {item.type === "SUBDOMAIN" ? "Sous-domaine" : "Custom"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <SslBadge status={item.sslStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <VerifiedBadge verified={item.verified} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    <DomainRowActions domainId={item.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
      />
    </div>
  );
}
