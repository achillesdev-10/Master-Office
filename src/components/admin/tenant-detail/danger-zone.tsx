"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Ban, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  archiveTenant,
  deleteTenant,
  restoreTenant,
  suspendTenant,
} from "@/lib/actions/tenants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type DangerTenant = { id: string; name: string; status: string };

/**
 * Onglet « Zone de danger » : suspension, archivage et suppression
 * (confirmation double : dialogue + saisie exacte du nom).
 */
export function DangerZone({ tenant }: { tenant: DangerTenant }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmText, setConfirmText] = useState("");

  const confirmed = confirmText.trim() === tenant.name;

  const run = (
    action: () => Promise<{ success: boolean; error?: string; message?: string }>,
    successMessage: string,
    onSuccess?: () => void,
  ) => {
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        toast.success(result.message ?? successMessage);
        onSuccess?.();
        router.refresh();
      } else {
        toast.error(result.error ?? "Action impossible.");
      }
    });
  };

  const handleSuspend = () => {
    const ok = window.confirm(
      `Suspendre « ${tenant.name} » ?\n\nLa boutique sera marquée comme suspendue.`,
    );
    if (!ok) return;
    run(() => suspendTenant(tenant.id), "Boutique suspendue.");
  };

  const handleArchive = () => {
    const ok = window.confirm(
      `Archiver « ${tenant.name} » ?\n\nLa boutique sortira des listes actives (réversible).`,
    );
    if (!ok) return;
    run(() => archiveTenant(tenant.id), "Boutique archivée.");
  };

  const handleRestore = () => {
    run(() => restoreTenant(tenant.id), "Boutique réactivée.");
  };

  const handleDelete = () => {
    if (!confirmed) return;
    const ok = window.confirm(
      `Supprimer définitivement « ${tenant.name} » ?\n\nSuppression logique : la boutique sera archivée et retirée des listes.`,
    );
    if (!ok) return;
    run(
      () => deleteTenant(tenant.id),
      "Boutique supprimée.",
      () => router.push("/admin/tenants"),
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">Suspension</p>
          <p className="text-sm text-muted-foreground">
            La boutique reste consultable dans l’admin mais est marquée
            comme suspendue.
          </p>
        </div>
        {tenant.status === "SUSPENDED" ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={handleRestore}
            className="shrink-0"
          >
            <RotateCcw className="size-4" aria-hidden />
            Réactiver
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={pending}
            onClick={handleSuspend}
            className="shrink-0"
          >
            <Ban className="size-4" aria-hidden />
            Suspendre
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">Archivage</p>
          <p className="text-sm text-muted-foreground">
            Statut ARCHIVED : la boutique est retirée des listes actives
            sans perte de données.
          </p>
        </div>
        {tenant.status === "ARCHIVED" ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={handleRestore}
            className="shrink-0"
          >
            <RotateCcw className="size-4" aria-hidden />
            Réactiver
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={pending}
            onClick={handleArchive}
            className="shrink-0"
          >
            <Archive className="size-4" aria-hidden />
            Archiver
          </Button>
        )}
      </div>

      <div className="space-y-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <div>
          <p className="text-sm font-medium text-destructive">
            Suppression de la boutique
          </p>
          <p className="text-sm text-muted-foreground">
            Action auditable et réversible côté base (suppression logique).
            Saisissez <span className="font-mono font-medium">{tenant.name}</span>{" "}
            pour confirmer.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            aria-label="Confirmation du nom de la boutique"
            placeholder={tenant.name}
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            className="sm:max-w-xs"
          />
          <Button
            variant="destructive"
            disabled={!confirmed || pending}
            onClick={handleDelete}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="size-4" aria-hidden />
            )}
            Supprimer définitivement
          </Button>
        </div>
      </div>
    </div>
  );
}
