import Link from "next/link";
import { notFound } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { ArrowLeft, Building2, Clock, ScrollText, Shield } from "lucide-react";
import { getUserDetail } from "@/lib/db/queries/users";
import { PLATFORM_ROLE_LABELS } from "@/lib/validators/user";
import { formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { TenantStatusBadge } from "@/components/admin/tenant-status-badge";

/**
 * `/admin/users/[id]` — fiche utilisateur (module 9) :
 * compte + boutiques rattachées + journal des actions liées.
 * Lecture seule : les mutations restent sur la liste `/admin/users`.
 */

export const metadata = { title: "Fiche utilisateur" };

type Params = Promise<{ id: string }>;

function ActionBadge({ action }: { action: string }) {
  const variant =
    action.includes("delete") || action.includes("disable")
      ? "destructive"
      : action.includes("invite") || action.includes("create")
        ? "success"
        : action.includes("role") || action.includes("status")
          ? "warning"
          : "info";
  return <Badge variant={variant}>{action}</Badge>;
}

export default async function UserDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await getUserDetail(id);
  if (!user) notFound();

  // Dernière connexion via l'API Clerk (best effort, hors ligne possible)
  let lastSignInAt: string | null = null;
  if (!user.pending) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(user.clerkId);
      lastSignInAt = clerkUser.lastSignInAt
        ? new Date(clerkUser.lastSignInAt).toISOString()
        : null;
    } catch {
      lastSignInAt = null;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Utilisateurs
        </Link>

        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              {user.email}
              <Badge
                variant={
                  user.role === "SUPER_ADMIN"
                    ? "default"
                    : user.role === "ADMIN"
                      ? "info"
                      : "secondary"
                }
              >
                {PLATFORM_ROLE_LABELS[user.role]}
              </Badge>
              {user.disabled && <Badge variant="destructive">Désactivé</Badge>}
              {user.pending && <Badge variant="warning">En attente</Badge>}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Inscrit le{" "}
              {new Date(user.createdAt).toLocaleDateString("fr-FR")} ·{" "}
              {user.tenants.length} boutique
              {user.tenants.length > 1 ? "s" : ""}
            </p>
          </div>
        </header>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-5 lg:col-span-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="size-4 text-muted-foreground" aria-hidden />
            Compte
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate font-medium">{user.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Rôle</dt>
              <dd>{PLATFORM_ROLE_LABELS[user.role]}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Identifiant Clerk</dt>
              <dd className="max-w-[60%] truncate font-mono text-xs">
                {user.clerkId}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Dernière connexion</dt>
              <dd className="text-right">
                {lastSignInAt
                  ? new Date(lastSignInAt).toLocaleString("fr-FR")
                  : "Jamais / indisponible"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">État</dt>
              <dd>{user.disabled ? "Désactivé" : "Actif"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border bg-card p-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="size-4 text-muted-foreground" aria-hidden />
            Boutiques rattachées ({user.tenants.length})
          </h2>
          {user.tenants.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Aucune boutique rattachée à ce compte.
            </p>
          ) : (
            <ul className="mt-4 divide-y">
              {user.tenants.map((link) => (
                <li
                  key={link.tenantId}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/tenants/${link.tenant.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {link.tenant.name}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">
                      /{link.tenant.slug} · rôle boutique :{" "}
                      {PLATFORM_ROLE_LABELS[link.role]}
                    </span>
                  </div>
                  <TenantStatusBadge status={link.tenant.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ScrollText className="size-4 text-muted-foreground" aria-hidden />
            Actions liées ({formatNumber(user.auditTotal)})
          </h2>
          <Link
            href={`/admin/audit-logs?email=${encodeURIComponent(user.email)}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Tout voir dans le journal
          </Link>
        </div>

        {user.auditLogs.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Aucune action enregistrée pour ce compte.
          </p>
        ) : (
          <ul className="mt-4 divide-y">
            {user.auditLogs.map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="flex items-center gap-3">
                  <ActionBadge action={log.action} />
                  <span className="text-xs text-muted-foreground">
                    {log.entity ?? "Système"}
                  </span>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" aria-hidden />
                  {new Date(log.createdAt).toLocaleString("fr-FR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
