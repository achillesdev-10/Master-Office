import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma Client.
 *
 * En dev, Next.js hot-reload ré-exécute les modules : sans ce cache global,
 * on créerait un nouveau Client à chaque rechargement et on épuiserait
 * les connexions du pool PostgreSQL.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
