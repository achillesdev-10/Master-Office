"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { checkSlugAvailability, createTenant } from "@/lib/actions/tenants";
import {
  createTenantSchema,
  flattenErrors,
  slugOnlySchema,
  slugify,
  tenantStepSchemas,
} from "@/lib/validators/tenant";
import { Button } from "@/components/ui/button";
import { StepClient } from "./steps/step-client";
import { StepStore } from "./steps/step-store";
import { StepConfiguration } from "./steps/step-configuration";
import { StepTheme } from "./steps/step-theme";
import { StepPayments } from "./steps/step-payments";
import { StepShipping } from "./steps/step-shipping";
import { StepAppearance } from "./steps/step-appearance";
import type { SlugStatus, ThemeOption, WizardValues } from "./types";

const STEPS = [
  {
    key: "client",
    label: "Client",
    title: "Informations client",
    description: "Qui possède cette boutique ?",
  },
  {
    key: "store",
    label: "Boutique",
    title: "Identité de la boutique",
    description: "Nom, adresse URL et description.",
  },
  {
    key: "config",
    label: "Configuration",
    title: "Configuration régionale",
    description: "Devise, langue et fuseau horaire.",
  },
  {
    key: "theme",
    label: "Thème",
    title: "Thème de la boutique",
    description: "Habillage visuel appliqué à la vitrine.",
  },
  {
    key: "payments",
    label: "Paiements",
    title: "Moyens de paiement",
    description: "Choisissez les moyens de paiement activés.",
  },
  {
    key: "shipping",
    label: "Livraison",
    title: "Méthodes de livraison",
    description: "Modes de livraison proposés et leurs frais.",
  },
  {
    key: "appearance",
    label: "Apparence",
    title: "Apparence de la marque",
    description: "Logo et couleur primaire.",
  },
] as const;

function buildDefaultValues(themes: ThemeOption[]): WizardValues {
  return {
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    contactCountry: "",
    name: "",
    slug: "",
    slugTouched: false,
    description: "",
    currency: "XOF",
    language: "fr",
    timezone: "Africa/Abidjan",
    themeId: themes[0]?.id ?? "",
    providers: ["orange_money"],
    methods: [{ name: "Livraison standard", price: 5000, enabled: true }],
    logoUrl: "",
    primaryColor: "#4f46e5",
  };
}

function validateStep(
  step: number,
  values: WizardValues,
): Record<string, string> {
  const schema = tenantStepSchemas[step];
  if (!schema) return {};
  const result = schema.safeParse(values);
  return result.success ? {} : flattenErrors(result.error).fieldErrors;
}

function firstFailingStep(values: WizardValues): number {
  for (let index = 0; index < tenantStepSchemas.length; index++) {
    const schema = tenantStepSchemas[index];
    if (!schema) continue;
    if (!schema.safeParse(values).success) return index;
  }
  return 0;
}

/**
 * Wizard de création de boutique (module 6) :
 *  - état local React (aucun rechargement de page) ;
 *  - validation Zod à chaque étape ;
 *  - génération + contrôle d'unicité du slug en temps réel ;
 *  - soumission via Server Action `createTenant` puis redirection.
 */
