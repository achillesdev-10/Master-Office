-- AlterTable — Module 8 : vérification DNS des domaines
ALTER TABLE "TenantDomain" ADD COLUMN     "checkedAt" TIMESTAMP(3),
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);
