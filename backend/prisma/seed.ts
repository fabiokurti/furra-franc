import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning existing data...');
  await prisma.deliveryItem.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.clientProductPrice.deleteMany();
  await prisma.client.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany({ where: { email: { not: 'admin@furrafranc.com' } } });

  // ──────────────────────────────────────────────────────────────
  // ADMIN
  // ──────────────────────────────────────────────────────────────
  console.log('👤 Creating admin...');
  const adminHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@furrafranc.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@furrafranc.com',
      passwordHash: adminHash,
      role: Role.ADMIN,
    },
  });

  // ──────────────────────────────────────────────────────────────
  // STAFF  (16 shpërndarës)
  // ──────────────────────────────────────────────────────────────
  console.log('👷 Creating staff...');
  const staffPassword = await bcrypt.hash('staff123', 10);

  const staffData: { name: string; email: string; role?: Role }[] = [
    { name: 'Lefteri',  email: 'lefteri@furrafranc.com'  },
    { name: 'Fatmiri',  email: 'fatmiri@furrafranc.com'  },
    { name: 'Andrea',   email: 'andrea@furrafranc.com'   },
    { name: 'Urimi',    email: 'urimi@furrafranc.com'    },
    { name: 'Bashkimi', email: 'bashkimi@furrafranc.com' },
    { name: 'Xhulio',   email: 'xhulio@furrafranc.com'   },
    { name: 'Mateo',    email: 'mateo@furrafranc.com'    },
    { name: 'Dilani',   email: 'dilani@furrafranc.com'   },
    { name: 'Luli',     email: 'luli@furrafranc.com'     },
    { name: 'Gezime',   email: 'gezime@furrafranc.com'   },
    { name: 'Fatmira',  email: 'fatmira@furrafranc.com'  },
    { name: 'Elsa',     email: 'elsa@furrafranc.com'     },
    { name: 'Bukurie',  email: 'bukurie@furrafranc.com'  },
    { name: 'Orlanda',  email: 'orlanda@furrafranc.com'  },
    { name: 'Ani',      email: 'ani@furrafranc.com'      },
    { name: 'Xheviti',  email: 'xheviti@furrafranc.com', role: Role.ADMIN },
  ];

  const staffMap: Record<string, string> = {}; // name → id

  for (const s of staffData) {
    const userRole = s.role ?? Role.STAFF;
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: { role: userRole },
      create: {
        name: s.name,
        email: s.email,
        passwordHash: staffPassword,
        role: userRole,
      },
    });
    staffMap[s.name.toLowerCase()] = user.id;
  }

  // ──────────────────────────────────────────────────────────────
  // PRODUCTS  (from PRODHIMI DITOR TOTAL sheet)
  // ──────────────────────────────────────────────────────────────
  console.log('🥖 Creating products...');

  const products = [
    // Miell
    { id: 'p-m-tregu',   name: 'M.TREGU',   description: 'Miell Tregu',         category: 'Miell',   price: 120, stock: 500 },
    { id: 'p-m-fshati',  name: 'M.FSHATI',  description: 'Miell Fshati',        category: 'Miell',   price: 120, stock: 500 },
    { id: 'p-m-inte',    name: 'M.INTE',    description: 'Miell Integral',      category: 'Miell',   price: 120, stock: 500 },
    // Bukë e madhe
    { id: 'p-topa',      name: 'TOPA',      description: 'Bukë Topë',           category: 'Bukë',    price: 70,  stock: 300 },
    { id: 'p-thekre',    name: 'THEKRE',    description: 'Bukë Thekre',         category: 'Bukë',    price: 70,  stock: 300 },
    { id: 'p-verdhe',    name: 'VERDHE',    description: 'Bukë Verdhe',         category: 'Bukë',    price: 70,  stock: 300 },
    { id: 'p-kulure',    name: 'KULURE',    description: 'Kulurë',              category: 'Bukë',    price: 70,  stock: 300 },
    { id: 'p-mistri',    name: 'MISTRI',    description: 'Bukë Mistri',         category: 'Bukë',    price: 70,  stock: 300 },
    { id: 'p-bagtti',    name: 'BAGTTI',    description: 'Baggetti',            category: 'Bukë',    price: 70,  stock: 300 },
    // Vekë
    { id: 'p-v-inte',    name: 'V.INTE',    description: 'Vekë Integrale',      category: 'Vekë',    price: 60,  stock: 300 },
    { id: 'p-v-tregu',   name: 'V.TREGU',   description: 'Vekë Tregu',         category: 'Vekë',    price: 60,  stock: 300 },
    { id: 'p-v-zeze',    name: 'V.ZEZE',    description: 'Vekë e Zezë',        category: 'Vekë',    price: 60,  stock: 300 },
    { id: 'p-v-fshati',  name: 'V.FSHATI',  description: 'Vekë Fshati',        category: 'Vekë',    price: 60,  stock: 300 },
    // Pani
    { id: 'p-pani-gj',   name: 'PANI.GJ',   description: 'Pani Gjysmë',        category: 'Pani',    price: 12,  stock: 500 },
    { id: 'p-pani-rr',   name: 'PANI.RR',   description: 'Pani Rrotull',       category: 'Pani',    price: 12,  stock: 500 },
    // Byrek
    { id: 'p-byrek',     name: 'BYREK',     description: 'Byrek',              category: 'Byrek',   price: 50,  stock: 200 },
    // Tortë
    { id: 'p-torta-7',   name: 'TORTA.7',   description: 'Tortë Nr.7',         category: 'Tortë',   price: 700, stock: 20  },
    { id: 'p-torta-8',   name: 'TORTA.8',   description: 'Tortë Nr.8',         category: 'Tortë',   price: 800, stock: 20  },
    { id: 'p-torta-10',  name: 'TORTA.10',  description: 'Tortë Nr.10',        category: 'Tortë',   price: 1000,stock: 20  },
    { id: 'p-torta-pl',  name: 'TORTA+',    description: 'Tortë Premium',      category: 'Tortë',   price: 1200,stock: 10  },
    // Pastë & Ëmbëlsirë
    { id: 'p-pastina',   name: 'PASTINA',   description: 'Pastinë',            category: 'Pastë',   price: 50,  stock: 200 },
    { id: 'p-trilece',   name: 'TRILECE',   description: 'Trilece',            category: 'Ëmbëlsirë',price: 150, stock: 100 },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: { name: p.name, description: p.description, category: p.category, price: p.price, stock: p.stock },
      create: { id: p.id, name: p.name, description: p.description, category: p.category, price: p.price, stock: p.stock },
    });
  }

  // ──────────────────────────────────────────────────────────────
  // CLIENTS — BASHKIMI
  // ──────────────────────────────────────────────────────────────
  console.log('📋 Creating clients for Bashkimi...');
  const bashkimiId = staffMap['bashkimi'];

  const bashkimiClients = [
    { name: 'BALLIU' },
    { name: 'FURRA.SEK' },
    { name: 'F.DUPI' },
    { name: 'ISMAILI' },
    { name: 'FREDI' },
    { name: 'LUME.XH' },
    { name: 'FURRA.2' },
    { name: 'CERRI' },
    { name: 'GAZI.PAL' },
    { name: 'BALLAJ' },
    { name: 'CIM VIL.B' },
    { name: 'DURI' },
    { name: 'SPARI' },
    { name: 'ST.TRENIT' },
    { name: 'METEOR' },
    { name: 'LUME.SH' },
    { name: 'EXTRA' },
  ];

  for (const c of bashkimiClients) {
    await prisma.client.create({
      data: { name: c.name, staffId: bashkimiId },
    });
  }

  // ──────────────────────────────────────────────────────────────
  // CLIENTS — XHULIO
  // ──────────────────────────────────────────────────────────────
  console.log('📋 Creating clients for Xhulio...');
  const xhulioId = staffMap['xhulio'];

  const xhulioClients = [
    { name: 'NAIMI' },
    { name: 'ULLIRI' },
    { name: 'ALTINI' },
    { name: 'MINAJ' },
    { name: 'LINDITA' },
    { name: 'ELTONI' },
    { name: 'DYLBERJA' },
    { name: 'NEXHI' },
    { name: 'LUANI' },
    { name: 'SHEGA' },
    { name: 'LUME POLOS' },
    { name: 'BONA' },
    { name: 'BEHARI' },
    { name: 'ELONA' },
    { name: 'SOPOTI' },
    { name: 'BUSHI' },
    { name: 'KIPI' },
    { name: 'EXTRA' },
  ];

  for (const c of xhulioClients) {
    await prisma.client.create({
      data: { name: c.name, staffId: xhulioId },
    });
  }

  // ──────────────────────────────────────────────────────────────
  // CLIENTS — MATEO  (Linja Divjakë)
  // ──────────────────────────────────────────────────────────────
  console.log('📋 Creating clients for Mateo (Linja Divjakë)...');
  const mateoId = staffMap['mateo'];

  const mateoClients = [
    { name: 'Beni (PLAKA)',  notes: 'Linja Divjakë' },
    { name: 'L.DEDA',        notes: 'Linja Divjakë' },
    { name: 'YMER.M',        notes: 'Linja Divjakë' },
    { name: 'F.MUCA',        notes: 'Linja Divjakë' },
    { name: 'BEN.MUCA',      notes: 'Linja Divjakë' },
    { name: 'ULLIRI',        notes: 'Linja Divjakë' },
    { name: 'MITATI',        notes: 'Linja Divjakë' },
    { name: 'BESI.M',        notes: 'Linja Divjakë' },
    { name: 'SAJMIRI',       notes: 'Linja Divjakë' },
    { name: 'G.SINA',        notes: 'Linja Divjakë' },
    { name: 'SHKOLLA',       notes: 'Linja Divjakë' },
    { name: 'RIMI',          notes: 'Linja Divjakë' },
    { name: 'F.MURRIZI',     notes: 'Linja Divjakë' },
    { name: 'MEA1',          notes: 'Linja Divjakë' },
    { name: 'MEA2',          notes: 'Linja Divjakë' },
    { name: 'MEA3XENG',      notes: 'Linja Divjakë' },
    { name: 'FERRI',         notes: 'Linja Divjakë' },
    { name: 'SPARI',         notes: 'Linja Divjakë' },
    { name: 'EXTRA',         notes: 'Linja Divjakë' },
  ];

  for (const c of mateoClients) {
    await prisma.client.create({
      data: { name: c.name, notes: c.notes, staffId: mateoId },
    });
  }

  // ──────────────────────────────────────────────────────────────
  // PER-CLIENT PRICES (CMIMET)  — from Excel sheets
  // Columns: mTregu, mFshati, mInte, topa, thekre, verdhe, kulure,
  //          mistri, bagtti, vInte, vTregu, vZeze, vFshati,
  //          paniGj, paniRr, byrek
  // ──────────────────────────────────────────────────────────────
  console.log('💰 Setting per-client prices (CMIMET)...');

  type PriceRow = {
    mTregu: number; mFshati: number; mInte: number;
    topa: number; thekre: number; verdhe: number; kulure: number;
    mistri: number; bagtti: number;
    vInte: number; vTregu: number; vZeze: number; vFshati: number;
    paniGj: number; paniRr: number; byrek: number;
  };

  const productIdMap: Record<string, string> = {
    mTregu: 'p-m-tregu', mFshati: 'p-m-fshati', mInte: 'p-m-inte',
    topa: 'p-topa', thekre: 'p-thekre', verdhe: 'p-verdhe',
    kulure: 'p-kulure', mistri: 'p-mistri', bagtti: 'p-bagtti',
    vInte: 'p-v-inte', vTregu: 'p-v-tregu', vZeze: 'p-v-zeze',
    vFshati: 'p-v-fshati', paniGj: 'p-pani-gj', paniRr: 'p-pani-rr', byrek: 'p-byrek',
  };

  async function setPrices(clientName: string, staffId: string, row: PriceRow) {
    const client = await prisma.client.findFirst({ where: { name: clientName, staffId } });
    if (!client) return;
    const entries = Object.entries(row) as [keyof PriceRow, number][];
    for (const [key, price] of entries) {
      const productId = productIdMap[key];
      if (!productId) continue;
      await prisma.clientProductPrice.upsert({
        where: { clientId_productId: { clientId: client.id, productId } },
        update: { price },
        create: { clientId: client.id, productId, price },
      });
    }
  }

  // ── BASHKIMI clients ──
  const B130: PriceRow = { mTregu:130,mFshati:130,mInte:130,topa:80,thekre:80,verdhe:80,kulure:80,mistri:80,bagtti:80,vInte:70,vTregu:70,vZeze:70,vFshati:70,paniGj:12,paniRr:12,byrek:50 };
  const B120: PriceRow = { mTregu:120,mFshati:120,mInte:120,topa:70,thekre:70,verdhe:70,kulure:70,mistri:70,bagtti:70,vInte:60,vTregu:60,vZeze:60,vFshati:60,paniGj:12,paniRr:12,byrek:50 };
  const B120p: PriceRow = { ...B120, paniGj:15,paniRr:15 }; // some clients pay 15 for pani
  const B130p: PriceRow = { ...B130, paniGj:15,paniRr:15 };

  await setPrices('BALLIU',     bashkimiId, B120);
  await setPrices('FURRA.SEK',  bashkimiId, B130);
  await setPrices('F.DUPI',     bashkimiId, { ...B130, paniGj:15,paniRr:15 });
  await setPrices('ISMAILI',    bashkimiId, B120);
  await setPrices('FREDI',      bashkimiId, B120);
  await setPrices('LUME.XH',    bashkimiId, B120);
  await setPrices('FURRA.2',    bashkimiId, B130);
  await setPrices('CERRI',      bashkimiId, B130);
  await setPrices('GAZI.PAL',   bashkimiId, { ...B130, paniGj:15,paniRr:15 });
  await setPrices('BALLAJ',     bashkimiId, B120);
  await setPrices('CIM VIL.B',  bashkimiId, B120);
  await setPrices('DURI',       bashkimiId, B120);
  await setPrices('SPARI',      bashkimiId, B120);
  await setPrices('ST.TRENIT',  bashkimiId, B120);
  await setPrices('METEOR',     bashkimiId, B120);
  await setPrices('LUME.SH',    bashkimiId, B120);
  await setPrices('EXTRA',      bashkimiId, B130);

  // ── XHULIO clients ──
  const X130: PriceRow = { mTregu:130,mFshati:130,mInte:130,topa:80,thekre:80,verdhe:80,kulure:80,mistri:80,bagtti:80,vInte:70,vTregu:70,vZeze:70,vFshati:70,paniGj:15,paniRr:15,byrek:50 };
  const X120: PriceRow = { mTregu:120,mFshati:120,mInte:120,topa:70,thekre:70,verdhe:70,kulure:70,mistri:70,bagtti:70,vInte:60,vTregu:60,vZeze:60,vFshati:60,paniGj:12,paniRr:12,byrek:50 };
  const X110: PriceRow = { mTregu:110,mFshati:110,mInte:110,topa:70,thekre:70,verdhe:70,kulure:70,mistri:70,bagtti:70,vInte:60,vTregu:60,vZeze:60,vFshati:60,paniGj:15,paniRr:15,byrek:50 };
  const X115: PriceRow = { mTregu:115,mFshati:115,mInte:115,topa:65,thekre:65,verdhe:65,kulure:65,mistri:65,bagtti:65,vInte:55,vTregu:55,vZeze:55,vFshati:55,paniGj:12,paniRr:12,byrek:50 };
  const X130p: PriceRow = { ...X130, paniGj:15,paniRr:15 };

  await setPrices('NAIMI',      xhulioId, X130);
  await setPrices('ULLIRI',     xhulioId, X130);
  await setPrices('ALTINI',     xhulioId, X130);
  await setPrices('MINAJ',      xhulioId, X110);
  await setPrices('LINDITA',    xhulioId, X130);
  await setPrices('ELTONI',     xhulioId, X110);
  await setPrices('DYLBERJA',   xhulioId, X120);
  await setPrices('NEXHI',      xhulioId, X120);
  await setPrices('LUANI',      xhulioId, X115);
  await setPrices('SHEGA',      xhulioId, X120);
  await setPrices('LUME POLOS', xhulioId, X120);
  await setPrices('BONA',       xhulioId, X120);
  await setPrices('BEHARI',     xhulioId, X120);
  await setPrices('ELONA',      xhulioId, X120);
  await setPrices('SOPOTI',     xhulioId, X130p);
  await setPrices('BUSHI',      xhulioId, X120);
  await setPrices('KIPI',       xhulioId, { ...X120, vInte:70,vTregu:70,vZeze:70,vFshati:70 });
  await setPrices('EXTRA',      xhulioId, X130);

  // ── MATEO clients ──
  const M130: PriceRow = { mTregu:130,mFshati:130,mInte:130,topa:80,thekre:80,verdhe:80,kulure:80,mistri:80,bagtti:80,vInte:70,vTregu:70,vZeze:70,vFshati:70,paniGj:15,paniRr:15,byrek:50 };
  const M120: PriceRow = { mTregu:120,mFshati:120,mInte:120,topa:80,thekre:80,verdhe:80,kulure:80,mistri:80,bagtti:80,vInte:70,vTregu:70,vZeze:70,vFshati:70,paniGj:15,paniRr:15,byrek:50 };
  const M120b: PriceRow = { mTregu:120,mFshati:120,mInte:120,topa:70,thekre:70,verdhe:70,kulure:70,mistri:70,bagtti:70,vInte:60,vTregu:60,vZeze:60,vFshati:60,paniGj:10,paniRr:10,byrek:50 };
  const M115: PriceRow = { mTregu:115,mFshati:115,mInte:115,topa:70,thekre:70,verdhe:70,kulure:70,mistri:70,bagtti:70,vInte:60,vTregu:60,vZeze:60,vFshati:60,paniGj:10,paniRr:10,byrek:50 };

  await setPrices('Beni (PLAKA)', mateoId, M130);
  await setPrices('L.DEDA',       mateoId, M130);
  await setPrices('YMER.M',       mateoId, M130);
  await setPrices('F.MUCA',       mateoId, M130);
  await setPrices('BEN.MUCA',     mateoId, M130);
  await setPrices('ULLIRI',       mateoId, M130);
  await setPrices('MITATI',       mateoId, M120);
  await setPrices('BESI.M',       mateoId, M120b);
  await setPrices('SAJMIRI',      mateoId, { ...M120, paniGj:15,paniRr:15 });
  await setPrices('G.SINA',       mateoId, M120b);
  await setPrices('SHKOLLA',      mateoId, M130);
  await setPrices('RIMI',         mateoId, M115);
  await setPrices('F.MURRIZI',    mateoId, M120b);
  await setPrices('MEA1',         mateoId, M120b);
  await setPrices('MEA2',         mateoId, M120b);
  await setPrices('MEA3XENG',     mateoId, M120b);
  await setPrices('FERRI',        mateoId, M120b);
  await setPrices('SPARI',        mateoId, M120b);
  await setPrices('EXTRA',        mateoId, M130);

  // ──────────────────────────────────────────────────────────────
  // SUMMARY
  // ──────────────────────────────────────────────────────────────
  const totalClients = await prisma.client.count();
  const totalProducts = await prisma.product.count();
  const totalStaff = await prisma.user.count({ where: { role: 'STAFF' } });

  console.log('\n✅ Seed complete!');
  console.log(`   👤 Admin:    admin@furrafranc.com / admin123`);
  console.log(`   👷 Staff:    ${totalStaff} shpërndarës (fjalëkalimi: staff123)`);
  console.log(`   🥖 Produkte: ${totalProducts}`);
  console.log(`   🏪 Klientë:  ${totalClients}`);
  console.log('\n📧 Llogaritë e stafit:');
  for (const s of staffData) {
    console.log(`   ${s.name.padEnd(12)} → ${s.email}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
