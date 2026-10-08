import prisma from "@/lib/db/prisma";
import {
  SETTINGS_DEFAULTS,
  SETTINGS_KEY_PREFIX,
  SETTINGS_SECRET_KEYS,
  SETTINGS_SECTIONS,
  settingsSchemas,
  type EmailSettings,
  type GeneralSettings,
  type IntegrationSettings,
  type PaymentSettings,
  type SecuritySettings,
  type SettingsSection,
} from "@/lib/validators/settings";

/**
 * Lecture des paramètres de la plateforme (module 13).
 *
 * Chaque section est stockée dans `PlatformSetting` sous la clé
 * `settings.<section>` (JSON). Les secrets sont chiffrés (format `v1.`) :
 * ils ne sont jamais renvoyés au client, seulement leur état
 * « configuré / non configuré ».
 */

export type SettingsSecretsSet = Record<SettingsSection, Record<string, boolean>>;

export type SettingsSnapshot = {
  general: GeneralSettings;
  emails: EmailSettings;
  payments: PaymentSettings;
  integrations: IntegrationSettings;
  security: SecuritySettings;
  secretsSet: SettingsSecretsSet;
};

/** Une valeur stockée est chiffrée si elle suit le format `v1.iv.tag.data`. */
function isEncryptedValue(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("v1.") &&
    value.split(".").length === 4
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Fusion des valeurs stockées sur les défauts, puis validation Zod. */
function mergeSection(section: SettingsSection, stored: unknown): unknown {
  const schema = settingsSchemas[section];
  const defaults = SETTINGS_DEFAULTS[section] as Record<string, unknown>;
  const raw = isPlainObject(stored) ? stored : {};
  const parsed = schema.safeParse({ ...defaults, ...raw });
  return parsed.success ? parsed.data : schema.parse(defaults);
}

export async function getSettings(): Promise<SettingsSnapshot> {
  const rows = await prisma.platformSetting.findMany({
    where: { key: { startsWith: SETTINGS_KEY_PREFIX } },
    select: { key: true, value: true },
  });
  const storedByKey = new Map(rows.map((row) => [row.key, row.value]));

  const secretsSet: SettingsSecretsSet = {
    general: {},
    emails: {},
    payments: {},
    integrations: {},
    security: {},
  };
  const out = {} as SettingsSnapshot;

  for (const section of SETTINGS_SECTIONS) {
    const values = mergeSection(
      section,
      storedByKey.get(`${SETTINGS_KEY_PREFIX}${section}`),
    ) as unknown as Record<string, unknown>;

    // Les secrets sont remplacés par "" : seul l'état est exposé.
    for (const key of SETTINGS_SECRET_KEYS[section]) {
      const current = values[key];
      secretsSet[section][key] =
        typeof current === "string" && current !== "";
      values[key] = "";
    }

    Object.assign(out, { [section]: values });
  }

  return { ...out, secretsSet };
}

/**
 * Secret déchiffré pour usage serveur uniquement (ex. client Redis du
 * module 14). Renvoie `null` si absent, non chiffré ou indéchiffrable.
 */
export async function getDecryptedSecret(
  section: SettingsSection,
  key: string,
): Promise<string | null> {
  if (!(SETTINGS_SECRET_KEYS[section] as readonly string[]).includes(key)) {
    return null;
  }

  const row = await prisma.platformSetting.findUnique({
    where: { key: `${SETTINGS_KEY_PREFIX}${section}` },
    select: { value: true },
  });
  const value = isPlainObject(row?.value) ? row.value[key] : undefined;
  if (!isEncryptedValue(value)) return null;

  const { decryptSecret } = await import("@/lib/security/crypto");
  try {
    return decryptSecret(value);
  } catch {
    return null;
  }
}
