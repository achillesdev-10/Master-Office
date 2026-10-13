"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Upload, Loader2, Image as ImageIcon, MapPin, Phone, Mail, Clock, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface ShopSettings {
  name: string;
  description: string;
  logoUrl: string;
  primaryColor: string;
  theme: string;
  whatsappPhone: string;
  address: string;
  hours: string;
  isActive: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState("");

  const [settings, setSettings] = useState<ShopSettings>({
    name: "Ma Boutique",
    description: "Bienvenue dans ma boutique en ligne",
    logoUrl: "",
    primaryColor: "#4f46e5",
    theme: "default",
    whatsappPhone: "07 01 02 03 04",
    address: "Cocody, Abidjan",
    hours: "Lun-Sam: 9h-19h",
    isActive: true,
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setLogoPreview(e.target?.result as string);
      reader.readAsDataURL(file);
      // TODO: Upload vers Vercel Blob
    }
  };

  const handleSave = async (section: string) => {
    setSaving(true);
    try {
      // TODO: Appel Server Action pour sauvegarder
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success(`${section} enregistré avec succès`);
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleColorChange = (color: string) => {
    setSettings((prev) => ({ ...prev, primaryColor: color }));
  };

  const themes = [
    { value: "default", label: "Défaut" },
    { value: "mode-01", label: "Mode 01" },
    { value: "cosmetique-01", label: "Cosmétique 01" },
    { value: "electronique-01", label: "Électronique 01" },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres de la boutique</h1>
        <p className="text-sm text-muted-foreground">Configurez l&apos;apparence et les informations de votre boutique</p>
      </header>

      {/* Informations générales */}
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
          <CardDescription>Nom, description et coordonnées de votre boutique</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Nom de la boutique *</Label>
              <Input
                id="name"
                value={settings.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Nom de votre boutique"
                required
              />
            </div>
            <div>
              <Label htmlFor="theme">Thème</Label>
              <Select value={settings.theme} onValueChange={(v) => handleInputChange("theme", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un thème" />
                </SelectTrigger>
                <SelectContent>
                  {themes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={settings.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Décrivez votre boutique..."
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="whatsappPhone">Numéro WhatsApp *</Label>
              <Input
                id="whatsappPhone"
                type="tel"
                value={settings.whatsappPhone}
                onChange={(e) => handleInputChange("whatsappPhone", e.target.value)}
                placeholder="Ex: 07 01 02 03 04"
                required
              />
            </div>
            <div>
              <Label htmlFor="primaryColor">Couleur principale</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="primaryColor"
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-14 h-10 p-0 rounded-lg cursor-pointer"
                />
                <Input
                  value={settings.primaryColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="flex-1 text-sm font-mono"
                  placeholder="#4f46e5"
                />
              </div>
            </div>
          </div>

          <Button onClick={() => handleSave("Informations générales")} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            Enregistrer
          </Button>
        </CardContent>
      </Card>

      {/* Apparence & Logo */}
      <Card>
        <CardHeader>
          <CardTitle>Apparence & Logo</CardTitle>
          <CardDescription>Logo, couleur et thème visuel de votre boutique</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              {logoPreview ? (
                <img src={logoPreview} alt="Aperçu logo" className="h-32 w-32 rounded-lg object-cover border" />
              ) : settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="h-32 w-32 rounded-lg object-cover border" />
              ) : (
                <div className="h-32 w-32 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted">
                  <ImageIcon className="size-12 text-muted-foreground mx-auto" />
                </div>
              )}
              <label className="absolute bottom-0 right-0 m-2">
                <Button variant="outline" size="sm">
                  <Upload className="size-4 mr-1" /> Changer
                </Button>
                <input type="file" accept="image/*" onChange={handleLogoChange} className="sr-only" />
              </label>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <Label>Couleur principale</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-14 h-10 p-0 rounded-lg cursor-pointer"
                  />
                  <span className="text-sm font-mono">{settings.primaryColor}</span>
                </div>
              </div>
              <div>
                <Label>Thème</Label>
                <Select value={settings.theme} onValueChange={(v) => handleInputChange("theme", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un thème" />
                  </SelectTrigger>
                  <SelectContent>
                    {themes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Button onClick={() => handleSave("Apparence")} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            Enregistrer
          </Button>
        </CardContent>
      </Card>

      {/* Coordonnées & Horaires */}
      <Card>
        <CardHeader>
          <CardTitle>Coordonnées & Horaires</CardTitle>
          <CardDescription>Informations de contact affichées sur votre boutique</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="whatsappPhone">Numéro WhatsApp *</Label>
              <Input
                id="whatsappPhone"
                type="tel"
                value={settings.whatsappPhone}
                onChange={(e) => handleInputChange("whatsappPhone", e.target.value)}
                placeholder="Ex: 07 01 02 03 04"
                required
              />
            </div>
            <div>
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={settings.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                placeholder="Ex: Cocody, Abidjan - Rue des Jardins, Lot 12"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="hours">Horaires d&apos;ouverture</Label>
            <Textarea
              id="hours"
              value={settings.hours}
              onChange={(e) => handleInputChange("hours", e.target.value)}
              placeholder="Lun-Ven: 9h-18h\nSam: 9h-13h\nDim: Fermé"
              rows={3}
            />
          </div>

          <Button onClick={() => handleSave("Coordonnées")} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            Enregistrer
          </Button>
        </CardContent>
      </Card>

      {/* Statut de la boutique */}
      <Card>
        <CardHeader>
          <CardTitle>Statut de la boutique</CardTitle>
          <CardDescription>Activez ou désactivez votre boutique en ligne</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Boutique en ligne</h3>
              <p className="text-sm text-muted-foreground">Rendez votre boutique visible et accessible aux clients</p>
            </div>
            <Switch
              checked={settings.isActive}
              onCheckedChange={(checked) => handleInputChange("isActive", checked)}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {settings.isActive
              ? "Votre boutique est en ligne et accessible aux clients."
              : "Votre boutique est hors ligne. Les clients ne peuvent pas y accéder."}
          </p>
          <Button onClick={() => handleSave("Statut")} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            Enregistrer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}