"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { PlanWithUsage } from "@/lib/db/queries/subscriptions";
import { formatPlanPrice } from "@/components/admin/plans-manager";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

/**
 * Carte « Plans » (module 10) : aperçu en lecture seule du catalogue,
 * renvoyant vers `/admin/plans` pour le CRUD complet.
 */
export function PlansCard({ plans }: { plans: PlanWithUsage[] }) {
  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Plans</h2>
          <p className="text-sm text-muted-foreground">
            Tarifs et features du catalogue — édition sur la page dédiée.
          </p>
        </div>
        <Link
          href="/admin/plans"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Gérer les plans
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aucun plan pour le moment.
        </div>
      ) : (
        <ul className="divide-y">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{plan.name}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  /{plan.slug}
                  {plan.features.length > 0 &&
                    ` · ${plan.features.length} feature(s)`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">
                  {formatPlanPrice(plan)}
                  <span className="font-normal text-muted-foreground">
                    /mois
                  </span>
                </span>
                <Badge variant={plan.tenantCount > 0 ? "success" : "secondary"}>
                  {plan.tenantCount} boutique{plan.tenantCount > 1 ? "s" : ""}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
