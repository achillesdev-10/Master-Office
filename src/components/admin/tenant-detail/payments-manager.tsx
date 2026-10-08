"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { savePaymentSettings } from "@/lib/actions/tenants";
import type { TenantPaymentItem } from "@/lib/db/queries/tenant-detail";
import {
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER_LABELS,
  type PaymentProvider,
} from "@/lib/validators/tenant";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Providers qui nécessitent une clé API côté boutique. */
const KEY_PROVIDERS: PaymentProvider[] = ["stripe", "paypal"];

type RowState = {
  enabled: boolean;
  apiKey: string;
};

function initialRows(payments: TenantPaymentItem[]): RowState[] {
  return PAYMENT_PROVIDERS.map((provider) => ({
    enabled:
      payments.find((payment) => payment.provider === provider)?.enabled ??
      false,
    apiKey: "",
  }));
}

/**
 * Onglet « Paiements » : un bloc par provider avec activation,
 * clé API (masquée) et enregistrement indépendant.
 */
export function PaymentsManager({
  tenantId,
  payments,
}: {
  tenantId: string;
  payments: TenantPaymentItem[];
}) {
  const router = useRouter();
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [rows, setRows] = useState<RowState[]>(() => initialRows(payments));

  const updateRow = (index: number, patch: Partial<RowState>) =>
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );

  const save = (index: number, provider: PaymentProvider) => {
    const row = rows[index];
    if (!row) return;

    setPendingIndex(index);

    void (async () => {
      const result = await savePaymentSettings(tenantId, {
        provider,
        enabled: row.enabled,
        apiKey: row.apiKey,
      });

      setPendingIndex(null);
      if (result.success) {
        toast.success(result.message ?? "Enregistré.");
        updateRow(index, { apiKey: "" });
        router.refresh();
      } else {
        toast.error(result.error ?? "L'enregistrement a échoué.");
      }
    })();
  };

  return (
    <div className="space-y-4">
      {PAYMENT_PROVIDERS.map((provider, index) => {
        const payment = payments.find((item) => item.provider === provider);
        const row = rows[index];
        if (!row) return null;

        const needsKey = KEY_PROVIDERS.includes(provider);
        const busy = pendingIndex === index;

        return (
          <div
            key={provider}
            className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {PAYMENT_PROVIDER_LABELS[provider]}
                </span>
                <Badge variant={payment?.enabled ? "success" : "secondary"}>
                  {payment?.enabled ? "Activé" : "Désactivé"}
                </Badge>
                {payment?.keyMasked && (
                  <Badge variant="info">
                    <KeyRound className="mr-1 size-3" aria-hidden />
                    {payment.keyMasked}
                  </Badge>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(event) =>
                      updateRow(index, { enabled: event.target.checked })
                    }
                    className="size-4 cursor-pointer accent-primary"
                  />
                  Accepter ce moyen de paiement
                </label>

                {needsKey && (
                  <label className="min-w-56 flex-1">
                    <span className="mb-1 block text-xs text-muted-foreground">
                      Clé API{" "}
                      {payment?.keyMasked
                        ? "(laisser vide pour conserver)"
                        : ""}
                    </span>
                    <Input
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={
                        payment?.keyMasked
                          ? `Clé enregistrée ${payment.keyMasked}`
                          : `${provider}_live_…`
                      }
                      value={row.apiKey}
                      onChange={(event) =>
                        updateRow(index, { apiKey: event.target.value })
                      }
                    />
                  </label>
                )}
              </div>

              {needsKey && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  Chiffrée côté serveur, stockée dans{" "}
                  <code>TenantPayment</code>.
                </p>
              )}
            </div>

            <Button
              variant="outline"
              disabled={pendingIndex !== null}
              onClick={() => save(index, provider)}
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {busy ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
