"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  changeTenantUserRole,
  inviteTenantUser,
  removeTenantUser,
} from "@/lib/actions/tenants";
import type { TenantMemberItem } from "@/lib/db/queries/tenant-detail";
import {
  TENANT_ROLES,
  TENANT_ROLE_LABELS,
} from "@/lib/validators/tenant";
import { Field } from "@/components/admin/tenant-form/field";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Onglet « Utilisateurs » : invitation par email, changement de rôle
 * et retrait (le dernier administrateur est protégé côté serveur).
 */
export function UsersManager({
  tenantId,
  members,
}: {
  tenantId: string;
  members: TenantMemberItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof TENANT_ROLES)[number]>("MEMBER");

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

  const handleInvite = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    startTransition(async () => {
      const ok = await run(
        () => inviteTenantUser(tenantId, { email: email.trim(), role }),
        "Invitation envoyée.",
      );
      if (ok) setEmail("");
    });
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleInvite}
        className="grid gap-4 rounded-lg border border-dashed p-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
        noValidate
      >
        <Field label="Inviter par email" htmlFor="invite-email" error={errors.email}>
          <Input
            id="invite-email"
            type="email"
            placeholder="prenom@exemple.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>

        <Field label="Rôle" htmlFor="invite-role" error={errors.role}>
          <Select
            id="invite-role"
            value={role}
            onChange={(event) =>
              setRole(event.target.value as typeof role)
            }
          >
            {TENANT_ROLES.map((value) => (
              <option key={value} value={value}>
                {TENANT_ROLE_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Button type="submit" disabled={pending} className="h-9">
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <UserPlus className="size-4" aria-hidden />
          )}
          Inviter
        </Button>
      </form>

      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aucun membre pour cette boutique.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Membre</th>
                <th className="px-4 py-2.5 font-medium">Ajouté le</th>
                <th className="px-4 py-2.5 font-medium">Rôle</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <span className="block truncate font-medium">
                      {member.email}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {format(new Date(member.createdAt), "d MMM yyyy", {
                      locale: fr,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      aria-label={`Rôle de ${member.email}`}
                      className="w-40"
                      value={member.role}
                      disabled={pending}
                      onChange={(event) => {
                        const nextRole = event.target.value;
                        if (nextRole === member.role) return;
                        startTransition(async () => {
                          await run(
                            () =>
                              changeTenantUserRole(
                                tenantId,
                                member.userId,
                                nextRole,
                              ),
                            "Rôle modifié.",
                          );
                        });
                      }}
                    >
                      {TENANT_ROLES.map((value) => (
                        <option key={value} value={value}>
                          {TENANT_ROLE_LABELS[value]}
                        </option>
                      ))}
                      {member.role === "SUPER_ADMIN" && (
                        <option value="SUPER_ADMIN">Super Admin</option>
                      )}
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Badge
                        variant={
                          member.role === "ADMIN" ? "info" : "secondary"
                        }
                      >
                        {TENANT_ROLE_LABELS[
                          member.role as keyof typeof TENANT_ROLE_LABELS
                        ] ?? member.role}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Retirer ${member.email}`}
                        title="Retirer de la boutique"
                        disabled={pending}
                        onClick={() => {
                          const confirmed = window.confirm(
                            `Retirer ${member.email} de cette boutique ?`,
                          );
                          if (!confirmed) return;
                          startTransition(async () => {
                            await run(
                              () =>
                                removeTenantUser(tenantId, member.userId),
                              "Membre retiré.",
                            );
                          });
                        }}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
