import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Chiffrement symétrique des secrets (clés API paiement, module 7).
 *
 * AES-256-GCM avec IV aléatoire, format :
 *   v1.<iv base64url>.<tag base64url>.<données base64url>
 *
 * Clé dérivée depuis `ENCRYPTION_KEY` :
 *   - 64 caractères hex → utilisée telle quelle (32 octets) ;
 *   - sinon → SHA-256 de la valeur (passphrase).
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const PREFIX = "v1";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    throw new Error(
      "ENCRYPTION_KEY absente ou trop courte (16 caractères minimum).",
    );
  }
  return /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : createHash("sha256").update(raw).digest();
}

/** Vrai si l'environnement permet de chiffrer (garde-fou des actions). */
export function isEncryptionConfigured(): boolean {
  const raw = process.env.ENCRYPTION_KEY;
  return Boolean(raw && raw.length >= 16);
}

/** Chiffre une clé en clair pour un stockage en base. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

/** Déchiffre un secret (usage serveur uniquement, jamais exposé au client). */
export function decryptSecret(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error("Format de secret invalide.");
  }
  const [, ivRaw = "", tagRaw = "", dataRaw = ""] = parts;

  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** Masque un secret en clair : derniers 4 caractères visibles. */
export function maskSecret(plain: string): string {
  if (!plain) return "";
  if (plain.length <= 4) return "••••";
  return `••••${plain.slice(-4)}`;
}

/**
 * Masque un secret déjà chiffré pour l'affichage (onglet Paiements).
 * Ne renvoie jamais la valeur en clair.
 */
export function maskEncrypted(cipher: string | null): string | null {
  if (!cipher) return null;
  try {
    return maskSecret(decryptSecret(cipher));
  } catch {
    return "••••";
  }
}
