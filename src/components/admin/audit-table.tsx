"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { Braces, Check, Copy, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AuditLogListItem } from "@/lib/db/queries/audit";

const ACTION_TONES: Record<
  string,
  "info" | "success" | "warning" | "destructive" | "secondary"
> = {
  "tenant.create": "info",
  "tenant.update": "info",
  "tenant.suspend": "warning",
  "tenant.restore": "success",
  "tenant.delete": "destructive",
  "domain.add": "info",
  "domain.verify": "success",
  "domain.ssl": "info",
  "domain.remove": "destructive",
  "subscription.assign": "success",
  "subscription.status": "warning",
  "plan.create": "success",
  "plan.delete": "destructive",
  "theme.create": "success",
  "theme.update": "info",
  "theme.delete": "destructive",
  "user.invite": "info",
  "user.role": "warning",
  "user.delete": "destructive",
};

function actionTone(action: string): "info" | "success" | "warning" | "destructive" | "secondary" {
  const exact = ACTION_TONES[action];
  if (exact) return exact;
  if (/(delete|remove)/.test(action)) return "destructive";
  if (/(suspend|archive|verify|status|role|ssl)/.test(action)) return "warning";
  if (/(create|invite|restore)/.test(action)) return "success";
  if (/(update|payment|add|assign)/.test(action)) return "info";
  return "secondary";
}

function DetailsRow({
  metadata,
  label,
}: {
  metadata: AuditLogListItem["metadata"];
  label: string;
}) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(metadata, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      toast.success("Métadonnées copiées.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible.");
    }
  };

  return (
    <tr className="border-b bg-muted/40 last:border-b-0">
      <td colSpan={7} className="px-4 py-3">
        <div className="flex flex-col items-start gap-3 sm:flex-row">
          <pre className="max-h-64 flex-1 overflow-auto rounded-md border bg-background p-3 font-mono text-xs leading-relaxed">
            {json}
          </pre>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            aria-label={`Copier les métadonnées de ${label}`}
          >
            {copied ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
            )}
            Copier
          </Button>
        </div>
      </td>
    </tr>
  );
}

/**
 * Table du journal d’activité (module 12) : chaque ligne peut se
 * déplier pour afficher et copier ses métadonnées JSON.
 */
export function AuditTable({ items }: { items: AuditLogListItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
        <div className="rounded-full bg-muted p-4">
          <ScrollText aria-hidden className="size-6 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Aucune entrée</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Aucun événement ne correspond aux filtres sélectionnés.
          </p>
        </div>
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <th className="px-4 py-2.5 font-medium">Date</th>
          <th className="px-4 py-2.5 font-medium">Action</th>
          <th className="px-4 py-2.5 font-medium">Entité</th>
          <th className="px-4 py-2.5 font-medium">Utilisateur</th>
          <th className="px-4 py-2.5 font-medium">Boutique</th>
          <th className="px-4 py-2.5 font-medium">IP</th>
          <th className="px-4 py-2.5 text-right font-medium">
            <span className="sr-only">Métadonnées</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const open = openId === item.id;
          const label = new Date(item.createdAt).toLocaleString("fr-FR");

          return (
            <Fragment key={item.id}>
              <tr className="border-b last:border-b-0">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {label}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={actionTone(item.action)}>{item.action}</Badge>
                </td>
                <td className="px-4 py-3">
                  {item.entity ? (
                    <span className="block truncate text-sm">
                      {item.entity}
                      {item.entityId && (
                        <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                          {item.entityId}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.user ? (
                    <span className="block truncate">
                      {item.user.email}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {item.user.role}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Système</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.tenant ? (
                    <Link
                      href={`/admin/tenants/${item.tenant.id}`}
                      className="block truncate hover:underline"
                    >
                      {item.tenant.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                  {item.ip ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : item.id)}
                    className="text-muted-foreground"
                  >
                    <Braces className="size-3.5" aria-hidden />
                    {open ? "Masquer" : "Détails"}
                  </Button>
                </td>
              </tr>

              {item.metadata !== null && open && (
                <DetailsRow metadata={item.metadata} label={label} />
              )}
              {item.metadata === null && open && (
                <tr className="border-b bg-muted/40 last:border-b-0">
                  <td
                    colSpan={7}
                    className="px-4 py-3 text-xs text-muted-foreground"
                  >
                    Aucune métadonnée enregistrée pour cette entrée.
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
