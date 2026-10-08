import type { CreateTenantInput, PaymentProvider } from "@/lib/validators/tenant";

/** État local du wizard (couvre les 7 étapes, y compris les champs optionnels). */
export type WizardValues = Omit<
  CreateTenantInput,
  "contactPhone" | "description" | "logoUrl"
> & {
  contactPhone: string;
  description: string;
  logoUrl: string;
  /** true dès que l'utilisateur a édité le slug à la main */
  slugTouched: boolean;
};

/** Résultat de la vérification d'unicité du slug (Server Action). */
export type SlugStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid";

export type ThemeOption = { id: string; name: string; slug: string };

/** Props communes aux 7 composants d'étape. */
export type StepProps = {
  values: WizardValues;
  onChange: (patch: Partial<WizardValues>) => void;
  /** Erreurs Zod aplaties : clé = chemin pointé */
  errors: Record<string, string>;
  /** Étape « Thème » : catalogue des thèmes en base */
  themes?: ThemeOption[];
  /** Étape « Boutique » : état du contrôle d'unicité du slug */
  slugStatus?: SlugStatus;
  /** Étape « Apparence » : upload du logo en cours */
  uploading?: boolean;
};

export type { PaymentProvider };
