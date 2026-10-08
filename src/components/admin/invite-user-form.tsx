"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { invitePlatformUser } from "@/lib/actions/users";
import {
  PLATFORM_ROLES,
  PLATFORM_ROLE_LABELS,
} from "@/lib/validators/user";
import { Field } from "@/components/admin/tenant-form/field";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Invitation d’un compte (module 9) : email + rôle initial. */
export function InviteUserForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof PLATFORM_ROLES)[number]>("MEMBER");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    startTransition(async () => {
      const result = await invitePlatformUser({ email: email.trim(), role });
      if (result.success) {
        toast.success(result.message ?? "Invitation envoyée.");
        setEmail("");
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error ?? "L'invitation a échoué.");
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-lg border border-dashed p-4 sm:grid-cols-[1fr_11rem_auto] sm:items-end"
      noValidate
    >
      <Field
        label="Inviter un utilisateur"
        htmlFor="user-email"
        error={errors.email}
        hint="Un email d’invitation Clerk est envoyé (tolérant à l’absence de config)."
      >
        <Input
          id="user-email"
          type="email"
          placeholder="prenom@exemple.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </Field>

      <Field label="Rôle" htmlFor="user-role" error={errors.role}>
        <Select
          id="user-role"
          value={role}
          onChange={(event) =>
            setRole(event.target.value as typeof role)
          }
        >
          {PLATFORM_ROLES.map((value) => (
            <option key={value} value={value}>
              {PLATFORM_ROLE_LABELS[value]}
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
  );
}
