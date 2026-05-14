/**
 * ensure-delivery-products.ts
 *
 * Does NOT rename or delete any existing products.
 * Only creates missing canonical delivery products and sets showInDelivery = true
 * on any that already exist (matched by name).
 *
 * Usage:
 *   cd /var/www/furra-franc/backend
 *   npx ts-node prisma/ensure-delivery-products.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PRODUCTS: { name: string; category: string; price: number }[] = [
  // Pani
  { name: 'Panine',          category: 'Pani',         price: 30  },
  { name: 'Panine Rrotull',  category: 'Pani',         price: 30  },
  // Vogel
  { name: 'Vogel Integrale', category: 'Vogel',        price: 80  },
  { name: 'Vogel Tregu',     category: 'Vogel',        price: 70  },
  { name: 'Vogel Zeze',      category: 'Vogel',        price: 70  },
  { name: 'Vogel Fshati',    category: 'Vogel',        price: 80  },
  // Bukë
  { name: 'Topa',            category: 'Bukë',         price: 50  },
  { name: 'Thekrore',        category: 'Bukë',         price: 90  },
  { name: 'Veroll',          category: 'Bukë',         price: 80  },
  { name: 'Kulure 2 cope',   category: 'Bukë',         price: 80  },
  { name: 'Mistri',          category: 'Bukë',         price: 60  },
  { name: 'Bageti',          category: 'Bukë',         price: 60  },
  // Bukë e Madhe
  { name: 'Madhe Tregu',     category: 'Bukë e Madhe', price: 100 },
  { name: 'Madhe Fshati',    category: 'Bukë e Madhe', price: 120 },
  { name: 'Madhe Integrale', category: 'Bukë e Madhe', price: 120 },
  // Byrek
  { name: 'Byrek',           category: 'Byrek',        price: 150 },
];

async function main() {
  console.log('Ensuring delivery products exist...\n');

  for (const p of PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { category: p.category, showInDelivery: true },
      });
      console.log(`  ✅  Exists — updated category/showInDelivery: "${p.name}"`);
    } else {
      await prisma.product.create({
        data: {
          name: p.name,
          category: p.category,
          price: p.price,
          stock: 0,
          isActive: true,
          showInDelivery: true,
        },
      });
      console.log(`  ➕  Created: "${p.name}" (${p.category})`);
    }
  }

  const all = await prisma.product.findMany({ where: { showInDelivery: true }, orderBy: { category: 'asc' } });
  console.log(`\n✔  Done. ${all.length} products now visible in delivery form:`);
  all.forEach((p) => console.log(`     ${p.category.padEnd(14)} ${p.name}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
