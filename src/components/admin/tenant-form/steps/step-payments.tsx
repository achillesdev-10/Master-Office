import { CreditCard, Smartphone, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER_LABELS,
  type PaymentProvider,
} from "@/lib/validators/tenant";
import { Field } from "../field";
import type { StepProps } from "../types";

/** Étape 5 — Paiements : moyens de paiement activés. */
export function StepPayments({ values, onChange, errors }: StepProps) {
  const toggle = (provider: PaymentProvider) => {
    const next = values.providers.includes(provider)
      ? values.providers.filter((item) => item !== provider)
      : [...values.providers, provider];
    onChange({ providers: next });
  };

  const getIcon = (provider: PaymentProvider) => {
    switch (provider) {
      case "orange_money":
      case "mtn_money":
      case "moov_money":
      case "wave":
        return <Smartphone aria-hidden className="size-3.5" />;
      case "cod":
        return <Banknote aria-hidden className="size-3.5" />;
      case "bank_transfer":
        return <CreditCard aria-hidden className="size-3.5" />;
      default:
        return <CreditCard aria-hidden className="size-3.5" />;
    }
  };

  const getDescription = (provider: PaymentProvider) => {
    switch (provider) {
      case "orange_money":
        return "Orange Money (CI)";
      case "mtn_money":
        return "MTN Mobile Money (CI)";
      case "moov_money":
        return "Moov Money (CI)";
      case "wave":
        return "Wave (CI)";
      case "cod":
        return "Paiement en espèces à la livraison";
      case "bank_transfer":
        return "Virement bancaire (vérification manuelle)";
      default:
        return "Paiement en ligne";
    }
  };

  return (
    <Field
      label="Moyens de paiement activés"
      htmlFor="provider-orange_money"
      error={errors.providers}
      hint="Les clés API seront configurables ensuite (onglet Paiements)."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {PAYMENT_PROVIDERS.map((provider) => {
          const checked = values.providers.includes(provider);
          return (
            <label
              key={provider}
              htmlFor={`provider-${provider}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:border-primary/50",
                checked && "border-primary bg-primary/5 ring-2 ring-primary/30",
              )}
            >
              <input
                id={`provider-${provider}`}
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={checked}
                onChange={() => toggle(provider)}
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {getIcon(provider)}
                  {PAYMENT_PROVIDER_LABELS[provider]}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {getDescription(provider)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </Field>
  );
}