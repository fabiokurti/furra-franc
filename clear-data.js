// Run once on the server: node clear-data.js
// Deletes all Deliveries and DailyStocks (child rows cascade automatically).
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const deliveries  = await prisma.delivery.deleteMany({});
  const dailyStocks = await prisma.dailyStock.deleteMany({});
  console.log(`Deleted ${deliveries.count} deliveries`);
  console.log(`Deleted ${dailyStocks.count} daily stocks`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
