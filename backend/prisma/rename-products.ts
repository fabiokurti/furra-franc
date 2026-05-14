import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const renames: { oldName: string; newName: string; category: string; price?: number }[] = [
  // Original shortcodes
  { oldName: 'M.TREGU',  newName: 'Madhe Tregu',      category: 'Bukë e Madhe', price: 100 },
  { oldName: 'M.FSHATI', newName: 'Madhe Fshati',     category: 'Bukë e Madhe', price: 120 },
  { oldName: 'M.INTE',   newName: 'Madhe Integrale',  category: 'Bukë e Madhe', price: 120 },
  { oldName: 'TOPA',     newName: 'Topa',              category: 'Bukë' },
  { oldName: 'THEKRE',   newName: 'Thekrore',          category: 'Bukë' },
  { oldName: 'VERDHE',   newName: 'Veroll',            category: 'Bukë' },
  { oldName: 'KULURE',   newName: 'Kulure 2 cope',     category: 'Bukë' },
  { oldName: 'MISTRI',   newName: 'Mistri',            category: 'Bukë' },
  { oldName: 'BAGTTI',   newName: 'Bageti',            category: 'Bukë', price: 60 },
  { oldName: 'V.INTE',   newName: 'Vogel Integrale',  category: 'Vogel' },
  { oldName: 'V.TREGU',  newName: 'Vogel Tregu',      category: 'Vogel' },
  { oldName: 'V.ZEZE',   newName: 'Vogel Zeze',       category: 'Vogel' },
  { oldName: 'V.FSHATI', newName: 'Vogel Fshati',     category: 'Vogel' },
  { oldName: 'PANI.GJ',  newName: 'Panine',           category: 'Pani' },
  { oldName: 'PANI.RR',  newName: 'Panine Rrotull',   category: 'Pani' },
  { oldName: 'BYREK',    newName: 'Byrek',             category: 'Byrek' },

  // Uppercase / alternative names found in live DB
  { oldName: 'MADHE TREGU',     newName: 'Madhe Tregu',     category: 'Bukë e Madhe', price: 100 },
  { oldName: 'MADHE FSHATI',    newName: 'Madhe Fshati',    category: 'Bukë e Madhe', price: 120 },
  { oldName: 'MADHE INTEGRALE', newName: 'Madhe Integrale', category: 'Bukë e Madhe', price: 120 },
  { oldName: 'VOGEL INTEGRALE', newName: 'Vogel Integrale', category: 'Vogel' },
  { oldName: 'VOGEL TREGU',     newName: 'Vogel Tregu',     category: 'Vogel' },
  { oldName: 'VOGEL ZEZE',      newName: 'Vogel Zeze',      category: 'Vogel' },
  { oldName: 'VOGEL E ZEZE',    newName: 'Vogel Zeze',      category: 'Vogel' },
  { oldName: 'VOGEL FSHATI',    newName: 'Vogel Fshati',    category: 'Vogel' },
  { oldName: 'PANINE',          newName: 'Panine',          category: 'Pani' },
  { oldName: 'PANINE RROTULL',  newName: 'Panine Rrotull',  category: 'Pani' },
  { oldName: 'THEKRORE',        newName: 'Thekrore',        category: 'Bukë' },
  { oldName: 'VEROLL',          newName: 'Veroll',          category: 'Bukë' },
  { oldName: 'KULURE 2 COPE',   newName: 'Kulure 2 cope',  category: 'Bukë' },
  { oldName: 'BAGETTI',         newName: 'Bageti',          category: 'Bukë', price: 60 },
  { oldName: 'BYREK NORMAL',    newName: 'Byrek',           category: 'Byrek' },
];

async function main() {
  console.log('✏️  Renaming products...');
  for (const r of renames) {
    const product = await prisma.product.findFirst({ where: { name: r.oldName } });
    if (!product) {
      console.log(`  ⚠️  Not found: ${r.oldName}`);
      continue;
    }
    await prisma.product.update({
      where: { id: product.id },
      data: {
        name: r.newName,
        category: r.category,
        ...(r.price !== undefined ? { price: r.price } : {}),
      },
    });
    console.log(`  ✅  ${r.oldName} → ${r.newName}`);
  }
  console.log('\nDone!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
