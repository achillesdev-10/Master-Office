"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  assignSubscription,
  changeSubscriptionStatus,
} from "@/lib/actions/subscriptions";
import type { SubscriptionListItem } from "@/lib/db/queries/subscriptions";
import type { PlanOption } from "@/lib/db/queries/tenants";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";

const STATUS_BADGES: Record<
  string,
  { label: string; variant: "success" | "warning" | "destructive" | "secondary" }
> = {
  ACTIVE: { label: "Actif", variant: "success" },
  TRIAL: { label: "Essai", variant: "warning" },
  PAST_DUE: { label: "Impayé", variant: "destructive" },
  CANCELLED: { label: "Résilié", variant: "secondary" },
};

export function SubscriptionStatusBadge({ status }: { status: string }) {
  const badge = STATUS_BADGES[status] ?? {
    label: status,
    variant: "secondary" as const,
  };
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}

/**
 * Actions d’une ligne d’abonnement : changement de plan (upsert) et
 * changement de statut (résiliation incluse).
 */
export function SubscriptionRowActions({
  subscription,
  plans,
}: {
  subscription: SubscriptionListItem;
  plans: PlanOption[];
}) {
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
    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
      <Select
        aria-label={`Plan de ${subscription.tenant.name}`}
        className="w-full sm:w-36"
        value={subscription.plan.id}
        disabled={pending}
        onChange={(event) => {
          const planId = event.target.value;
          if (planId === subscription.plan.id) return;
          run(
            () =>
              assignSubscription({
                tenantId: subscription.tenant.id,
                planId,
              }),
            "Plan mis à jour.",
          );
        }}
      >
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.name}
          </option>
        ))}
      </Select>

      <Select
        aria-label={`Statut de l'abonnement de ${subscription.tenant.name}`}
        className="w-full sm:w-36"
        value={subscription.status}
        disabled={pending}
        onChange={(event) => {
          const status = event.target.value;
          if (status === subscription.status) return;
          run(
            () =>
              changeSubscriptionStatus({
                subscriptionId: subscription.id,
                status,
              }),
            "Statut mis à jour.",
          );
        }}
      >
        {(["TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED"] as const).map((value) => (
          <option key={value} value={value}>
            {value === "ACTIVE"
              ? "Actif"
              : value === "TRIAL"
                ? "Essai"
                : value === "PAST_DUE"
                  ? "Impayé"
                  : "Résilié"}
          </option>
        ))}
      </Select>
    </div>
  );
}
