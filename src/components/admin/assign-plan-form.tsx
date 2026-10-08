"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { assignSubscription } from "@/lib/actions/subscriptions";
import type { PlanOption } from "@/lib/db/queries/tenants";
import { Field } from "@/components/admin/tenant-form/field";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Attribution d’un abonnement à une boutique sans plan
 * (module 10) — crée ou met à jour l’abonnement.
 */
export function AssignPlanForm({
  tenants,
  plans,
}: {
  tenants: { id: string; name: string; slug: string }[];
  plans: PlanOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");

  if (tenants.length === 0) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    startTransition(async () => {
      const result = await assignSubscription({ tenantId, planId });
      if (result.success) {
        toast.success(result.message ?? "Abonnement attribué.");
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error ?? "L'attribution a échoué.");
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-lg border border-dashed p-4 sm:grid-cols-[1fr_11rem_auto] sm:items-end"
      noValidate
    >
      <Field
        label="Boutique sans abonnement"
        htmlFor="assign-tenant"
        error={errors.tenantId}
      >
        <Select
          id="assign-tenant"
          value={tenantId}
          onChange={(event) => setTenantId(event.target.value)}
        >
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name} (/{tenant.slug})
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Plan" htmlFor="assign-plan" error={errors.planId}>
        <Select
          id="assign-plan"
          value={planId}
          onChange={(event) => setPlanId(event.target.value)}
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </Select>
      </Field>

      <Button
        type="submit"
        disabled={pending || !tenantId || !planId}
        className="h-9"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Plus className="size-4" aria-hidden />
        )}
        Attribuer
      </Button>
    </form>
  );
}
