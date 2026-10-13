"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Filter, ChevronLeft, ChevronRight, Edit, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  compareAtPrice: number | null;
  isActive: boolean;
  isFeatured: boolean;
  category?: { name: string } | null;
  variants: { quantity: number }[];
  images: { url: string }[];
  createdAt: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const mockProducts: Product[] = [
    {
      id: "1",
      name: "iPhone 15 Pro",
      slug: "iphone-15-pro",
      basePrice: 899000,
      compareAtPrice: 999000,
      isActive: true,
      isFeatured: true,
      category: { name: "Électronique" },
      variants: [{ quantity: 10 }],
      images: [{ url: "https://via.placeholder.com/150" }],
      createdAt: "2024-01-15",
    },
    {
      id: "2",
      name: "Samsung Galaxy S24",
      slug: "samsung-galaxy-s24",
      basePrice: 799000,
      compareAtPrice: null,
      isActive: true,
      isFeatured: false,
      category: { name: "Électronique" },
      variants: [{ quantity: 5 }],
      images: [{ url: "https://via.placeholder.com/150" }],
      createdAt: "2024-01-10",
    },
    {
      id: "3",
      name: "Nike Air Max",
      slug: "nike-air-max",
      basePrice: 129000,
      compareAtPrice: 149000,
      isActive: false,
      isFeatured: false,
      category: { name: "Chaussures" },
      variants: [{ quantity: 0 }],
      images: [{ url: "https://via.placeholder.com/150" }],
      createdAt: "2024-01-05",
    },
  ];

  setTimeout(() => {
    setProducts(mockProducts);
    setLoading(false);
  }, 500);

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? p.isActive : !p.isActive);
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Tous</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>
          <Button variant="outline" className="hidden sm:flex">
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
                  {paginatedProducts.map((product) => {
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
                              <Edit className="size-4" />
                            </Link>
                            <button className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Supprimer">
                              <Trash2 className="size-4" />
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {page} sur {totalPages} — {filteredProducts.length} produit{filteredProducts.length > 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}