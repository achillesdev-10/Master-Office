import {
  PrismaClient,
  Role,
  SslStatus,
  SubscriptionStatus,
  TenantStatus,
} from "@prisma/client";

/**
 * Seed de démonstration — modules 1 à 15.
 * Idempotent : rejouable sans dupliquer de données (upserts / gardes).
 *
 * Couvre : Super Admin, plans (prix/features), thèmes (descriptions,
 * catégorie, premium), utilisateurs, boutiques, domaines, membres,
 * abonnements, journal d'activité (entité/IP) et paramètres plateforme.
 *
 * Exécution : pnpm db:seed   (requiert DATABASE_URL et une base accessible)
 */
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seed : démarrage");

  // ----------------------------------------------------------------
  // 1. Super Admin (clerkId placeholder — à remplacer par le vrai ID
  //    Clerk après la création du compte dans le dashboard Clerk)
  // ----------------------------------------------------------------
  const superAdmin = await prisma.user.upsert({
    where: { clerkId: "user_super_admin_placeholder" },
    update: { role: Role.SUPER_ADMIN },
    create: {
      clerkId: "user_super_admin_placeholder",
      email: "admin@maboutique.com",
      role: Role.SUPER_ADMIN,
    },
  });
  console.log(`  ✔ Super Admin : ${superAdmin.email}`);

  // ----------------------------------------------------------------
  // 2. Plans (module 10 : prix en centimes, devise, features)
  // ----------------------------------------------------------------
  const plansData = [
    {
      name: "Starter",
      slug: "starter",
      price: 1900,
      currency: "EUR",
      features: ["1 boutique", "Thèmes standards", "Support email"],
    },
    {
      name: "Pro",
      slug: "pro",
      price: 4900,
      currency: "EUR",
      features: [
        "3 boutiques",
        "Thèmes premium",
        "Domaines personnalisés",
        "Support prioritaire",
      ],
    },
    {
      name: "Business",
      slug: "business",
      price: 9900,
      currency: "EUR",
      features: [
        "Boutiques illimitées",
        "Tous les thèmes",
        "API & webhooks",
        "Support dédié 7j/7",
      ],
    },
  ] as const;

  const plans: Record<string, string> = {};
  for (const plan of plansData) {
    const row = await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
        features: [...plan.features],
      },
      create: { ...plan, features: [...plan.features] },
    });
    plans[plan.slug] = row.id;
  }
  console.log(`  ✔ Plans : ${plansData.map((p) => p.name).join(", ")}`);

  // ----------------------------------------------------------------
  // 3. Thèmes (module 11 : description + aperçu)
  //    previewUrl reste null → l'UI génère un aperçu dégradé.
  // ----------------------------------------------------------------
  const themesData = [
    {
      name: "Mode 01",
      slug: "mode-01",
      category: "mode",
      isPremium: false,
      description:
        "Vitrine éditoriale dédiée à la mode : grilles amples, typographie affirmée et lookbook en une page.",
    },
    {
      name: "Cosmétique 01",
      slug: "cosmetique-01",
      category: "cosmetique",
      isPremium: true,
      description:
        "Univers doux et lumineux pour la cosmétique : tons pastel et fiches produits riches en visuels.",
    },
    {
      name: "Électronique 01",
      slug: "electronique-01",
      category: "electronique",
      isPremium: false,
      description:
        "Catalogue dense et performant pour l’électronique : filtres techniques et caractéristiques détaillées.",
    },
  ] as const;

  const themes: Record<string, string> = {};
  for (const theme of themesData) {
    const row = await prisma.theme.upsert({
      where: { slug: theme.slug },
      update: {
        name: theme.name,
        description: theme.description,
        category: theme.category,
        isPremium: theme.isPremium,
      },
      create: theme,
    });
    themes[theme.slug] = row.id;
  }
  console.log(`  ✔ Thèmes : ${themesData.map((t) => t.slug).join(", ")}`);

  // ----------------------------------------------------------------
  // 4. Utilisateurs de démo (clerkId placeholder) — rôles variés
  //    pour la page /admin/users (module 9).
  // ----------------------------------------------------------------
  const usersData = [
    { clerkId: "user_demo_owner_mode", email: "owner@example.com", role: Role.ADMIN },
    { clerkId: "user_demo_staff_mode", email: "staff@example.com", role: Role.MEMBER },
    { clerkId: "user_demo_admin_tech", email: "admin@example.com", role: Role.ADMIN },
  ] as const;

  const users: Record<string, string> = {};
  for (const user of usersData) {
    const row = await prisma.user.upsert({
      where: { clerkId: user.clerkId },
      update: { email: user.email, role: user.role },
      create: user,
    });
    users[user.email] = row.id;
  }
  console.log(`  ✔ Utilisateurs : ${usersData.map((u) => u.email).join(", ")}`);

  // ----------------------------------------------------------------
  // 5. Tenants de démonstration + domaines + membres + abonnements
  // ----------------------------------------------------------------
  const tenantsData = [
    {
      name: "Ma Boutique Mode",
      slug: "ma-boutique-mode",
      status: TenantStatus.ACTIVE,
      planId: plans["starter"],
      themeId: themes["mode-01"],
      domain: "ma-boutique-mode.example.com",
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      members: [
        { email: "owner@example.com", role: Role.ADMIN },
        { email: "staff@example.com", role: Role.MEMBER },
      ],
    },
    {
      name: "TechStore Démo",
      slug: "techstore-demo",
      status: TenantStatus.ACTIVE,
      planId: plans["pro"],
      themeId: themes["electronique-01"],
      domain: "techstore-demo.example.com",
      subscriptionStatus: SubscriptionStatus.TRIAL,
      members: [{ email: "admin@example.com", role: Role.ADMIN }],
    },
    {
      // Brouillon sans plan → visible dans « Sans abonnement » (module 10)
      // et dans le formulaire d'attribution.
      name: "Bazar Démo",
      slug: "bazar-demo",
      status: TenantStatus.DRAFT,
      planId: undefined,
      themeId: themes["cosmetique-01"],
      domain: "bazar-demo.example.com",
      subscriptionStatus: null,
      members: [],
    },
  ] as const;

  const tenantsBySlug: Record<string, string> = {};
  const domainsBySlug: Record<string, string> = {};

  for (const tenant of tenantsData) {
    const row = await prisma.tenant.upsert({
      where: { slug: tenant.slug },
      update: {
        name: tenant.name,
        status: tenant.status,
        planId: tenant.planId ?? null,
        themeId: tenant.themeId ?? null,
      },
      create: {
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        planId: tenant.planId ?? null,
        themeId: tenant.themeId ?? null,
      },
    });
    tenantsBySlug[tenant.slug] = row.id;

    // Domaine principal (unique)
    const domainRow = await prisma.tenantDomain.upsert({
      where: { domain: tenant.domain },
      update: { tenantId: row.id, sslStatus: SslStatus.ACTIVE },
      create: {
        domain: tenant.domain,
        sslStatus: SslStatus.ACTIVE,
        tenantId: row.id,
      },
    });
    domainsBySlug[tenant.slug] = domainRow.id;

    // Membres
    for (const member of tenant.members) {
      const userId = users[member.email];
      if (!userId) throw new Error(`Utilisateur introuvable : ${member.email}`);
      await prisma.tenantUser.upsert({
        where: { tenantId_userId: { tenantId: row.id, userId } },
        update: { role: member.role },
        create: { tenantId: row.id, userId, role: member.role },
      });
    }

    // Abonnement (module 10) — période de 30 jours autour de la création
    if (row.planId && tenant.subscriptionStatus) {
      const startedAt = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000);
      const currentPeriodEnd = new Date(Date.now() + 18 * 24 * 60 * 60 * 1000);
      await prisma.subscription.upsert({
        where: { tenantId: row.id },
        update: {
          planId: row.planId,
          status: tenant.subscriptionStatus,
          canceledAt: null,
        },
        create: {
          tenantId: row.id,
          planId: row.planId,
          status: tenant.subscriptionStatus,
          startedAt,
          currentPeriodEnd,
        },
      });
    }

    console.log(
      `  ✔ Tenant : ${row.name} (${tenant.domain}, ${tenant.members.length} membre(s))`,
    );
  }

  // ----------------------------------------------------------------
  // 6. Journal d'activité (module 12) — 1 insertion, puis jamais
  // ----------------------------------------------------------------
  const auditCount = await prisma.auditLog.count();
  if (auditCount === 0) {
    const now = Date.now();
    const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000);

    const entries = [
      {
        action: "tenant.create",
        userId: superAdmin.id,
        tenantId: tenantsBySlug["ma-boutique-mode"] ?? null,
        entity: "Tenant",
        entityId: tenantsBySlug["ma-boutique-mode"] ?? null,
        ip: "127.0.0.1",
        metadata: { source: "seed", plan: "starter" },
        createdAt: minutesAgo(180),
      },
      {
        action: "domain.verify",
        userId: superAdmin.id,
        tenantId: tenantsBySlug["ma-boutique-mode"] ?? null,
        entity: "Domain",
        entityId: domainsBySlug["ma-boutique-mode"] ?? null,
        ip: "127.0.0.1",
        metadata: { domain: "ma-boutique-mode.example.com", ok: true },
        createdAt: minutesAgo(120),
      },
      {
        action: "subscription.assign",
        userId: superAdmin.id,
        tenantId: tenantsBySlug["techstore-demo"] ?? null,
        entity: "Subscription",
        entityId: tenantsBySlug["techstore-demo"] ?? null,
        ip: "127.0.0.1",
        metadata: { plan: "pro", status: "TRIAL" },
        createdAt: minutesAgo(90),
      },
      {
        action: "user.invite",
        userId: superAdmin.id,
        tenantId: null,
        entity: "User",
        entityId: null,
        ip: "127.0.0.1",
        metadata: { email: "support@example.com", role: "MEMBER" },
        createdAt: minutesAgo(60),
      },
      {
        action: "theme.update",
        userId: superAdmin.id,
        tenantId: null,
        entity: "Theme",
        entityId: themes["mode-01"] ?? null,
        ip: "127.0.0.1",
        metadata: { slug: "mode-01", field: "description" },
        createdAt: minutesAgo(30),
      },
      {
        action: "plan.create",
        userId: superAdmin.id,
        tenantId: null,
        entity: "Plan",
        entityId: plans["business"] ?? null,
        ip: "127.0.0.1",
        metadata: { slug: "business", name: "Business" },
        createdAt: minutesAgo(5),
      },
    ];

    await prisma.auditLog.createMany({ data: entries });
    console.log(`  ✔ Audit : ${entries.length} entrées`);
  } else {
    console.log(`  ✔ Audit : ${auditCount} entrées existantes (ignoré)`);
  }

  // ----------------------------------------------------------------
  // 7. Paramètres de la plateforme (module 13) — valeurs par défaut.
  //    `update: {}` : une valeur déjà saisie dans /admin/settings
  //    n'est jamais écrasée par le seed.
  // ----------------------------------------------------------------
  const settingsSeed = [
    {
      key: "settings.general",
      value: {
        platformName: "Master Admin",
        rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "maboutique.com",
        supportEmail: "support@maboutique.com",
        defaultCurrency: "EUR",
        maintenanceMode: false,
      },
    },
    {
      key: "settings.security",
      value: {
        require2fa: false,
        sessionTimeoutHours: 24,
        auditRetentionDays: 90,
        ipAllowlist: "",
      },
    },
  ] as const;

  for (const setting of settingsSeed) {
    await prisma.platformSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: { key: setting.key, value: setting.value },
    });
  }
  console.log(`  ✔ Paramètres : ${settingsSeed.length} sections`);

  console.log("🌱 Seed : terminé ✔");
}

main()
  .catch((error) => {
    console.error("Seed en échec :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
