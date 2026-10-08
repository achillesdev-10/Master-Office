"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createShippingMethod,
  deleteShippingMethod,
  updateShippingMethod,
} from "@/lib/actions/tenants";
import type { ShippingItem } from "@/lib/db/queries/tenant-detail";
import { formatCurrency } from "@/lib/utils";
import { Field } from "@/components/admin/tenant-form/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type RowValues = { name: string; price: string; enabled: boolean };

function toEuros(centimes: number): string {
  return (centimes / 100).toFixed(2);
}

function parseEuros(value: string): number {
  const parsed = Number.parseFloat(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return Number.NaN;
  return Math.round(parsed * 100);
}

/**
 * Onglet « Livraison » : ajout d'une méthode + édition / suppression
 * de chaque ligne (une Server Action par enregistrement).
 */
export function ShippingManager({
  tenantId,
  methods,
}: {
  tenantId: string;
  methods: ShippingItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<RowValues>({
    name: "",
    price: "0.00",
    enabled: true,
  });
  const [rows, setRows] = useState<Record<string, RowValues>>(() =>
    Object.fromEntries(
      methods.map((method) => [
        method.id,
        {
          name: method.name,
          price: toEuros(method.price),
          enabled: method.enabled,
        },
      ]),
    ),
  );

  const run = async (
    action: () => Promise<{ success: boolean; error?: string; message?: string }>,
    successMessage: string,
  ): Promise<boolean> => {
    const result = await action();
    if (result.success) {
      toast.success(result.message ?? successMessage);
      router.refresh();
      return true;
    }
    toast.error(result.error ?? "Action impossible.");
    return false;
  };

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    const price = parseEuros(draft.price);

    if (!draft.name.trim()) {
      setErrors({ name: "Nom requis." });
      return;
    }
    if (Number.isNaN(price)) {
      setErrors({ price: "Prix invalide (ex : 4.90)." });
      return;
    }

    const values: RowValues = {
      name: draft.name.trim(),
      price: draft.price,
      enabled: draft.enabled,
    };

    startTransition(async () => {
      const ok = await run(
        () =>
          createShippingMethod(tenantId, {
            name: values.name,
            price,
            enabled: values.enabled,
          }),
        "Méthode ajoutée.",
      );
      if (ok) setDraft({ name: "", price: "0.00", enabled: true });
    });
  };

  const handleUpdate = (method: ShippingItem) => {
    const row = rows[method.id];
    if (!row) return;
    const price = parseEuros(row.price);

    if (Number.isNaN(price)) {
      toast.error("Prix invalide (ex : 4.90).");
      return;
    }

    startTransition(async () => {
      await run(
        () =>
          updateShippingMethod(method.id, {
            name: row.name.trim(),
            price,
            enabled: row.enabled,
          }),
        "Méthode mise à jour.",
      );
    });
  };

  const handleDelete = (method: ShippingItem) => {
    const confirmed = window.confirm(
      `Supprimer la méthode « ${method.name} » ?`,
    );
    if (!confirmed) return;
    startTransition(async () => {
      await run(() => deleteShippingMethod(method.id), "Méthode supprimée.");
    });
  };

  const setRow = (id: string, patch: Partial<RowValues>) =>
    setRows((current) => ({
      ...current,
      [id]: { ...(current[id] as RowValues), ...patch },
    }));

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-lg border border-dashed p-4"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
          <Field label="Nom" htmlFor="ship-name" error={errors.name}>
            <Input
              id="ship-name"
              placeholder="Livraison standard"
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
            />
          </Field>

          <Field label="Prix" htmlFor="ship-price" error={errors.price}>
            <Input
              id="ship-price"
              inputMode="decimal"
              placeholder="4.90"
              value={draft.price}
              onChange={(event) =>
                setDraft((current) => ({ ...current, price: event.target.value }))
              }
            />
          </Field>

          <Button type="submit" disabled={pending} className="h-9">
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            Ajouter
          </Button>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                enabled: event.target.checked,
              }))
            }
            className="size-4 cursor-pointer accent-primary"
          />
          Méthode active
        </label>
      </form>

      {methods.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aucune méthode de livraison pour cette boutique.
        </div>
      ) : (
        <ul className="space-y-3">
          {methods.map((method) => {
            const row = rows[method.id];
            if (!row) return null;

            return (
              <li
                key={method.id}
                className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_8rem_auto_auto] sm:items-end"
              >
                <Field label="Nom" htmlFor={`name-${method.id}`}>
                  <Input
                    id={`name-${method.id}`}
                    value={row.name}
                    onChange={(event) =>
                      setRow(method.id, { name: event.target.value })
                    }
                  />
                </Field>

                <Field label="Prix" htmlFor={`price-${method.id}`}>
                  <Input
                    id={`price-${method.id}`}
                    inputMode="decimal"
                    value={row.price}
                    onChange={(event) =>
                      setRow(method.id, { price: event.target.value })
                    }
                  />
                </Field>

                <label className="flex h-9 cursor-pointer items-center gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(event) =>
                      setRow(method.id, { enabled: event.target.checked })
                    }
                    className="size-4 cursor-pointer accent-primary"
                  />
                  Actif
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatCurrency(method.price / 100)}
                  </span>
                </label>

                <div className="flex items-center gap-2 pb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => handleUpdate(method)}
                  >
                    Enregistrer
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Supprimer ${method.name}`}
                    disabled={pending}
                    onClick={() => handleDelete(method)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
