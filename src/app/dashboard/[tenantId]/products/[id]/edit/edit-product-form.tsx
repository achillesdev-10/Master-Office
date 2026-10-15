"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Upload, Plus, Trash2, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { updateProduct, uploadProductImage, deleteProductImage } from "@/lib/actions/storefront/products";

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  children: Category[];
}

interface ProductVariantAttrs {
  [key: string]: unknown;
}

interface ProductVariant {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  attributes: ProductVariantAttrs;
  inventory: { quantity: number } | null;
}

interface ProductImage {
  id: string;
  url: string;
  altText: string | null;
  position: number;
  isPrimary: boolean;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  sku: string | null;
  categoryId: string | null;
  isActive: boolean;
  isFeatured: boolean;
  requiresShipping: boolean;
  trackInventory: boolean;
  images: ProductImage[];
  variants: ProductVariant[];
}

interface ProductForm {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  basePrice: number;
  compareAtPrice: number;
  sku: string;
  categoryId: string;
  isActive: boolean;
  isFeatured: boolean;
  requiresShipping: boolean;
  trackInventory: boolean;
  images: string[];
  imageIds: string[];
  variants: { id?: string; name: string; price: number; quantity: number; sku: string }[];
}

interface EditProductFormProps {
  tenantId: string;
  product: Product;
  categories: Category[];
}

function flattenCategories(cats: Category[], prefix = ""): { id: string; name: string }[] {
  let result: { id: string; name: string }[] = [];
  for (const cat of cats) {
    result.push({ id: cat.id, name: `${prefix}${cat.name}` });
    if (cat.children?.length) {
      result = result.concat(flattenCategories(cat.children, `${prefix}${cat.name} / `));
    }
  }
  return result;
}

