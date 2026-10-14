import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { requireTenantAccess } from "@/lib/auth/permissions";
import { getTenantSettings } from "@/lib/actions/storefront/settings";
import { updateTenantInfo, updateTenantAppearance, updateTenantWhatsApp, updateTenantAddress, updateTenantStatus, uploadTenantLogo } from "@/lib/actions/storefront/settings";
import { Save, Upload } from "lucide-react";

const themes = [
  { value: "default", label: "Défaut" },
  { value: "mode-01", label: "Mode 01" },
  { value: "cosmetique-01", label: "Cosmétique 01" },
  { value: "electronique-01", label: "Électronique 01" },
];

const countries = [
  { value: "CI", label: "Côte d'Ivoire" },
  { value: "SN", label: "Sénégal" },
  { value: "ML", label: "Mali" },
  { value: "BF", label: "Burkina Faso" },
  { value: "NE", label: "Niger" },
];

const currencies = [
  { value: "XOF", label: "Franc CFA (XOF)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "USD", label: "Dollar US (USD)" },
];

const languages = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
];

const timezones = [
  { value: "Africa/Abidjan", label: "Abidjan (GMT)" },
  { value: "Africa/Dakar", label: "Dakar (GMT)" },
  { value: "Africa/Lome", label: "Lomé (GMT)" },
  { value: "Africa/Casablanca", label: "Casablanca (GMT+1)" },
  { value: "Africa/Tunis", label: "Tunis (GMT+1)" },
  { value: "Europe/Paris", label: "Paris (GMT+1/+2)" },
];

