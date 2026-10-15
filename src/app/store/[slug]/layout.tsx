import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { resolveTenant } from "@/lib/tenant/resolve";
import { CartProvider } from "@/components/storefront/cart-context";
import { CartIcon } from "@/components/storefront/cart-icon";
import { StoreProvider } from "@/components/storefront/store-context";

/**
 * Layout de la boutique marchande (module 14) — rendue sur
 * `{slug}.{rootDomain}/**` après réécriture du middleware.
 *
 * - slug inconnu / archivé → 404 (`notFound()`)
 * - statut non ACTIVE (DRAFT, SUSPENDED, ARCHIVED, PAUSED) → page `/suspended`
 */

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) return { title: "Boutique introuvable" };

  return {
    title: tenant.name,
    description: tenant.description ?? undefined,
  };
}

export default async function StoreLayout({
  params,
  children,
}: {
  params: Params;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);

  if (!tenant) notFound();
  if (tenant.status !== "ACTIVE") {
    redirect(`/suspended?shop=${encodeURIComponent(tenant.slug)}&status=${encodeURIComponent(tenant.status)}`);
  }

  // Détecte si on est sur un hôte de boutique via le header x-tenant-slug
  // posé par le middleware lors de la réécriture
  const headersList = await headers();
  const tenantSlugHeader = headersList.get("x-tenant-slug");
  const isStoreHost = tenantSlugHeader === slug;
  const basePath = isStoreHost ? "" : `/store/${slug}`;

  return (
    <StoreProvider slug={slug} basePath={basePath}>
      <CartProvider slug={slug}>
        <div
          className="flex min-h-screen flex-col bg-background text-foreground"
          style={
            {
              "--store-primary": tenant.primaryColor ?? "#111827",
            } as React.CSSProperties
          }
        >
          <header className="border-b">
            <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
              {tenant.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tenant.logoUrl}
                  alt=""
                  className="size-8 rounded-md object-contain"
                />
              ) : (
                <span
                  aria-hidden
                  className="size-8 rounded-md"
                  style={{ background: "var(--store-primary)" }}
                />
              )}
              <span className="truncate font-semibold">{tenant.name}</span>
              <CartIcon />
            </div>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="border-t py-6 text-center text-xs text-muted-foreground">
            Propulsé par {tenant.rootDomain}
          </footer>
        </div>
      </CartProvider>
    </StoreProvider>
  );
}
