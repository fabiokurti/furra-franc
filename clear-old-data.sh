#!/bin/bash
cd /var/www/furra-franc/backend
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function run() {
  // Delete everything up to and including today
  const tomorrow = new Date();
  tomorrow.setUTCHours(0,0,0,0);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  console.log('Deleting all records before:', tomorrow.toISOString());

  // Deliveries
  const delItems = await p.deliveryItem.deleteMany({ where: { delivery: { deliveryDate: { lt: tomorrow } } } });
  const delDel   = await p.delivery.deleteMany({ where: { deliveryDate: { lt: tomorrow } } });
  console.log('Deliveries deleted:', delDel.count, '| Items:', delItems.count);

  // Returns
  const retItems = await p.returnItem.deleteMany({ where: { return: { returnDate: { lt: tomorrow } } } });
  const retDel   = await p.return.deleteMany({ where: { returnDate: { lt: tomorrow } } });
  console.log('Returns deleted:', retDel.count, '| Items:', retItems.count);

  // Daily stock
  const dsItems = await p.dailyStockItem.deleteMany({ where: { dailyStock: { date: { lt: tomorrow } } } });
  const dsDel   = await p.dailyStock.deleteMany({ where: { date: { lt: tomorrow } } });
  console.log('Daily stock deleted:', dsDel.count, '| Items:', dsItems.count);

  await p.\$disconnect();
  console.log('Done.');
}
run().catch(e => { console.error(e.message); process.exit(1); });
"
