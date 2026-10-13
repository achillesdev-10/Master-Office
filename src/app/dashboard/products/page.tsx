"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Filter, ChevronLeft, ChevronRight, Edit, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { getStorefrontProducts } from "@/lib/db/queries/storefront/products";
import { requireTenantAccess, getCurrentUser } from "@/lib/auth/permissions";
import { getTenantMembers } from "@/lib/db/queries/tenant-detail";

async function getProductsData(tenantId: string, page: number, pageSize: number, search: string, statusFilter: string) {
  const result = await getStorefrontProducts(tenantId, {
    page,
    pageSize,
    search: search || undefined,
  });
  
  return {
    products: result.items,
    total: result.total,
    pageCount: result.pageCount,
  };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}) {
  const user = await getCurrentUser();
  
  if (!user) {
    return null;
  }

  const memberships = await getTenantMembers(user.id);
  const primaryMembership = memberships.find((m) => m.role === "ADMIN") || memberships[0];
  if (!primaryMembership) {
    return null;
  }
  const tenantId = primaryMembership.tenantId;

  await requireTenantAccess(tenantId);

  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page || "1", 10);
  const search = resolvedSearchParams.search || "";
  const statusFilter = resolvedSearchParams.status || "all";
  const pageSize = 10;

  const { products, total, pageCount } = await getProductsData(tenantId, page, pageSize, search, statusFilter);
  
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? p.isActive : !p.isActive);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produits</h1>
          <p className="text-sm text-muted-foreground">Gérez votre catalogue de produits</p>
        </div>
        <Button>
          <Link href="/dashboard/products/new">
            <Plus className="size-4" aria-hidden />
            Nouveau produit
          </Link>
        </Button>
      </header>

      {/* Filtres */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Input
            placeholder="Rechercher un produit..."
            defaultValue={search}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <select
            defaultValue={statusFilter}
            className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Tous</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>
          <Button variant="outline" className="hidden sm:flex">
            <Filter className="size-4" aria-hidden />
            Filtres
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {filteredProducts.length === 0 ? (
          <div className="p-8 text-center">
            <h3 className="text-lg font-medium">Aucun produit trouvé</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Essayez de modifier votre recherche." : "Ajoutez votre premier produit pour commencer."}
            </p>
            {!search && (
              <Link href="/dashboard/products/new" className="mt-4 inline-block">
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
                  {filteredProducts.map((product) => {
                    const totalStock = product.variants.reduce((sum, v) => sum + v.quantity, 0);
                    return (
                      <tr key={product.id} className="border-b last:border-b-0 hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {product.images[0]?.url && (
                              <img src={product.images[0].url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                            )}
                            <div>
                              <Link href={`/dashboard/products/${product.id}`} className="font-medium hover:underline">
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
                          <Badge variant={product.isActive ? "success" : "secondary"}>
                            {product.isActive ? "Actif" : "Inactif"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={product.isFeatured ? "default" : "outline"}>
                            {product.isFeatured ? "Oui" : "Non"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/dashboard/products/${product.id}`} className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors" title="Voir">
                              <Eye className="size-4" />
                            </Link>
                            <Link href={`/dashboard/products/${product.id}/edit`} className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors" title="Modifier">
                              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </Link>
                            <button className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Supprimer">
                              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {page} sur {pageCount} — {filteredProducts.length} produit{filteredProducts.length > 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => window.location.href = `?page=${page - 1}&search=${encodeURIComponent(search)}&status=${statusFilter}`}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page === pageCount} onClick={() => window.location.href = `?page=${page + 1}&search=${encodeURIComponent(search)}&status=${statusFilter}`}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}