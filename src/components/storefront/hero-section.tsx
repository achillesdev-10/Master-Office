"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShoppingBag, Truck, Shield, Headphones } from "lucide-react";

interface HeroSectionProps {
  tenant: {
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
  };
}

export function HeroSection({ tenant }: HeroSectionProps) {
  const primaryColor = tenant.primaryColor ?? "#111827";

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-muted/50 to-transparent">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <ShoppingBag className="size-4" aria-hidden />
              Bienvenue chez {tenant.name}
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              {tenant.description ?? "Découvrez nos produits de qualité"}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl">
              Livraison rapide • Paiement sécurisé • Satisfaction garantie
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href={`/store/${tenant.slug}/products`}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Voir la boutique
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href={`/store/${tenant.slug}/products?category=nouveautes`}
                className="inline-flex items-center gap-2 rounded-lg border bg-background px-6 py-3 text-base font-medium hover:bg-muted transition-colors"
              >
                Nouveautés
              </Link>
            </div>
          </div>

          <div className="relative">
            {tenant.logoUrl ? (
              <div
                className="relative aspect-square max-w-md mx-auto rounded-2xl overflow-hidden shadow-2xl ring-1 ring-primary/20"
                style={{ background: primaryColor }}
              >
                <Image
                  src={tenant.logoUrl}
                  alt={tenant.name}
                  fill
                  className="object-contain p-8"
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            ) : (
              <div
                className="relative aspect-square max-w-md mx-auto rounded-2xl overflow-hidden shadow-2xl ring-1 ring-primary/20 flex items-center justify-center"
                style={{ background: primaryColor }}
              >
                <ShoppingBag className="size-24 text-primary-foreground/20" aria-hidden />
              </div>
            )}

            {/* Trust badges */}
            <div className="mt-8 grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
              <div className="p-4 rounded-lg bg-background/50 border">
                <Truck className="mx-auto mb-2 size-6 text-primary" aria-hidden />
                <p className="text-sm font-medium">Livraison rapide</p>
                <p className="text-xs text-muted-foreground">Partout en Côte d&apos;Ivoire</p>
              </div>
              <div className="p-4 rounded-lg bg-background/50 border">
                <Shield className="mx-auto mb-2 size-6 text-primary" aria-hidden />
                <p className="text-sm font-medium">Paiement sécurisé</p>
                <p className="text-xs text-muted-foreground">Orange Money, MTN, Wave...</p>
              </div>
              <div className="p-4 rounded-lg bg-background/50 border">
                <Headphones className="mx-auto mb-2 size-6 text-primary" aria-hidden />
                <p className="text-sm font-medium">Support 7j/7</p>
                <p className="text-xs text-muted-foreground">Équipe à votre écoute</p>
              </div>
              <div className="p-4 rounded-lg bg-background/50 border">
                <ShoppingBag className="mx-auto mb-2 size-6 text-primary" aria-hidden />
                <p className="text-sm font-medium">Satisfait ou remboursé</p>
                <p className="text-xs text-muted-foreground">Retour sous 14 jours</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}