#!/bin/bash
cd /var/www/furra-franc/backend
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function run() {
  const today = new Date();
  today.setUTCHours(0,0,0,0);
  console.log('Deleting records before:', today.toISOString());

  // Deliveries
  const delItems = await p.deliveryItem.deleteMany({ where: { delivery: { deliveryDate: { lt: today } } } });
  const delDel   = await p.delivery.deleteMany({ where: { deliveryDate: { lt: today } } });
  console.log('Deliveries deleted:', delDel.count, '| Items:', delItems.count);

  // Returns
  const retItems = await p.returnItem.deleteMany({ where: { return: { returnDate: { lt: today } } } });
  const retDel   = await p.return.deleteMany({ where: { returnDate: { lt: today } } });
  console.log('Returns deleted:', retDel.count, '| Items:', retItems.count);

  // Daily stock
  const dsItems = await p.dailyStockItem.deleteMany({ where: { dailyStock: { date: { lt: today } } } });
  const dsDel   = await p.dailyStock.deleteMany({ where: { date: { lt: today } } });
  console.log('Daily stock deleted:', dsDel.count, '| Items:', dsItems.count);

  await p.\$disconnect();
  console.log('Done.');
}
run().catch(e => { console.error(e.message); process.exit(1); });
"
