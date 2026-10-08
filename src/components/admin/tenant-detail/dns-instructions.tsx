"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

/**
 * Instructions DNS copiables (CNAME vers la cible Vercel) —
 * utilisées par l’onglet Domaines et la fiche `/admin/domains/[id]`.
 */
export function DnsInstructions({
  domain,
  target,
}: {
  domain: string;
  target: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      toast.success("Copié dans le presse-papiers.");
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Copie impossible (presse-papiers indisponible).");
    }
  };

  const rows: { label: string; value: string }[] = [
    { label: "Type", value: "CNAME" },
    { label: "Hôte", value: domain },
    { label: "Valeur", value: target },
    { label: "TTL", value: "3600" },
  ];

  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Enregistrements DNS à configurer chez votre registrar
      </p>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="w-16 shrink-0 text-muted-foreground">
              {row.label}
            </span>
            <code className="min-w-0 flex-1 truncate font-mono">
              {row.value}
            </code>
            <button
              type="button"
              onClick={() => copy(row.value)}
              aria-label={`Copier ${row.label}`}
              className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copied === row.value ? (
                <Check className="size-3.5 text-emerald-600" aria-hidden />
              ) : (
                <Copy className="size-3.5" aria-hidden />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
