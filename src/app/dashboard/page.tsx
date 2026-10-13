import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Store, Package, ShoppingBag, Settings, ArrowRight, Plus, TrendingUp } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { requireTenantAccess, getCurrentUser } from "@/lib/auth/permissions";
import { getTenantById } from "@/lib/db/queries/tenants";
import { getStorefrontProducts } from "@/lib/db/queries/storefront/products";
import { getOrdersByTenant } from "@/lib/db/queries/tenant-detail";
import { getTenantMembers } from "@/lib/db/queries/tenant-detail";

async function getDashboardData(tenantId: string) {
  const [tenant, products, orders] = await Promise.all([
    getTenantById(tenantId),
    getStorefrontProducts(tenantId, { pageSize: 5, sort: "newest" }),
    getOrdersByTenant(tenantId, { pageSize: 5 }),
  ]);

  return { tenant, products: products.items, orders: orders.items };
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    return null;
  }

  // Récupère les memberships de l'utilisateur
  const memberships = await getTenantMembers(user.id);
  
  if (memberships.length === 0) {
    return null;
  }

  // Pour l'instant, on prend le premier tenant (ADMIN ou MEMBER)
  // Dans une vraie app, on aurait un sélecteur dans le shell
  const primaryMembership = memberships.find((m) => m.role === "ADMIN") || memberships[0];
  if (!primaryMembership) {
    return null;
  }
  const tenantId = primaryMembership.tenantId;

  await requireTenantAccess(tenantId);
  const data = await getDashboardData(tenantId);

  if (!data.tenant) {
    return null;
  }

  const currentTenant = memberships.find((m) => m.tenantId === tenantId);

  const stats = [
    {
      label: "Produits",
      value: formatNumber(data.products.length),
      icon: Package,
      href: "/dashboard/products",
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      label: "Commandes (30j)",
      value: formatNumber(data.orders.length),
      icon: ShoppingBag,
      href: "/dashboard/orders",
      color: "text-green-600",
      bg: "bg-green-100",
    },
    {
      label: "Boutique en ligne",
      value: data.tenant.status === "ACTIVE" ? "Active" : "Inactive",
      icon: Store,
      href: `/store/${data.tenant.slug}`,
      color: data.tenant.status === "ACTIVE" ? "text-emerald-600" : "text-amber-600",
      bg: data.tenant.status === "ACTIVE" ? "bg-emerald-100" : "bg-amber-100",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Tableau de bord — {data.tenant.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Bienvenue, Administrateur · {data.tenant.slug}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Link href="/dashboard/products">
              <Plus className="size-4" aria-hidden />
              Ajouter un produit
            </Link>
          </Button>
          <Button variant="default">
            <Link href={`/store/${data.tenant.slug}`} target="_blank">
              <ArrowRight className="size-4" aria-hidden />
              Voir la boutique
            </Link>
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <div className={cn("p-3 rounded-lg", stat.bg)}>
                <stat.icon className={cn("size-6", stat.color)} aria-hidden />
              </div>
            </div>
            <Link
              href={stat.href}
              className="absolute inset-0"
              aria-label={`Voir ${stat.label}`}
            />
          </Card>
        ))}
      </div>

      {/* Actions rapides */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/dashboard/products"
          className="group relative rounded-xl border bg-card p-6 hover:border-primary/50 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <Package className="size-8 text-blue-600" aria-hidden />
            <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden />
          </div>
          <h3 className="text-lg font-semibold">Produits</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérer votre catalogue
          </p>
        </Link>

        <Link
          href="/dashboard/categories"
          className="group relative rounded-xl border bg-card p-6 hover:border-primary/50 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <ShoppingBag className="size-8 text-green-600" aria-hidden />
            <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden />
          </div>
          <h3 className="text-lg font-semibold">Catégories</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Organiser vos produits
          </p>
        </Link>

        <Link
          href="/dashboard/orders"
          className="group relative rounded-xl border bg-card p-6 hover:border-primary/50 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <ShoppingBag className="size-8 text-purple-600" aria-hidden />
            <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden />
          </div>
          <h3 className="text-lg font-semibold">Commandes</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Suivre les ventes
          </p>
        </Link>

        <Link
          href="/dashboard/settings"
          className="group relative rounded-xl border bg-card p-6 hover:border-primary/50 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <Settings className="size-8 text-amber-600" aria-hidden />
            <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden />
          </div>
          <h3 className="text-lg font-semibold">Paramètres</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Configurer votre boutique
          </p>
        </Link>
      </div>

      {/* Produits récents */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Produits récents</h2>
          <Link href="/dashboard/products" className="text-sm text-primary hover:underline">
            Voir tout →
          </Link>
        </div>
        <div className="rounded-lg border bg-card">
          {data.products.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="size-12 text-muted-foreground mx-auto mb-4" aria-hidden />
              <h3 className="text-lg font-medium">Aucun produit pour le moment</h3>
              <p className="text-sm text-muted-foreground mt-1">Ajoutez votre premier produit pour commencer à vendre.</p>
              <Link href="/dashboard/products" className="mt-4 inline-flex items-center gap-2">
                <Button>
                  <Plus className="size-4" aria-hidden />
                  Ajouter un produit
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Produit</th>
                    <th className="px-4 py-3 font-medium">Prix</th>
                    <th className="px-4 py-3 font-medium">Stock</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.slice(0, 5).map((product) => (
                    <tr key={product.id} className="border-b last:border-b-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/products/${product.id}`} className="font-medium hover:underline">
                          {product.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{formatNumber(product.basePrice)} FCFA</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const variants = product.variants;
                          if (!variants) return <span className="text-destructive">Rupture</span>;
                          const hasStock = variants.some((v: { quantity?: number }) => (v.quantity ?? 0) > 0);
                          return hasStock ? (
                            <span className="text-emerald-600">En stock</span>
                          ) : (
                            <span className="text-destructive">Rupture</span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          product.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {product.isActive ? "Actif" : "Inactif"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/dashboard/products/${product.id}`}
                          className="text-primary hover:underline"
                        >
                          Modifier
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Commandes récentes */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Commandes récentes</h2>
          <Link href="/dashboard/orders" className="text-sm text-primary hover:underline">
            Voir tout →
          </Link>
        </div>
        <div className="rounded-lg border bg-card">
          {data.orders.length === 0 ? (
            <div className="p-8 text-center">
              <ShoppingBag className="size-12 text-muted-foreground mx-auto mb-4" aria-hidden />
              <h3 className="text-lg font-medium">Aucune commande pour le moment</h3>
              <p className="text-sm text-muted-foreground mt-1">Les commandes apparaîtront ici dès que des clients achèteront.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Commande</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.slice(0, 5).map((order) => (
                    <tr key={order.id} className="border-b last:border-b-0 hover:bg-muted/50">
                      <td className="px-4 py-3 font-mono font-medium">#{order.id.slice(-8).toUpperCase()}</td>
                      <td className="px-4 py-3">{order.customerName}</td>
                      <td className="px-4 py-3 font-medium">{formatNumber(order.total)} FCFA</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          order.status === "NEW" ? "bg-blue-100 text-blue-700" :
                          order.status === "CONFIRMED" ? "bg-green-100 text-green-700" :
                          order.status === "CANCELLED" ? "bg-destructive/10 text-destructive" :
                          "bg-amber-100 text-amber-700"
                        )}>
                          {order.status === "NEW" ? "Nouvelle" :
                           order.status === "CONFIRMED" ? "Confirmée" :
                           order.status === "CANCELLED" ? "Annulée" :
                           "En cours"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/dashboard/orders/${order.id}`} className="text-primary hover:underline">
                          Voir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}