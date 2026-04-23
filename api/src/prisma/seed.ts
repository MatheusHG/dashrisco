import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PERMISSIONS = [
  "users:manage",
  "roles:manage",
  "alerts:create",
  "alerts:read",
  "alerts:manage",
  "groups:manage",
  "groups:unlock",
  "logs:read",
  "panel:read",
  "settings:manage",
  "category:sportbook",
  "category:cassino",
  "category:finance",
  "category:blocks",
];

// Permissions that should NOT be auto-granted to the admin role.
// They must be granted manually per role so notification visibility is explicit.
const ADMIN_EXCLUDED_PERMISSIONS = new Set([
  "category:sportbook",
  "category:cassino",
  "category:finance",
  "category:blocks",
]);

async function main() {
  console.log("Seeding database...");

  // Create permissions
  const permissions = await Promise.all(
    PERMISSIONS.map((action) =>
      prisma.permission.upsert({
        where: { action },
        update: {},
        create: { action },
      })
    )
  );

  console.log(`Created ${permissions.length} permissions`);

  // Create admin role with all permissions EXCEPT category:* (manual grant)
  const adminDefaultPermissions = permissions.filter(
    (p) => !ADMIN_EXCLUDED_PERMISSIONS.has(p.action)
  );
  const adminRole = await prisma.role.upsert({
    where: { name: "admin" },
    update: {
      // Keep category:* as-is on existing admin role; only reconcile the rest
      permissions: {
        connect: adminDefaultPermissions.map((p) => ({ id: p.id })),
      },
    },
    create: {
      name: "admin",
      description: "Administrador com acesso total",
      permissions: {
        connect: adminDefaultPermissions.map((p) => ({ id: p.id })),
      },
    },
  });

  console.log(`Created admin role: ${adminRole.id}`);

  // Create operator role
  const operatorPermissions = permissions.filter((p) =>
    [
      "alerts:create",
      "alerts:read",
      "groups:manage",
      "groups:unlock",
      "panel:read",
    ].includes(p.action)
  );

  const operatorRole = await prisma.role.upsert({
    where: { name: "operador" },
    update: {
      // connect (não set) para preservar grants manuais como category:*
      permissions: {
        connect: operatorPermissions.map((p) => ({ id: p.id })),
      },
    },
    create: {
      name: "operador",
      description: "Operador com acesso a alertas e grupos",
      permissions: {
        connect: operatorPermissions.map((p) => ({ id: p.id })),
      },
    },
  });

  console.log(`Created operator role: ${operatorRole.id}`);

  // Create viewer role
  const viewerPermissions = permissions.filter((p) =>
    ["alerts:read", "panel:read", "logs:read"].includes(p.action)
  );

  const viewerRole = await prisma.role.upsert({
    where: { name: "visualizador" },
    update: {
      // connect (não set) para preservar grants manuais como category:*
      permissions: {
        connect: viewerPermissions.map((p) => ({ id: p.id })),
      },
    },
    create: {
      name: "visualizador",
      description: "Visualizador com acesso somente leitura",
      permissions: {
        connect: viewerPermissions.map((p) => ({ id: p.id })),
      },
    },
  });

  console.log(`Created viewer role: ${viewerRole.id}`);

  // Create default admin user
  const hashedPassword = await bcrypt.hash("v065pokx", 10);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@jbdbrasil.com.br" },
    update: { password: hashedPassword },
    create: {
      name: "Administrador",
      email: "admin@jbdbrasil.com.br",
      password: hashedPassword,
      roleId: adminRole.id,
    },
  });

  console.log(`Created admin user: ${adminUser.email}`);

  // Seed app configs (SB API)
  const configs = [
    { key: "SB_API_BASE_URL", value: "https://loterias-dashboard.ngx.bet", label: "URL base da API SB" },
    { key: "SB_API_TOKEN", value: "f3430f80-1897-4f59-8555-7d188a9b25af", label: "Token de autenticação SB" },
    { key: "SB_API_REFERER", value: "https://dashboard.marjosports.com.br/", label: "Referer da API SB" },
  ];

  for (const cfg of configs) {
    await prisma.appConfig.upsert({
      where: { key: cfg.key },
      update: {},
      create: cfg,
    });
  }

  console.log(`Seeded ${configs.length} app configs`);

  console.log("\nSeed completed!");
  console.log("Default login: admin@jbdbrasil.com.br / v065pokx");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
