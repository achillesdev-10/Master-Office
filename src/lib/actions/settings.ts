"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { type Prisma, type User } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/permissions";
import { logAction } from "@/lib/audit/log";
import { flattenErrors } from "@/lib/validators/tenant";
import { failure } from "@/lib/actions/types";
import type { ActionResult } from "@/lib/actions/types";
import { encryptSecret, isEncryptionConfigured } from "@/lib/security/crypto";
import {
  isSettingsSection,
  SETTINGS_KEY_PREFIX,
  SETTINGS_SECRET_KEYS,
  SETTINGS_SECTION_LABELS,
  settingsSchemas,
} from "@/lib/validators/settings";

/**
 * Server Actions du module 13 (paramètres de la plateforme).
 *
 * Une seule action : `updateSettings({ section, values })`.
 * Validation Zod par section, chiffrement des secrets (AES-256-GCM),
 * audit journalisé, revalidation de la page.
 */

async function getAdmin(): Promise<User | null> {
  try {
    return await requireSuperAdmin();
  } catch (error) {
    console.error("[settings] accès refusé", error);
    return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function updateSettings(input: unknown): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const { section, values } = isPlainObject(input)
      ? { section: input.section, values: input.values }
      : { section: undefined, values: undefined };

    if (!isSettingsSection(section)) {
      return failure("Section de paramètres inconnue.");
    }

    const parsed = settingsSchemas[section].safeParse(values ?? {});
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }

    const secretKeys = SETTINGS_SECRET_KEYS[section];
    const payload: Record<string, unknown> = {
      ...(parsed.data as Record<string, unknown>),
    };
    const updatedSecrets: string[] = [];

    if (secretKeys.length > 0) {
      const existing = await prisma.platformSetting.findUnique({
        where: { key: `${SETTINGS_KEY_PREFIX}${section}` },
        select: { value: true },
      });
      const existingValue = isPlainObject(existing?.value)
        ? existing.value
        : {};

      for (const key of secretKeys) {
        const incoming = payload[key];
        if (typeof incoming === "string" && incoming.trim() !== "") {
          if (!isEncryptionConfigured()) {
            return failure(
              "ENCRYPTION_KEY absente : impossible de chiffrer un secret, enregistrement refusé.",
            );
          }
          payload[key] = encryptSecret(incoming.trim());
          updatedSecrets.push(key);
        } else {
          // Champ vide = conserver le secret actuellement stocké.
          payload[key] = existingValue[key] ?? null;
        }
      }
    }

    const jsonValue = payload as unknown as Prisma.InputJsonObject;

    await prisma.platformSetting.upsert({
      where: { key: `${SETTINGS_KEY_PREFIX}${section}` },
      update: { value: jsonValue },
      create: { key: `${SETTINGS_KEY_PREFIX}${section}`, value: jsonValue },
    });

    await logAction({
      action: `settings.update.${section}`,
      userId: admin.id,
      entity: "PlatformSetting",
      entityId: section,
      metadata: {
        section,
        fields: Object.keys(parsed.data),
        secretsUpdated: updatedSecrets,
      },
    });

    revalidatePath("/admin/settings");
    revalidateTag("settings");

    return {
      success: true,
      message: `Paramètres « ${SETTINGS_SECTION_LABELS[section]} » enregistrés.`,
    };
  } catch (error) {
    console.error("[settings] mise à jour impossible", error);
    return failure("L'enregistrement des paramètres a échoué.");
  }
}