export function TenantWizard({ themes }: { themes: ThemeOption[] }) {
  const router = useRouter();
  const [values, setValues] = useState<WizardValues>(() =>
    buildDefaultValues(themes),
  );
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [pending, startTransition] = useTransition();

  // Génération automatique du slug depuis le nom (tant qu'il n'est pas
  // édité à la main) + dépendance du formulaire.
  const patch = (updates: Partial<WizardValues>) => {
    setValues((current) => {
      const next: WizardValues = { ...current, ...updates };
      if (updates.name !== undefined && !current.slugTouched) {
        next.slug = slugify(updates.name);
      }
      if (updates.slug !== undefined) {
        next.slugTouched = true;
      }
      return next;
    });
  };

  // Contrôle d'unicité du slug (debounce 400 ms, Server Action).
  useEffect(() => {
    const slug = values.slug;
    if (!slug) {
      setSlugStatus("idle");
      return;
    }
    if (!slugOnlySchema.safeParse(slug).success) {
      setSlugStatus("invalid");
      return;
    }

    let cancelled = false;
    setSlugStatus("checking");
    const timer = setTimeout(async () => {
      const result = await checkSlugAvailability(slug);
      if (cancelled) return;
      if (!result.valid) setSlugStatus("invalid");
      else if (result.available) setSlugStatus("available");
      else setSlugStatus("taken");
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [values.slug]);

  useEffect(() => {
    setErrors({});
  }, [step]);

  const slugBlocking = slugStatus === "taken" || slugStatus === "invalid";

  const goNext = () => {
    const fieldErrors = validateStep(step, values);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    if (step === 1 && slugBlocking) {
      setErrors({ slug: "Choisissez un slug disponible." });
      return;
    }
    setErrors({});
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const goPrevious = () => {
    setErrors({});
    setStep((current) => Math.max(current - 1, 0));
  };

  const submit = () => {
    const parsed = createTenantSchema.safeParse(values);
    if (!parsed.success) {
      const { fieldErrors } = flattenErrors(parsed.error);
      setErrors(fieldErrors);
      setStep(firstFailingStep(values));
      toast.error("Certains champs sont invalides.");
      return;
    }

    startTransition(async () => {
      const result = await createTenant(values);
      if (result.success) {
        toast.success(`Boutique « ${values.name} » créée.`);
        router.push(`/admin/tenants/${result.tenantId}`);
        router.refresh();
      } else {
        toast.error(result.error);
        setErrors({ _form: result.error, ...(result.fieldErrors ?? {}) });
        if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
          setStep(firstFailingStep(values));
        }
      }
    });
  };

  const current = STEPS[step];
  const progress = Math.round(((step + 1) / STEPS.length) * 100);
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Indicateur de progression */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Étape {step + 1} sur {STEPS.length}
          </span>
          <span className="font-medium text-foreground">{current?.label}</span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-label="Progression du formulaire"
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <ol className="flex flex-wrap gap-x-3 gap-y-2">
          {STEPS.map((item, index) => {
            const done = index < step;
            const active = index === step;
            return (
              <li key={item.key} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border text-xs font-medium",
                    done &&
                      "border-transparent bg-primary text-primary-foreground",
                    active &&
                      "border-primary text-primary ring-2 ring-primary/30",
                    !done && !active && "text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" aria-hidden /> : index + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-xs md:inline",
                    active ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Étape courante */}
      <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold tracking-tight">
            {current?.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {current?.description}
          </p>
        </div>

        {errors["_form"] && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400"
          >
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{errors["_form"]}</span>
          </div>
        )}

        <div key={STEPS[step]?.key} className="animate-fade-in">
          {step === 0 && (
            <StepClient values={values} onChange={patch} errors={errors} />
          )}
          {step === 1 && (
            <StepStore
              values={values}
              onChange={patch}
              errors={errors}
              slugStatus={slugStatus}
            />
          )}
          {step === 2 && (
            <StepConfiguration values={values} onChange={patch} errors={errors} />
          )}
          {step === 3 && (
            <StepTheme
              values={values}
              onChange={patch}
              errors={errors}
              themes={themes}
            />
          )}
          {step === 4 && (
            <StepPayments values={values} onChange={patch} errors={errors} />
          )}
          {step === 5 && (
            <StepShipping values={values} onChange={patch} errors={errors} />
          )}
          {step === 6 && (
            <StepAppearance values={values} onChange={patch} errors={errors} />
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={goPrevious}
          disabled={step === 0 || pending}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Précédent
        </Button>

        {isLastStep ? (
          <Button onClick={submit} disabled={pending} className="min-w-44">
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {pending ? "Création…" : "Créer la boutique"}
          </Button>
        ) : (
          <Button onClick={goNext} disabled={pending}>
            Suivant
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
