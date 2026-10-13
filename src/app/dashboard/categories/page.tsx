"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  productCount: number;
  createdAt: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Mock data
  const mockCategories: Category[] = [
    {
      id: "1",
      name: "Électronique",
      slug: "electronique",
      description: "Smartphones, ordinateurs, accessoires",
      parentId: null,
      isActive: true,
      productCount: 12,
      createdAt: "2024-01-01",
    },
    {
      id: "2",
      name: "Smartphones",
      slug: "smartphones",
      description: "Téléphones intelligents",
      parentId: "1",
      isActive: true,
      productCount: 8,
      createdAt: "2024-01-02",
    },
    {
      id: "3",
      name: "Vêtements",
      slug: "vetements",
      description: "Mode homme, femme, enfant",
      parentId: null,
      isActive: true,
      productCount: 25,
      createdAt: "2024-01-03",
    },
  ];

  setTimeout(() => {
    setCategories(mockCategories);
    setLoading(false);
  }, 500);

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredCategories.length / pageSize);
  const paginatedCategories = filteredCategories.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Catégories</h1>
          <p className="text-sm text-muted-foreground">Organisez vos produits par catégories</p>
        </div>
        <Button>
          <Link href="/dashboard/categories/new">
            <Plus className="size-4" aria-hidden />
            Nouvelle catégorie
          </Link>
        </Button>
      </header>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Rechercher une catégorie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="p-8 text-center">
            <h3 className="text-lg font-medium">Aucune catégorie</h3>
            <p className="text-sm text-muted-foreground mt-1">Créez votre première catégorie pour organiser vos produits.</p>
            <Link href="/dashboard/categories/new" className="mt-4 inline-block">
              <Button><Plus className="size-4" /> Nouvelle catégorie</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Nom</th>
                    <th className="px-4 py-3 font-medium">Parent</th>
                    <th className="px-4 py-3 font-medium">Produits</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((category) => (
                    <tr key={category.id} className="border-b last:border-b-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/categories/${category.id}`} className="font-medium hover:underline">
                          {category.name}
                        </Link>
                        {category.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs">{category.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {category.parentId ? "Sous-catégorie" : "Catégorie principale"}
                      </td>
                      <td className="px-4 py-3">{category.productCount} produit{category.productCount > 1 ? "s" : ""}</td>
                      <td className="px-4 py-3">
                        <Badge variant={category.isActive ? "success" : "secondary"}>
                          {category.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/dashboard/categories/${category.id}`} className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg" title="Voir">
                            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </Link>
                          <Link href={`/dashboard/categories/${category.id}/edit`} className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg" title="Modifier">
                            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </Link>
                          <button className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg" title="Supprimer">
                            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}