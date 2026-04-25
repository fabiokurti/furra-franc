import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = [
    // Bukë Madhe
    { id: 'p-m-tregu',        name: 'MADHE TREGU',               category: 'Bukë Madhe',   price: 120 },
    { id: 'p-m-fshati',       name: 'MADHE FSHATI',              category: 'Bukë Madhe',   price: 120 },
    { id: 'p-m-inte',         name: 'MADHE INTEGRALE',           category: 'Bukë Madhe',   price: 120 },
    // Bukë Vogël
    { id: 'p-thekre',         name: 'VOGEL THEKRE',              category: 'Bukë Vogël',   price: 70  },
    { id: 'p-verdhe',         name: 'VOGEL VERDHE FRANXHOLLE',   category: 'Bukë Vogël',   price: 70  },
    { id: 'p-topa',           name: 'VOGEL ME TOPA',             category: 'Bukë Vogël',   price: 70  },
    { id: 'p-mistri',         name: 'MISTRI',                    category: 'Bukë Vogël',   price: 70  },
    { id: 'p-pizza',          name: 'PIZZA',                     category: 'Bukë Vogël',   price: 90  },
    { id: 'p-kulure',         name: 'KULURE 2 COPE',             category: 'Bukë Vogël',   price: 70  },
    { id: 'p-bagtti',         name: 'BAGETTI',                   category: 'Bukë Vogël',   price: 60  },
    { id: 'p-v-inte',         name: 'VOGEL INTEGRALE',           category: 'Bukë Vogël',   price: 60  },
    { id: 'p-v-zeze',         name: 'VOGEL E ZEZE',              category: 'Bukë Vogël',   price: 60  },
    { id: 'p-v-fshati',       name: 'VOGEL FSHATI',              category: 'Bukë Vogël',   price: 60  },
    { id: 'p-v-tregu',        name: 'VOGEL TREGU',               category: 'Bukë Vogël',   price: 60  },
    // Paninë
    { id: 'p-pani-gj',        name: 'PANINE TE GJATA',           category: 'Paninë',       price: 12  },
    { id: 'p-pani-rr',        name: 'PANINE TE RRUMBULLAKTA',    category: 'Paninë',       price: 12  },
    // Byrek
    { id: 'p-byrek',          name: 'BYREK NORMAL',              category: 'Byrek',        price: 60  },
    { id: 'p-byrek-salcice',  name: 'BYREK ME SALCICE',          category: 'Byrek',        price: 60  },
    { id: 'p-byrek-extra',    name: 'BYREK EXTRA',               category: 'Byrek',        price: 0   },
    { id: 'p-byrek-porosie',  name: 'BYREK POROSIE',             category: 'Byrek',        price: 40  },
    // Ëmbëlsirat
    { id: 'p-torta-8',        name: 'TORTE E VOGEL',             category: 'Ëmbëlsirat',   price: 800 },
    { id: 'p-torta-10',       name: 'TORTAT E TJERA',            category: 'Ëmbëlsirat',   price: 0   },
    { id: 'p-trilece',        name: 'TRILECE',                   category: 'Ëmbëlsirat',   price: 150 },
    { id: 'p-panakota',       name: 'PANA KOTA',                 category: 'Ëmbëlsirat',   price: 0   },
    { id: 'p-pastashiuta',    name: 'PASTASHIUTA',               category: 'Ëmbëlsirat',   price: 0   },
    { id: 'p-binje',          name: 'BINJE',                     category: 'Ëmbëlsirat',   price: 0   },
    { id: 'p-ciskek',         name: 'CISKEK',                    category: 'Ëmbëlsirat',   price: 0   },
    { id: 'p-zupa',           name: 'ZUPA INGLESE',              category: 'Ëmbëlsirat',   price: 0   },
  ];

  // IDs no longer in use — deactivate them
  const deactivate = ['p-torta-7', 'p-torta-pl', 'p-pastina'];

  console.log('🔄 Updating products...');
  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: { name: p.name, category: p.category, price: p.price, isActive: true },
      create: { id: p.id, name: p.name, category: p.category, price: p.price, stock: 0, isActive: true },
    });
    console.log(`  ✓ ${p.name}`);
  }

  for (const id of deactivate) {
    await prisma.product.updateMany({ where: { id }, data: { isActive: false } });
  }

  console.log('\n✅ Products updated successfully!');
  console.log(`   ${products.length} active products`);
  console.log(`   ${deactivate.length} deactivated`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
