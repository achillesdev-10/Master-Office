-- Modules 9 → 15 — rétrofits de schéma
--   Plan      : prix / devise / features JSON (module 10)
--   Tenant    : champs Stripe prêts pour Stripe Billing (module 10)
--   Theme     : isPremium + category (module 11)
--   User      : désactivation de compte (module 9)
--   AuditLog  : entity / entityId / ip (module 12)
--   PlatformSetting : réglages clé/valeur (module 13)

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN "price" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Plan" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "Plan" ADD COLUMN "features" JSONB;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "stripeSubscriptionId" TEXT;

-- CreateIndex
CREATE INDEX "Tenant_stripeCustomerId_idx" ON "Tenant"("stripeCustomerId");

-- AlterTable
ALTER TABLE "Theme" ADD COLUMN "isPremium" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Theme" ADD COLUMN "category" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "disabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "entity" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "entityId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "ip" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSetting_key_key" ON "PlatformSetting"("key");
