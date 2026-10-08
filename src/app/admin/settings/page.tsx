import { getSettings } from "@/lib/db/queries/settings";
import { SettingsTabs } from "@/components/admin/settings/settings-tabs";

/** `/admin/settings` — paramètres de la plateforme (module 13). */
export const metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Configuration globale de la plateforme : identité, emails, paiements,
          intégrations et sécurité.
        </p>
      </header>

      <SettingsTabs settings={settings} />
    </div>
  );
}
