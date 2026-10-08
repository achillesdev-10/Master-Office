import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion",
};

export default function LoginPage() {
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Super Admin</h1>
        <p className="text-sm text-muted-foreground">
          Connecte-toi pour accéder à la console d&apos;administration.
        </p>
      </div>

      {/* Formulaire Clerk (mot de passe géré exclusivement par Clerk) */}
      <SignIn path="/login" routing="path" forceRedirectUrl="/admin" />
    </div>
  );
}
