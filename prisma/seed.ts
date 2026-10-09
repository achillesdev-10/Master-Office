import {
  PrismaClient,
  Role,
  SslStatus,
  TenantStatus,
} from "@prisma/client";

/**
 * Seed de démonstration — modules 1 à 15.
 * Idempotent : rejouable sans dupliquer de données (upserts / gardes).
 *
 * Couvre : Super Admin, thèmes (descriptions,
 * catégorie, premium), utilisateurs, boutiques, domaines, membres,
 * journal d'activité (entité/IP) et paramètres plateforme.
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
  // 2. Thèmes (module 11 : description + aperçu)
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
        "Catalogue dense et performant pour l'électronique : filtres techniques et caractéristiques détaillées.",
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
  // 3. Utilisateurs de démo (clerkId placeholder) — rôles variés
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
  // 4. Tenants de démonstration + domaines + membres
  // ----------------------------------------------------------------
  const tenantsData = [
    {
      name: "Ma Boutique Mode",
      slug: "ma-boutique-mode",
      status: TenantStatus.ACTIVE,
      themeId: themes["mode-01"],
      domain: "ma-boutique-mode.example.com",
      members: [
        { email: "owner@example.com", role: Role.ADMIN },
        { email: "staff@example.com", role: Role.MEMBER },
      ],
    },
    {
      name: "TechStore Démo",
      slug: "techstore-demo",
      status: TenantStatus.ACTIVE,
      themeId: themes["electronique-01"],
      domain: "techstore-demo.example.com",
      members: [{ email: "admin@example.com", role: Role.ADMIN }],
    },
    {
      name: "Bazar Démo",
      slug: "bazar-demo",
      status: TenantStatus.DRAFT,
      themeId: themes["cosmetique-01"],
      domain: "bazar-demo.example.com",
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
        themeId: tenant.themeId ?? null,
      },
      create: {
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
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

    console.log(
      `  ✔ Tenant : ${row.name} (${tenant.domain}, ${tenant.members.length} membre(s))`,
    );
  }

  // ----------------------------------------------------------------
  // 5. Journal d'activité (module 12) — 1 insertion, puis jamais
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
        metadata: { source: "seed" },
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
    ];

    await prisma.auditLog.createMany({ data: entries });
    console.log(`  ✔ Audit : ${entries.length} entrées`);
  } else {
    console.log(`  ✔ Audit : ${auditCount} entrées existantes (ignoré)`);
  }

  // ----------------------------------------------------------------
  // 6. Paramètres de la plateforme (module 13) — valeurs par défaut.
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
        defaultCurrency: "XOF",
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