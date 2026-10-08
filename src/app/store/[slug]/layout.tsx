import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { resolveTenant } from "@/lib/tenant/resolve";

/**
 * Layout de la boutique marchande (module 14) — rendue sur
 * `{slug}.{rootDomain}/**` après réécriture du middleware.
 *
 * - slug inconnu / archivé → 404 (`notFound()`)
 * - statut non ACTIVE (DRAFT, SUSPENDED, ARCHIVED) → page `/suspended`
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
    redirect(`/suspended?shop=${encodeURIComponent(tenant.slug)}`);
  }

  return (
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
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Propulsé par {tenant.rootDomain}
      </footer>
    </div>
  );
}