async function getSettingsData(tenantId: string) {
  return getTenantSettings(tenantId);
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const tenantId = resolvedSearchParams.tenant;

  if (!tenantId) {
    return null;
  }

  await requireTenantAccess(tenantId);

  const settings = await getSettingsData(tenantId);
  
  if (!settings) {
    return null;
  }

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
        <form action={async (formData) => {
          "use server";
          const result = await updateTenantInfo({
            tenantId,
            name: formData.get("name") as string,
            description: formData.get("description") as string,
            contactName: formData.get("contactName") as string,
            contactEmail: formData.get("contactEmail") as string,
            contactPhone: formData.get("contactPhone") as string,
            contactCountry: formData.get("contactCountry") as string,
            currency: formData.get("currency") as string,
            language: formData.get("language") as string,
            timezone: formData.get("timezone") as string,
          });
        }}>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Nom de la boutique *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={settings.name}
                  placeholder="Nom de votre boutique"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={settings.description}
                  placeholder="Décrivez votre boutique..."
                  rows={3}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="contactName">Nom du contact *</Label>
                <Input
                  id="contactName"
                  name="contactName"
                  defaultValue={settings.contactName}
                  placeholder="Nom du responsable"
                  required
                />
              </div>
              <div>
                <Label htmlFor="contactEmail">Email du contact *</Label>
                <Input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  defaultValue={settings.contactEmail}
                  placeholder="contact@boutique.com"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="contactPhone">Téléphone du contact *</Label>
                <Input
                  id="contactPhone"
                  name="contactPhone"
                  type="tel"
                  defaultValue={settings.contactPhone}
                  placeholder="Ex: 07 01 02 03 04"
                  required
                />
              </div>
              <div>
                <Label htmlFor="contactCountry">Pays *</Label>
                <Select defaultValue={settings.contactCountry} name="contactCountry">
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un pays" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="currency">Devise</Label>
                <Select defaultValue={settings.currency} name="currency">
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez une devise" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="language">Langue</Label>
                <Select defaultValue={settings.language} name="language">
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une langue" />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="timezone">Fuseau horaire</Label>
                <Select defaultValue={settings.timezone} name="timezone">
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un fuseau horaire" />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit">
              <Save className="size-4 mr-2" />
              Enregistrer
            </Button>
          </CardContent>
        </form>
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
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="h-32 w-32 rounded-lg object-cover border" />
              ) : (
                <div className="h-32 w-32 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted">
                  <span className="text-muted-foreground">Pas de logo</span>
                </div>
              )}
              <label className="absolute bottom-0 right-0 m-2">
                <Button variant="outline" size="sm" type="button">
                  <Upload className="size-4 mr-1" /> Changer
                </Button>
                <form action={async (formData) => {
                  "use server";
                  const result = await uploadTenantLogo(formData);
                }}>
                  <input type="file" accept="image/*" name="file" className="sr-only" onChange={(e) => e.currentTarget.form?.requestSubmit()} />
                  <input type="hidden" name="tenantId" value={tenantId} />
                </form>
              </label>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <Label>Couleur principale</Label>
                <form action={async (formData) => {
                  "use server";
                  const result = await updateTenantAppearance({
                    tenantId,
                    primaryColor: formData.get("primaryColor") as string,
                  });
                }}>
                  <div className="flex items-center gap-4">
                    <Input
                      type="color"
                      name="primaryColor"
                      defaultValue={settings.primaryColor || "#4f46e5"}
                      className="w-14 h-10 p-0 rounded-lg cursor-pointer"
                    />
                    <Input
                      name="primaryColor"
                      defaultValue={settings.primaryColor || "#4f46e5"}
                      className="flex-1 text-sm font-mono"
                      placeholder="#4f46e5"
                    />
                    <Button type="submit" variant="outline" size="sm">
                      <Save className="size-3.5 mr-1" />
                      Enregistrer
                    </Button>
                  </div>
                </form>
              </div>
              <div>
                <Label>Thème</Label>
                <form action={async (formData) => {
                  "use server";
                  const result = await updateTenantAppearance({
                    tenantId,
                    themeId: formData.get("themeId") as string || null,
                  });
                }}>
                  <Select name="themeId" defaultValue={settings.themeId || "default"} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
                    <SelectTrigger className="w-[300px]">
                      <SelectValue placeholder="Sélectionner un thème" />
                    </SelectTrigger>
                    <SelectContent>
                      {themes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </form>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coordonnées WhatsApp */}
      <Card>
        <CardHeader>
          <CardTitle>Coordonnées WhatsApp</CardTitle>
          <CardDescription>Numéro WhatsApp pour les commandes</CardDescription>
        </CardHeader>
        <form action={async (formData) => {
          "use server";
          const result = await updateTenantWhatsApp({
            tenantId,
            whatsappPhone: formData.get("whatsappPhone") as string,
          });
        }}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="whatsappPhone">Numéro WhatsApp *</Label>
              <Input
                id="whatsappPhone"
                name="whatsappPhone"
                type="tel"
                defaultValue={settings.contactPhone}
                placeholder="Ex: 07 01 02 03 04"
                required
              />
            </div>
            <Button type="submit">
              <Save className="size-4 mr-2" />
              Enregistrer
            </Button>
          </CardContent>
        </form>
      </Card>

      {/* Adresse & Horaires */}
      <Card>
        <CardHeader>
          <CardTitle>Adresse & Horaires</CardTitle>
          <CardDescription>Informations de contact affichées sur votre boutique</CardDescription>
        </CardHeader>
        <form action={async (formData) => {
          "use server";
          const result = await updateTenantAddress({
            tenantId,
            address: formData.get("address") as string,
            hours: formData.get("hours") as string,
          });
        }}>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  name="address"
                  defaultValue={settings.address}
                  placeholder="Ex: Cocody, Abidjan - Rue des Jardins, Lot 12"
                />
              </div>
              <div>
                <Label htmlFor="hours">Horaires d&apos;ouverture</Label>
                <Textarea
                  id="hours"
                  name="hours"
                  defaultValue={settings.hours}
                  placeholder="Lun-Ven: 9h-18h\nSam: 9h-13h\nDim: Fermé"
                  rows={3}
                />
              </div>
            </div>
            <Button type="submit">
              <Save className="size-4 mr-2" />
              Enregistrer
            </Button>
          </CardContent>
        </form>
      </Card>

      {/* Statut de la boutique */}
      <Card>
        <CardHeader>
          <CardTitle>Statut de la boutique</CardTitle>
          <CardDescription>Activez ou désactivez votre boutique en ligne</CardDescription>
        </CardHeader>
        <form action={async (formData) => {
          "use server";
          const result = await updateTenantStatus({
            tenantId,
            isActive: formData.get("isActive") === "on",
          });
        }}>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Boutique en ligne</h3>
                <p className="text-sm text-muted-foreground">Rendez votre boutique visible et accessible aux clients</p>
              </div>
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={settings.status === "ACTIVE"}
                className="w-11 h-6"
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {settings.status === "ACTIVE"
                ? "Votre boutique est en ligne et accessible aux clients."
                : "Votre boutique est hors ligne. Les clients ne peuvent pas y accéder."}
            </p>
            <Button type="submit">
              <Save className="size-4 mr-2" />
              Enregistrer
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}