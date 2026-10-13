import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireTenantAccess, getCurrentUser } from "@/lib/auth/permissions";
import { getTenantMembers } from "@/lib/db/queries/tenant-detail";
import { getTenantSettings } from "@/lib/actions/storefront/settings";
import { updateTenantInfo, updateTenantAppearance, updateTenantWhatsApp, updateTenantAddress, updateTenantStatus, uploadTenantLogo } from "@/lib/actions/storefront/settings";
import { toast } from "sonner";
import { Save, Upload, Loader2, Image as ImageIcon, MapPin, Phone, Mail, Clock, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Save, Upload, Loader2, Image as ImageIcon, MapPin, Phone, Mail, Clock, Palette } from "lucide-react";

async function getSettingsData(tenantId: string) {
  return getTenantSettings(tenantId);
}

export default async function SettingsPage() {
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

  const settings = await getSettingsData(tenantId);
  
  if (!settings) {
    return null;
  }

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
            if (result.success) {
              toast.success(result.message);
            } else {
              toast.error(result.error || "Erreur lors de l'enregistrement");
            }
          }}>
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
                    name="name"
                    defaultValue={settings.name}
                    placeholder="Nom de votre boutique"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="theme">Thème</Label>
                  <Select value={settings.theme} onChange={() => {}}>
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
                  name="description"
                  defaultValue={settings.description}
                  placeholder="Décrivez votre boutique..."
                  rows={3}
                />
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
                      <SelectItem value="CI">Côte d'Ivoire</SelectItem>
                      <SelectItem value="SN">Sénégal</SelectItem>
                      <SelectItem value="ML">Mali</SelectItem>
                      <SelectItem value="BF">Burkina Faso</SelectItem>
                      <SelectItem value="NE">Niger</SelectItem>
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
                      <SelectItem value="XOF">Franc CFA (XOF)</SelectItem>
                      <SelectItem value="EUR">Euro (EUR)</SelectItem>
                      <SelectItem value="USD">Dollar US (USD)</SelectItem>
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
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="en">English</SelectItem>
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
                      <SelectItem value="Africa/Abidjan">Abidjan (GMT)</SelectItem>
                      <SelectItem value="Africa/Dakar">Dakar (GMT)</SelectItem>
                      <SelectItem value="Africa/Lome">Lomé (GMT)</SelectItem>
                      <SelectItem value="Africa/Casablanca">Casablanca (GMT+1)</SelectItem>
                      <SelectItem value="Africa/Tunis">Tunis (GMT+1)</SelectItem>
                      <SelectItem value="Europe/Paris">Paris (GMT+1/+2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit">
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
          <form action={async (formData) => {
            "use server";
            const result = await updateTenantAppearance({
              tenantId,
              logoUrl: formData.get("logoUrl") as string,
              primaryColor: formData.get("primaryColor") as string,
              themeId: formData.get("themeId") as string,
            });
            if (result.success) {
              toast.success(result.message);
            } else {
              toast.error(result.error || "Erreur lors de l'enregistrement");
            }
          }}>
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
                    <input type="file" accept="image/*" name="logoFile" className="sr-only" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const formData = new FormData();
                        formData.append("tenantId", tenantId);
                        formData.append("file", file);
                        const result = await uploadTenantLogo(formData);
                        if (result.success && result.url) {
                          toast.success("Logo mis à jour");
                        } else {
                          toast.error(result.error || "Erreur lors de l'upload");
                        }
                      }} />
                  </label>
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <Label>Couleur principale</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        type="color"
                        defaultValue={settings.primaryColor}
                        onChange={(e) => {}}
                        className="w-14 h-10 p-0 rounded-lg cursor-pointer"
                      />
                      <Input
                        defaultValue={settings.primaryColor}
                        className="flex-1 text-sm font-mono"
                        placeholder="#4f46e5"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Thème</Label>
                    <Select defaultValue={settings.themeId || "default"} onValueChange={async (v) => {
                      "use server";
                      const result = await updateTenantAppearance({ tenantId, themeId: v });
                      if (result.success) {
                        toast.success(result.message);
                      } else {
                        toast.error(result.error);
                      }
                    }}>
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
            </CardContent>
          </form>
        </Card>

        {/* Coordonnées & Horaires */}
        <form action={async (formData) => {
          "use server";
          const result = await updateTenantWhatsApp({
            tenantId,
            whatsappPhone: formData.get("whatsappPhone") as string,
          });
          if (result.success) {
            toast.success(result.message);
          } else {
            toast.error(result.error || "Erreur lors de l'enregistrement");
          }
        }}>
          <Card>
            <CardHeader>
              <CardTitle>Coordonnées WhatsApp</CardTitle>
              <CardDescription>Numéro WhatsApp pour les commandes</CardDescription>
            </CardHeader>
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
                Enregistrer
              </Button>
            </CardContent>
          </form>
        </Card>

        <form action={async (formData) => {
          "use server";
          const result = await updateTenantAddress({
            tenantId,
            address: formData.get("address") as string,
            hours: formData.get("hours") as string,
          });
          if (result.success) {
            toast.success(result.message);
          } else {
            toast.error(result.error || "Erreur lors de l'enregistrement");
          }
        }}>
          <Card>
            <CardHeader>
              <CardTitle>Adresse & Horaires</CardTitle>
              <CardDescription>Informations de contact affichées sur votre boutique</CardDescription>
            </CardHeader>
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
                  <Label htmlFor="hours">Horaires d'ouverture</Label>
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
                Enregistrer
              </Button>
            </CardContent>
          </form>
        </Card>

        {/* Statut de la boutique */}
        <form action={async (formData) => {
          "use server";
          const result = await updateTenantStatus({
            tenantId,
            isActive: formData.get("isActive") === "on",
          });
          if (result.success) {
            toast.success(result.message);
          } else {
            toast.error(result.error || "Erreur lors de l'enregistrement");
          }
        }}>
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
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={settings.status === "ACTIVE"}
                  className="w-11 h-6"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {settings.status === "ACTIVE"
                  ? "Votre boutique est en ligne et accessible aux clients."
                  : "Votre boutique est hors ligne. Les clients ne peuvent pas y accéder."}
              </p>
              <Button type="submit">
                Enregistrer
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    );
  };
}