export default function EditProductForm({ tenantId, product, categories }: EditProductFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingImages, setDeletingImages] = useState<Set<string>>(new Set());

  const allCategories = flattenCategories(categories);

  const [form, setForm] = useState<ProductForm>({
    name: product.name,
    slug: product.slug,
    description: product.description || "",
    shortDescription: product.shortDescription || "",
    basePrice: product.basePrice,
    compareAtPrice: product.compareAtPrice || 0,
    sku: product.sku || "",
    categoryId: product.categoryId || "",
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    requiresShipping: product.requiresShipping,
    trackInventory: product.trackInventory,
    images: product.images.map(img => img.url),
    imageIds: product.images.map(img => img.id),
    variants: product.variants.map(v => ({
      id: v.id,
      name: v.name,
      price: v.price,
      quantity: v.inventory?.quantity || 0,
      sku: v.sku || "",
    })),
  });

  const [slugTouched, setSlugTouched] = useState(false);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name}: Seules les images sont acceptées`);
          continue;
        }
        if (file.size > 2 * 1024 * 1024) {
          toast.error(`${file.name}: Image trop lourde (2 Mo maximum)`);
          continue;
        }
        if (form.images.length >= 5) {
          toast.error("Maximum 5 images par produit");
          break;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const preview = e.target?.result as string;
          setForm((prev) => ({ ...prev, images: [...prev.images, preview] }));
        };
        reader.readAsDataURL(file);

        const formData = new FormData();
        formData.append("tenantId", tenantId);
        formData.append("productId", product.id);
        formData.append("file", file);

        const result = await uploadProductImage(formData);
        if (result.success && result.url) {
          setForm((prev) => ({ ...prev, images: [...prev.images, result.url!] }));
        } else {
          const errorMessage = (result as { error?: string }).error ?? `Erreur lors de l'upload de ${file.name}`;
          toast.error(errorMessage);
        }
      }
    } catch {
      toast.error("Erreur lors de l'upload des images");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeImage = async (index: number) => {
    const imageId = form.imageIds[index];
    if (!imageId) {
      setForm((prev) => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== index),
        imageIds: prev.imageIds.filter((_, i) => i !== index),
      }));
      return;
    }

    setDeletingImages((prev) => new Set(prev).add(imageId));
    try {
      const result = await deleteProductImage({ tenantId, productId: product.id, imageId });
      if (result.success) {
        setForm((prev) => ({
          ...prev,
          images: prev.images.filter((_, i) => i !== index),
          imageIds: prev.imageIds.filter((_, i) => i !== index),
        }));
        toast.success("Image supprimée");
      } else {
        toast.error(result.error || "Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur lors de la suppression de l'image");
    } finally {
      setDeletingImages((prev) => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
    }
  };

  const addVariant = () => {
    setForm((prev) => ({
      ...prev,
      variants: [...prev.variants, { name: "Nouvelle variante", price: 0, quantity: 1, sku: "" }],
    }));
  };

  const removeVariant = (index: number) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  const updateVariant = (index: number, field: string, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    }));
  };

  const handleSave = async () => {
    if (!form.name || !form.slug || form.basePrice <= 0) {
      toast.error("Veuillez remplir les champs obligatoires (nom, slug, prix)");
      return;
    }

    if (form.variants.some(v => !v.name || v.price < 0 || v.quantity < 0)) {
      toast.error("Veuillez remplir correctement toutes les variantes");
      return;
    }

    setSaving(true);
    try {
      const result = await updateProduct({
        id: product.id,
        tenantId,
        name: form.name,
        slug: form.slug,
        description: form.description,
        shortDescription: form.shortDescription,
        basePrice: form.basePrice,
        compareAtPrice: form.compareAtPrice || null,
        sku: form.sku || null,
        categoryId: form.categoryId || null,
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        requiresShipping: form.requiresShipping,
        trackInventory: form.trackInventory,
        images: form.images,
        variants: form.variants.map(v => ({
          id: v.id,
          name: v.name,
          price: v.price,
          quantity: v.quantity,
          sku: v.sku || null,
          attributes: {},
        })),
      });

      if (result.success) {
        toast.success("Produit mis à jour avec succès");
        router.push(`/dashboard/${tenantId}/products`);
      } else {
        toast.error(result.error || "Erreur lors de la mise à jour du produit");
      }
    } catch {
      toast.error("Erreur lors de la mise à jour du produit");
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "name" && !slugTouched) {
      const slug = value.toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
      setForm((prev) => ({ ...prev, slug }));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugTouched(true);
    setForm((prev) => ({ ...prev, slug: value }));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Modifier le produit</h1>
          <p className="text-sm text-muted-foreground">{product.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="size-4 mr-2" />
            Retour
          </Button>
          <Link
            href={`/store/${product.slug}`}
            target="_blank"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border bg-background px-6 py-3 text-base font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            <Eye className="size-4 mr-2" />
            Voir en boutique
          </Link>
        </div>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
        {/* Informations de base */}
        <Card>
          <CardHeader>
            <CardTitle>Informations de base</CardTitle>
            <CardDescription>Nom, identifiant et descriptions du produit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Nom du produit *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Ex: iPhone 15 Pro 256 Go"
                required
              />
            </div>

            <div>
              <Label htmlFor="slug">Slug (URL) *</Label>
              <div className="flex items-center gap-2">
                <span className="px-3 py-2 text-sm text-muted-foreground bg-muted rounded-md">/produits/</span>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="iphone-15-pro-256-go"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Généré automatiquement depuis le nom, modifiable manuellement.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="basePrice">Prix de base (FCFA) *</Label>
                <Input
                  id="basePrice"
                  type="number"
                  min="0"
                  step="1"
                  value={form.basePrice}
                  onChange={(e) => handleInputChange("basePrice", parseInt(e.target.value) || 0)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="compareAtPrice">Prix barré (FCFA)</Label>
                <Input
                  id="compareAtPrice"
                  type="number"
                  min="0"
                  step="1"
                  value={form.compareAtPrice}
                  onChange={(e) => handleInputChange("compareAtPrice", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="sku">SKU / Référence</Label>
              <Input
                id="sku"
                value={form.sku}
                onChange={(e) => handleInputChange("sku", e.target.value)}
                placeholder="Ex: IPH15PRO-256-BLK"
              />
            </div>

            <div>
              <Label htmlFor="shortDescription">Description courte</Label>
              <Textarea
                id="shortDescription"
                value={form.shortDescription}
                onChange={(e) => handleInputChange("shortDescription", e.target.value)}
                placeholder="Résumé affiché sur les cartes produit (max 280 caractères)"
                rows={2}
                maxLength={280}
              />
            </div>

            <div>
              <Label htmlFor="description">Description complète</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Description détaillée pour la fiche produit"
                rows={6}
              />
            </div>
          </CardContent>
        </Card>

        {/* Images */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Images du produit</CardTitle>
              <CardDescription>Ajoutez jusqu&agrave; 5 images (max 2 Mo, formats: JPG, PNG, WebP)</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {form.images.map((preview, index) => (
                <div key={index} className="relative group">
                  <div className="aspect-square rounded-lg overflow-hidden border bg-muted">
                    <img src={preview} alt={`Image ${index + 1}`} className="h-full w-full object-cover" />
                    {index === 0 && (
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 text-xs bg-primary/90 text-primary-foreground rounded">
                        Principale
                      </div>
                    )}
                    {deletingImages.has(form.imageIds[index] ?? "") && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="size-6 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    disabled={deletingImages.has(form.imageIds[index] ?? "")}
                    className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                    aria-label={`Supprimer l'image ${index + 1}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {form.images.length < 5 && (
                <label className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center bg-muted/50 cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="size-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Ajouter une image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="sr-only"
                    multiple
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Formats: JPG, PNG, WebP • Max 2 Mo par image • 5 images maximum</p>
          </CardContent>
        </Card>

        {/* Variantes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Variantes</CardTitle>
              <CardDescription>Définissez les options du produit (taille, couleur, capacité, etc.)</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addVariant} disabled={form.variants.length >= 50}>
              <Plus className="size-4 mr-2" />
              Ajouter une variante
            </Button>
          </CardHeader>
          <CardContent>
            {form.variants.map((variant, index) => (
              <div key={variant.id || index} className="flex flex-col gap-4 sm:flex-row sm:items-center p-4 border rounded-lg bg-muted/30">
                <div className="flex-1">
                  <Label htmlFor={`variant-name-${index}`}>Nom de la variante *</Label>
                  <Input
                    id={`variant-name-${index}`}
                    value={variant.name}
                    onChange={(e) => updateVariant(index, "name", e.target.value)}
                    placeholder="Ex: 256 Go / Noir"
                    required
                  />
                </div>
                <div className="w-full sm:w-48">
                  <Label htmlFor={`variant-price-${index}`}>Prix (FCFA) *</Label>
                  <Input
                    id={`variant-price-${index}`}
                    type="number"
                    min="0"
                    step="1"
                    value={variant.price}
                    onChange={(e) => updateVariant(index, "price", parseInt(e.target.value) || 0)}
                    required
                  />
                </div>
                <div className="w-full sm:w-48">
                  <Label htmlFor={`variant-quantity-${index}`}>Stock *</Label>
                  <Input
                    id={`variant-quantity-${index}`}
                    type="number"
                    min="0"
                    step="1"
                    value={variant.quantity}
                    onChange={(e) => updateVariant(index, "quantity", parseInt(e.target.value) || 0)}
                    required
                  />
                </div>
                <div className="w-full sm:w-48">
                  <Label htmlFor={`variant-sku-${index}`}>SKU</Label>
                  <Input
                    id={`variant-sku-${index}`}
                    value={variant.sku}
                    onChange={(e) => updateVariant(index, "sku", e.target.value)}
                    placeholder="SKU spécifique"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => removeVariant(index)}
                  disabled={form.variants.length <= 1}
                >
                  <Trash2 className="size-4 mr-1" />
                  Supprimer
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Catégorie & Options */}
        <Card>
          <CardHeader>
            <CardTitle>Catégorie & Options</CardTitle>
            <CardDescription>Classement et paramètres du produit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="categoryId">Catégorie</Label>
                <Select value={form.categoryId} onValueChange={(v) => handleInputChange("categoryId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Aucune —</SelectItem>
                    {allCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <Input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => handleInputChange("isActive", e.target.checked)} />
                  <Label htmlFor="isActive">Produit actif (visible en boutique)</Label>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <Input type="checkbox" id="isFeatured" checked={form.isFeatured} onChange={(e) => handleInputChange("isFeatured", e.target.checked)} />
                  <Label htmlFor="isFeatured">Mettre en vedette (page d&apos;accueil)</Label>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <Input type="checkbox" id="requiresShipping" checked={form.requiresShipping} onChange={(e) => handleInputChange("requiresShipping", e.target.checked)} />
                  <Label htmlFor="requiresShipping">Nécessite livraison</Label>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <Input type="checkbox" id="trackInventory" checked={form.trackInventory} onChange={(e) => handleInputChange("trackInventory", e.target.checked)} />
                  <Label htmlFor="trackInventory">Suivre le stock</Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 pt-4 border-t">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="size-4 mr-2" />
            Annuler
          </Button>
          <Button type="submit" disabled={saving || uploading}>
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            {saving ? "Enregistrement..." : "Enregistrer les modifications"}
          </Button>
        </div>
      </form>
    </div>
  );
}