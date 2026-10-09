import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { getTenantById } from "@/lib/db/queries/tenants";
import { buttonVariants } from "@/components/ui/button";
import { TenantStatusBadge } from "@/components/admin/tenant-status-badge";
import { TenantTabs } from "@/components/admin/tenant-detail/tenant-tabs";

/**
 * Fiche boutique (module 7) : en-tête (nom, statut, métadonnées) +
 * navigation en 8 onglets. Le tenant est chargé ici : toute route
 * inconnue renvoie un 404 avant même d'atteindre la page.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await getTenantById(id);
  return { title: tenant ? `${tenant.name} · Boutique` : "Boutique" };
}

export default async function TenantLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const tenant = await getTenantById(id);

  if (!tenant) notFound();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {tenant.name}
            </h1>
            <TenantStatusBadge status={tenant.status} />
          </div>
          <p className="mt-1 break-all text-sm text-muted-foreground">
            <span className="font-mono">/{tenant.slug}</span>
            {" · "}
            Créée le{" "}
            {format(new Date(tenant.createdAt), "d MMMM yyyy", { locale: fr })}
            {tenant.theme ? ` · Thème ${tenant.theme.name}` : ""}
          </p>
        </div>

        <Link
          href="/admin/tenants"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Toutes les boutiques
        </Link>
      </header>

      <TenantTabs id={tenant.id} />

      <div>{children}</div>
    </div>
  );
}
