// Seed script: creates the admin account and (optionally) demo data.
// Local:      npm run db:seed
// On server:  docker compose exec web node prisma/seed.mjs
// Safe to run more than once (it skips anything that already exists).

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function upsertUser({ email, name, password, role, barId = null }) {
  return db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name,
      role,
      barId,
      passwordHash: await bcrypt.hash(password, 10),
      dob: new Date("1990-01-01"),
    },
  });
}

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@sipvault.local").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe@123";
  await upsertUser({ email: adminEmail, name: "Platform Admin", password: adminPassword, role: "ADMIN" });
  console.log(`Admin: ${adminEmail}`);

  if (process.env.SEED_DEMO === "false") return;

  let bar = await db.bar.findFirst({ where: { name: "The Oak Room (Demo)" } });
  if (!bar) {
    bar = await db.bar.create({
      data: { name: "The Oak Room (Demo)", address: "12 MG Road", city: "Mumbai", licenseNo: "DEMO-001", keepDays: 90 },
    });
  }

  await upsertUser({ email: "owner@demo.local", name: "Demo Owner", password: "Demo@1234", role: "BAR_OWNER", barId: bar.id });
  await upsertUser({ email: "staff@demo.local", name: "Demo Bartender", password: "Demo@1234", role: "BAR_STAFF", barId: bar.id });
  await upsertUser({ email: "guest@demo.local", name: "Demo Guest", password: "Demo@1234", role: "CUSTOMER" });

  const catalog = [
    { brand: "Glenfiddich", name: "12 Year Old", category: "Whisky", volumeMl: 750, price: 650000 },
    { brand: "Johnnie Walker", name: "Black Label", category: "Whisky", volumeMl: 750, price: 520000 },
    { brand: "Absolut", name: "Original", category: "Vodka", volumeMl: 750, price: 280000 },
    { brand: "Bombay Sapphire", name: "London Dry", category: "Gin", volumeMl: 750, price: 340000 },
    { brand: "Old Monk", name: "XXX Rum", category: "Rum", volumeMl: 750, price: 120000 },
  ];

  for (const item of catalog) {
    let product = await db.product.findFirst({ where: { brand: item.brand, name: item.name } });
    if (!product) {
      product = await db.product.create({
        data: { brand: item.brand, name: item.name, category: item.category, volumeMl: item.volumeMl },
      });
    }
    await db.barProduct.upsert({
      where: { barId_productId: { barId: bar.id, productId: product.id } },
      update: {},
      create: { barId: bar.id, productId: product.id, priceMinor: item.price, pegSizeMl: 30 },
    });
  }

  for (let i = 1; i <= 6; i++) {
    await db.barTable.upsert({
      where: { barId_tableNo: { barId: bar.id, tableNo: String(i) } },
      update: {},
      create: { barId: bar.id, tableNo: String(i) },
    });
  }

  console.log("Demo data ready:");
  console.log("  Bar owner : owner@demo.local / Demo@1234");
  console.log("  Bartender : staff@demo.local / Demo@1234");
  console.log("  Customer  : guest@demo.local / Demo@1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
