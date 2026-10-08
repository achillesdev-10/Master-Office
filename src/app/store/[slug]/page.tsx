import { notFound } from "next/navigation";
import { PackageOpen } from "lucide-react";
import prisma from "@/lib/db/prisma";
import { resolveTenant } from "@/lib/tenant/resolve";

/**
 * Vitrine de la boutique (module 14) — placeholder volontaire :
 * le front marchand complet (catalogue, panier, checkout) sera branché
 * sur ce segment dans une itération ultérieure.
 */

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  const theme = tenant.themeId
    ? await prisma.theme.findUnique({
        where: { id: tenant.themeId },
        select: { name: true, isPremium: true },
      })
    : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-24">
      <section className="mx-auto max-w-2xl text-center">
        <span
          aria-hidden
          className="mx-auto mb-6 block h-1 w-16 rounded-full"
          style={{ background: "var(--store-primary)" }}
        />
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {tenant.name}
        </h1>
        {tenant.description && (
          <p className="mt-4 text-muted-foreground">{tenant.description}</p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="rounded-full border px-3 py-1">
            Devise&nbsp;: {tenant.currency}
          </span>
          <span className="rounded-full border px-3 py-1">
            Langue&nbsp;: {tenant.language.toUpperCase()}
          </span>
          {theme && (
            <span className="rounded-full border px-3 py-1">
              Thème&nbsp;: {theme.name}
              {theme.isPremium ? " (Premium)" : ""}
            </span>
          )}
        </div>
      </section>

      <section className="mx-auto mt-14 flex max-w-2xl flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
        <div className="rounded-full bg-muted p-4">
          <PackageOpen aria-hidden className="size-6 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Catalogue en préparation</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            La vitrine marchande (catalogue, panier, paiement) sera activée
            prochainement sur ce sous-domaine.
          </p>
        </div>
      </section>
    </div>
  );
}
