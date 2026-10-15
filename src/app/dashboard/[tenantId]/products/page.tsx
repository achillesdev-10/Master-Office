import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Search, Filter, ChevronLeft, ChevronRight, Edit, Trash2, Eye, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { requireTenantAccess } from "@/lib/auth/permissions";
import { getStorefrontProducts } from "@/lib/db/queries/storefront/products";
import { getCategories } from "@/lib/db/queries/storefront/products";
import { deleteProduct, toggleProductActive } from "@/lib/actions/storefront/products";

interface ProductFilters {
  page: number;
  pageSize: number;
  search?: string;
  isActive?: boolean;
  categoryId?: string;
}

interface ProductVariant {
  quantity?: number;
}

interface CategoryNode {
  id: string;
  name: string;
  children?: CategoryNode[];
}

async function getProductsData(tenantId: string, page: number, pageSize: number, search: string, statusFilter: string, categoryFilter: string) {
  const filters: ProductFilters = { page, pageSize };
  if (search) filters.search = search;
  if (statusFilter !== "all") {
    filters.isActive = statusFilter === "active";
  }
  if (categoryFilter) {
    filters.categoryId = categoryFilter;
  }
  
  const result = await getStorefrontProducts(tenantId, filters);
  
  return {
    products: result.items,
    total: result.total,
    pageCount: result.pageCount,
  };
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ page?: string; search?: string; status?: string; category?: string }>;
}) {
  const resolvedParams = await params;
  const tenantId = resolvedParams.tenantId;
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page || "1", 10);
  const search = resolvedSearchParams.search || "";
  const statusFilter = resolvedSearchParams.status || "all";
  const categoryFilter = resolvedSearchParams.category || "";
  const pageSize = 10;

  const { products, total, pageCount } = await getProductsData(tenantId, page, pageSize, search, statusFilter, categoryFilter);
  const categories = await getCategories(tenantId);

  interface CategoryNode {
  id: string;
  name: string;
  children?: CategoryNode[];
}

const allCategories: { id: string; name: string }[] = [];
function flattenCategories(cats: CategoryNode[]) {
  for (const cat of cats) {
    allCategories.push({ id: cat.id, name: cat.name });
    if (cat.children?.length) flattenCategories(cat.children);
  }
}
flattenCategories(categories);

  async function handleDelete(productId: string) {
    const result = await deleteProduct({ id: productId, tenantId });
    return result;
  }

  async function handleToggleActive(productId: string, isActive: boolean) {
    const result = await toggleProductActive({ id: productId, tenantId, isActive });
    return result;
  }

  const buildUrl = (params: Record<string, string>) => {
    const urlParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) urlParams.set(key, value);
    });
    return `?${urlParams.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produits</h1>
          <p className="text-sm text-muted-foreground">Gérez votre catalogue de produits ({formatNumber(total)})</p>
        </div>
        <Button>
          <Link href={`/dashboard/${tenantId}/products/new`}>
            <Plus className="size-4" aria-hidden />
            Nouveau produit
          </Link>
        </Button>
      </header>

      {/* Filtres */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => window.location.href = buildUrl({ search: e.target.value, page: "1" })}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => window.location.href = buildUrl({ status: e.target.value, page: "1", search })}
            className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => window.location.href = buildUrl({ category: e.target.value, page: "1", search, status: statusFilter })}
            className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[180px]"
          >
            <option value="">Toutes les catégories</option>
            {allCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <Button variant="outline" className="hidden sm:flex" disabled>
            <Filter className="size-4" aria-hidden />
            Filtres avancés
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {products.length === 0 ? (
          <div className="p-8 text-center">
            <h3 className="text-lg font-medium">Aucun produit trouvé</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Essayez de modifier votre recherche." : "Ajoutez votre premier produit pour commencer."}
            </p>
            {!search && (
              <Link href={`/dashboard/${tenantId}/products/new`} className="mt-4 inline-block">
                <Button>
                  <Plus className="size-4" aria-hidden />
                  Ajouter un produit
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Produit</th>
                    <th className="px-4 py-3 font-medium">Catégorie</th>
                    <th className="px-4 py-3 font-medium">Prix</th>
                    <th className="px-4 py-3 font-medium">Stock</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 font-medium">En vedette</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const totalStock = product.variants.reduce((sum: number, v: ProductVariant) => sum + (v.quantity ?? 0), 0);
                    return (
                      <tr key={product.id} className="border-b last:border-b-0 hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {product.images[0]?.url && (
                              <img src={product.images[0].url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                            )}
                            <div>
                              <Link href={`/dashboard/${tenantId}/products/${product.id}`} className="font-medium hover:underline">
                                {product.name}
                              </Link>
                              <p className="text-xs text-muted-foreground truncate max-w-xs">{product.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {product.category ? (
                            <Badge variant="secondary">{product.category.name}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {formatNumber(product.basePrice)} FCFA
                          {product.compareAtPrice && (
                            <span className="ml-2 text-xs line-through text-muted-foreground">
                              {formatNumber(product.compareAtPrice)} FCFA
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={totalStock > 0 ? "success" : "destructive"}>
                            {totalStock > 0 ? `${totalStock} en stock` : "Rupture"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <form action={async () => {
                            "use server";
                            const result = await handleToggleActive(product.id, !product.isActive);
                            if (!result.success) {
                              // Error handled by form
                            }
                          }}>
                            <Button
                              type="submit"
                              variant={product.isActive ? "secondary" : "outline"}
                              size="sm"
                              className="gap-1"
                            >
                              {product.isActive ? (
                                <>
                                  <Check className="size-3.5" />
                                  Actif
                                </>
                              ) : (
                                <>
                                  <X className="size-3.5" />
                                  Inactif
                                </>
                              )}
                            </Button>
                          </form>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={product.isFeatured ? "default" : "outline"}>
                            {product.isFeatured ? "Oui" : "Non"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/dashboard/${tenantId}/products/${product.id}`} className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors" title="Voir">
                              <Eye className="size-4" />
                            </Link>
                            <Link href={`/dashboard/${tenantId}/products/${product.id}/edit`} className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors" title="Modifier">
                              <Edit className="size-4" />
                            </Link>
                            <form action={async () => {
                              "use server";
                              const result = await handleDelete(product.id);
                              if (!result.success) {
                                // Error handled by form
                              }
                            }}>
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10"
                                title="Supprimer"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Page {page} sur {pageCount} — {total} produit{total > 1 ? "s" : ""}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => window.location.href = buildUrl({ page: String(page - 1), search, status: statusFilter, category: categoryFilter })}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === pageCount}
                    onClick={() => window.location.href = buildUrl({ page: String(page + 1), search, status: statusFilter, category: categoryFilter })}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}