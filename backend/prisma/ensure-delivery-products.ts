/**
 * ensure-delivery-products.ts
 *
 * Run this on the server after deploying to make sure all delivery products
 * exist with correct names, categories and showInDelivery = true.
 *
 * Usage:
 *   cd /var/www/furra-franc/backend
 *   npx ts-node prisma/ensure-delivery-products.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Old name → canonical product mapping (for renaming existing records)
const RENAMES: { oldName: string; canonicalName: string }[] = [
  // original shortcodes
  { oldName: 'M.TREGU',         canonicalName: 'Madhe Tregu' },
  { oldName: 'M.FSHATI',        canonicalName: 'Madhe Fshati' },
  { oldName: 'M.INTE',          canonicalName: 'Madhe Integrale' },
  { oldName: 'TOPA',            canonicalName: 'Topa' },
  { oldName: 'THEKRE',          canonicalName: 'Thekrore' },
  { oldName: 'VERDHE',          canonicalName: 'Veroll' },
  { oldName: 'KULURE',          canonicalName: 'Kulure 2 cope' },
  { oldName: 'MISTRI',          canonicalName: 'Mistri' },
  { oldName: 'BAGTTI',          canonicalName: 'Bageti' },
  { oldName: 'V.INTE',          canonicalName: 'Vogel Integrale' },
  { oldName: 'V.TREGU',         canonicalName: 'Vogel Tregu' },
  { oldName: 'V.ZEZE',          canonicalName: 'Vogel Zeze' },
  { oldName: 'V.FSHATI',        canonicalName: 'Vogel Fshati' },
  { oldName: 'PANI.GJ',         canonicalName: 'Panine' },
  { oldName: 'PANI.RR',         canonicalName: 'Panine Rrotull' },
  { oldName: 'BYREK',           canonicalName: 'Byrek' },
  // uppercase / alternative names from live DB
  { oldName: 'MADHE TREGU',     canonicalName: 'Madhe Tregu' },
  { oldName: 'MADHE FSHATI',    canonicalName: 'Madhe Fshati' },
  { oldName: 'MADHE INTEGRALE', canonicalName: 'Madhe Integrale' },
  { oldName: 'VOGEL INTEGRALE', canonicalName: 'Vogel Integrale' },
  { oldName: 'VOGEL TREGU',     canonicalName: 'Vogel Tregu' },
  { oldName: 'VOGEL ZEZE',      canonicalName: 'Vogel Zeze' },
  { oldName: 'VOGEL E ZEZE',    canonicalName: 'Vogel Zeze' },
  { oldName: 'VOGEL FSHATI',    canonicalName: 'Vogel Fshati' },
  { oldName: 'PANINE',          canonicalName: 'Panine' },
  { oldName: 'PANINE RROTULL',  canonicalName: 'Panine Rrotull' },
  { oldName: 'THEKRORE',        canonicalName: 'Thekrore' },
  { oldName: 'VEROLL',          canonicalName: 'Veroll' },
  { oldName: 'KULURE 2 COPE',   canonicalName: 'Kulure 2 cope' },
  { oldName: 'BAGETTI',         canonicalName: 'Bageti' },
  { oldName: 'BYREK NORMAL',    canonicalName: 'Byrek' },
];

// All canonical delivery products with their correct data
const PRODUCTS: { name: string; category: string; price: number; stock: number }[] = [
  // Pani
  { name: 'Panine',          category: 'Pani',        price: 30,  stock: 0 },
  { name: 'Panine Rrotull',  category: 'Pani',        price: 30,  stock: 0 },
  // Vogel
  { name: 'Vogel Integrale', category: 'Vogel',       price: 80,  stock: 0 },
  { name: 'Vogel Tregu',     category: 'Vogel',       price: 70,  stock: 0 },
  { name: 'Vogel Zeze',      category: 'Vogel',       price: 70,  stock: 0 },
  { name: 'Vogel Fshati',    category: 'Vogel',       price: 80,  stock: 0 },
  // Bukë
  { name: 'Topa',            category: 'Bukë',        price: 50,  stock: 0 },
  { name: 'Thekrore',        category: 'Bukë',        price: 90,  stock: 0 },
  { name: 'Veroll',          category: 'Bukë',        price: 80,  stock: 0 },
  { name: 'Kulure 2 cope',   category: 'Bukë',        price: 80,  stock: 0 },
  { name: 'Mistri',          category: 'Bukë',        price: 60,  stock: 0 },
  { name: 'Bageti',          category: 'Bukë',        price: 60,  stock: 0 },
  // Bukë e Madhe
  { name: 'Madhe Tregu',     category: 'Bukë e Madhe', price: 100, stock: 0 },
  { name: 'Madhe Fshati',    category: 'Bukë e Madhe', price: 120, stock: 0 },
  { name: 'Madhe Integrale', category: 'Bukë e Madhe', price: 120, stock: 0 },
  // Byrek
  { name: 'Byrek',           category: 'Byrek',       price: 150, stock: 0 },
];

async function main() {
  // Step 1: rename old-named products to canonical names
  console.log('Step 1: Renaming old product names...');
  for (const r of RENAMES) {
    const existing = await prisma.product.findFirst({ where: { name: r.oldName } });
    if (!existing) continue;
    // Only rename if canonical doesn't already exist (avoid duplicate)
    const canonical = await prisma.product.findFirst({ where: { name: r.canonicalName } });
    if (canonical) {
      // Canonical already exists — delete the old-named duplicate
      await prisma.product.delete({ where: { id: existing.id } }).catch(() => {});
      console.log(`  🗑  Deleted duplicate old-name "${r.oldName}" (canonical "${r.canonicalName}" exists)`);
    } else {
      await prisma.product.update({ where: { id: existing.id }, data: { name: r.canonicalName } });
      console.log(`  ✏️  "${r.oldName}" → "${r.canonicalName}"`);
    }
  }

  // Step 2: upsert all canonical products — create if missing, fix category + showInDelivery
  console.log('\nStep 2: Upserting canonical products...');
  for (const p of PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { category: p.category, showInDelivery: true },
      });
      console.log(`  ✅  Updated: "${p.name}" (category=${p.category})`);
    } else {
      await prisma.product.create({
        data: {
          name: p.name,
          category: p.category,
          price: p.price,
          stock: p.stock,
          isActive: true,
          showInDelivery: true,
        },
      });
      console.log(`  ➕  Created: "${p.name}" (category=${p.category})`);
    }
  }

  // Summary
  const all = await prisma.product.findMany({ where: { showInDelivery: true } });
  console.log(`\n✔  Done. ${all.length} products visible in delivery form:`);
  all.forEach((p) => console.log(`     ${p.category.padEnd(14)} ${p.name}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
