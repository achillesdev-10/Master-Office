import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Search, Edit, Trash2, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getCategories } from "@/lib/db/queries/storefront/products";
import { createCategory, updateCategory, deleteCategory } from "@/lib/actions/storefront/categories";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  children: Category[];
  productCount: number;
  isActive: boolean;
}

async function getCategoriesData(tenantId: string) {
  return getCategories(tenantId);
}

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const resolvedParams = await params;
  const tenantId = resolvedParams.tenantId;
  const categories = await getCategoriesData(tenantId);

  const allCategories: { id: string; name: string; parentId: string | null; productCount: number; isActive: boolean }[] = [];
  function flattenCategories(cats: Category[], parentId: string | null = null) {
    for (const cat of cats) {
      allCategories.push({ 
        id: cat.id, 
        name: cat.name, 
        parentId: cat.parentId,
        productCount: cat.productCount,
        isActive: cat.isActive 
      });
      if (cat.children?.length) flattenCategories(cat.children, cat.id);
    }
  }
  flattenCategories(categories);

  async function handleDeleteCategory(id: string) {
    const result = await deleteCategory({ id, tenantId });
    if (result.success) {
      toast.success("Catégorie supprimée");
    } else {
      toast.error(result.error || "Erreur lors de la suppression");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Catégories</h1>
          <p className="text-sm text-muted-foreground">Organisez vos produits par catégories</p>
        </div>
        <Button>
          <Link href={`/dashboard/${tenantId}/categories/new`}>
            <Plus className="size-4" aria-hidden />
            Nouvelle catégorie
          </Link>
        </Button>
      </header>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Rechercher une catégorie..."
            className="pl-10"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {allCategories.length === 0 ? (
          <div className="p-8 text-center">
            <h3 className="text-lg font-medium">Aucune catégorie</h3>
            <p className="text-sm text-muted-foreground mt-1">Créez votre première catégorie pour organiser vos produits.</p>
            <Button className="mt-4">
              <Link href={`/dashboard/${tenantId}/categories/new`}>
                <Plus className="size-4" aria-hidden />
                Nouvelle catégorie
              </Link>
            </Button>
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
                  {allCategories.map((category) => (
                    <tr key={category.id} className="border-b last:border-b-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/${tenantId}/categories/${category.id}`} className="font-medium hover:underline">
                          {category.name}
                        </Link>
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
                          <Link href={`/dashboard/${tenantId}/categories/${category.id}`} className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg" title="Voir">
                            <Eye className="size-4" />
                          </Link>
                          <Link href={`/dashboard/${tenantId}/categories/${category.id}/edit`} className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg" title="Modifier">
                            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </Link>
                          <form action={async () => {
                            "use server";
                            await handleDeleteCategory(category.id);
                          }}>
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10"
                              title="Supprimer"
                              disabled={category.productCount > 0}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </form>
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