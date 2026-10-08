import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPlansWithUsage } from "@/lib/db/queries/subscriptions";
import { PlansManager } from "@/components/admin/plans-manager";

/**
 * `/admin/plans` — catalogue des plans d’abonnement (module 10) :
 * CRUD complet (nom, slug, prix, devise, features JSON).
 */

export const metadata = { title: "Plans" };

export default async function PlansPage() {
  const plans = await getPlansWithUsage();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/admin/subscriptions"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Abonnements
        </Link>

        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
          <p className="text-sm text-muted-foreground">
            {plans.length} plan{plans.length > 1 ? "s" : ""} proposé
            {plans.length > 1 ? "s" : ""} aux boutiques — tarification en
            euros (ou devise associée) et features.
          </p>
        </header>
      </div>

      <PlansManager plans={plans} />
    </div>
  );
}
