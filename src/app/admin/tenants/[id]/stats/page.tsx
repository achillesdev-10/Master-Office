import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, CreditCard, Globe, ScrollText, ShieldCheck, Truck, Users } from "lucide-react";
import { getTenantById } from "@/lib/db/queries/tenants";
import { getTenantStats } from "@/lib/db/queries/tenant-detail";
import { formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

/** Onglet « Statistiques » : KPIs simples de la boutique. */

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default async function TenantStatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await getTenantById(id);
  if (!tenant) notFound();

  const stats = await getTenantStats(tenant.id);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Membres"
          icon={Users}
          value={formatNumber(stats.members)}
          hint={`${formatNumber(stats.admins)} administrateur${
            stats.admins > 1 ? "s" : ""
          }`}
        />
        <Kpi
          label="Domaines"
          icon={Globe}
          value={formatNumber(stats.domains)}
          hint={`${formatNumber(stats.verifiedDomains)} vérifié${
            stats.verifiedDomains > 1 ? "s" : ""
          }`}
        />
        <Kpi
          label="Paiements actifs"
          icon={CreditCard}
          value={formatNumber(stats.activePayments)}
          hint="Providers acceptés"
        />
        <Kpi
          label="Livraison active"
          icon={Truck}
          value={formatNumber(stats.shippingMethods)}
          hint="Méthodes proposées"
        />
      </section>

      <section className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Configuration</h2>
            <p className="text-sm text-muted-foreground">
              État des intégrations de la boutique.
            </p>
          </div>
          <Link
            href={`/admin/tenants/${tenant.id}/danger`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Zone de danger
          </Link>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <li className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="size-4" aria-hidden /> Clerk
            </span>
            <Badge variant={stats.clerkConnected ? "success" : "warning"}>
              {stats.clerkConnected ? "Connecté" : "Non connecté"}
            </Badge>
          </li>
          <li className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Boxes className="size-4" aria-hidden /> Thème
            </span>
            <Badge variant={stats.theme ? "info" : "secondary"}>
              {stats.theme ?? "Aucun"}
            </Badge>
          </li>
          <li className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <ScrollText className="size-4" aria-hidden /> Audit (30 j)
            </span>
            <Badge variant="secondary">{formatNumber(stats.auditLogs30d)}</Badge>
          </li>
        </ul>
      </section>
    </div>
  );
}
