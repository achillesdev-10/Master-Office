"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createPlan, deletePlan, updatePlan } from "@/lib/actions/subscriptions";
import type { PlanWithUsage } from "@/lib/db/queries/subscriptions";
import { slugify } from "@/lib/validators/tenant";
import { Field } from "@/components/admin/tenant-form/field";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const;

/** Prix en centimes → unité monétaire. */
function toUnit(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Unité monétaire → centimes (Zod attend un entier). */
function toCents(value: string): number {
  const parsed = Number.parseFloat(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

export function formatPlanPrice(plan: {
  price: number;
  currency: string;
}): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: plan.currency,
    }).format(plan.price / 100);
  } catch {
    return `${toUnit(plan.price)} ${plan.currency}`;
  }
}

type PlanFormValues = {
  name: string;
  slug: string;
  price: string;
  currency: string;
  features: string;
};

function toFormValues(plan?: PlanWithUsage): PlanFormValues {
  return {
    name: plan?.name ?? "",
    slug: plan?.slug ?? "",
    price: plan ? toUnit(plan.price) : "0.00",
    currency: plan?.currency ?? "EUR",
    features: plan?.features.join("\n") ?? "",
  };
}

function PlanForm({
  initial,
  onCancel,
}: {
  initial?: PlanWithUsage;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState<PlanFormValues>(() =>
    toFormValues(initial),
  );
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));

  const set = (patch: Partial<PlanFormValues>) =>
    setValues((prev) => ({ ...prev, ...patch }));

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    const payload = {
      name: values.name.trim(),
      slug: (values.slug || slugify(values.name)).trim(),
      price: toCents(values.price),
      currency: values.currency,
      features: values.features
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    };

    startTransition(async () => {
      const result = initial
        ? await updatePlan({ id: initial.id, ...payload })
        : await createPlan(payload);

      if (result.success) {
        toast.success(result.message ?? "Plan enregistré.");
        onCancel();
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error ?? "L'enregistrement a échoué.");
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-dashed p-4"
      noValidate
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          {initial ? `Modifier « ${initial.name} »` : "Nouveau plan"}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={pending}
        >
          <X className="size-4" aria-hidden />
          Annuler
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom" htmlFor="plan-name" error={errors.name}>
          <Input
            id="plan-name"
            placeholder="Enterprise"
            value={values.name}
            onChange={(event) => {
              const value = event.target.value;
              set({ name: value });
              if (!slugTouched) set({ slug: slugify(value) });
            }}
            required
          />
        </Field>

        <Field label="Slug" htmlFor="plan-slug" error={errors.slug}>
          <Input
            id="plan-slug"
            placeholder="enterprise"
            className="font-mono"
            value={values.slug}
            onChange={(event) => {
              setSlugTouched(true);
              set({ slug: event.target.value });
            }}
            required
          />
        </Field>

        <Field
          label="Prix mensuel"
          htmlFor="plan-price"
          error={errors.price}
          hint="Ex : 29.99 pour 29,99 €/mois."
        >
          <Input
            id="plan-price"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={values.price}
            onChange={(event) => set({ price: event.target.value })}
            required
          />
        </Field>

        <Field label="Devise" htmlFor="plan-currency" error={errors.currency}>
          <Select
            id="plan-currency"
            value={values.currency}
            onChange={(event) => set({ currency: event.target.value })}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Features (une par ligne)"
        htmlFor="plan-features"
        error={errors.features}
        hint="10 lignes maximum — affichées dans le catalogue."
      >
        <textarea
          id="plan-features"
          className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          value={values.features}
          onChange={(event) => set({ features: event.target.value })}
          placeholder={"1 boutique\nSupport email\nThèmes standards"}
        />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
          {initial ? "Enregistrer" : "Créer le plan"}
        </Button>
      </div>
    </form>
  );
}

/**
 * CRUD complet des plans (module 10 / `/admin/plans`) :
 * nom, slug, prix, devise et features JSON.
 */
export function PlansManager({ plans }: { plans: PlanWithUsage[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<
    { kind: "list" } | { kind: "create" } | { kind: "edit"; id: string }
  >({ kind: "list" });

  const editing =
    view.kind === "edit" ? (plans.find((plan) => plan.id === view.id) ?? null) : null;

  if (view.kind === "create") {
    return <PlanForm onCancel={() => setView({ kind: "list" })} />;
  }

  if (view.kind === "edit" && editing) {
    return (
      <PlanForm initial={editing} onCancel={() => setView({ kind: "list" })} />
    );
  }

  const handleDelete = (plan: PlanWithUsage) => {
    const confirmed = window.confirm(
      `Supprimer le plan « ${plan.name} » ?\n\nImpossible s’il est encore utilisé par une boutique.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deletePlan(plan.id);
      if (result.success) {
        toast.success(result.message ?? "Plan supprimé.");
        router.refresh();
      } else {
        toast.error(result.error ?? "La suppression a échoué.");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setView({ kind: "create" })}>
          <Plus className="size-4" aria-hidden />
          Nouveau plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Aucun plan pour le moment.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="flex flex-col gap-3 rounded-lg border bg-card p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{plan.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    /{plan.slug}
                  </p>
                </div>
                <Badge variant={plan.tenantCount > 0 ? "success" : "secondary"}>
                  {plan.tenantCount} boutique{plan.tenantCount > 1 ? "s" : ""}
                </Badge>
              </div>

              <p className="text-2xl font-semibold tracking-tight">
                {formatPlanPrice(plan)}
                <span className="text-sm font-normal text-muted-foreground">
                  /mois
                </span>
              </p>

              {plan.features.length > 0 ? (
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check
                        className="mt-0.5 size-3.5 shrink-0 text-emerald-600"
                        aria-hidden
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucune feature renseignée.
                </p>
              )}

              <div className="mt-auto flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Modifier le plan ${plan.name}`}
                  disabled={pending}
                  onClick={() => setView({ kind: "edit", id: plan.id })}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Supprimer le plan ${plan.name}`}
                  disabled={pending}
                  onClick={() => handleDelete(plan)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
