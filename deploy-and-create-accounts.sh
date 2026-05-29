#!/bin/bash
set -e

APP=/var/www/furra-franc
WEB=/var/www/furrafranc

echo "=== Pulling latest code ==="
cd $APP
git pull origin main

echo "=== Installing & building frontend ==="
cd $APP/frontend
npm install
npm run build
cp -r dist/* $WEB/

echo "=== Installing & building backend ==="
cd $APP/backend
npm install
npx prisma db push --accept-data-loss
npm run build

echo "=== Restarting backend ==="
pm2 restart furra-api || pm2 start dist/index.js --name furra-api

echo "=== Creating accounts ==="
cd $APP/backend
node -e "
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  const adminId = admin.id;

  const accounts = [
    { name: 'Dyqani Cerm Sektor',  email: 'cermsekt@furrafranc.com', password: 'Cerm2024',   role: 'BUSINESS', clientName: 'Dyqani Cerm Sektor'  },
    { name: 'Dyqani Cerm Siperme', email: 'cermsip@furrafranc.com',  password: 'Cerm2024',   role: 'BUSINESS', clientName: 'Dyqani Cerm Siperme' },
    { name: 'Dyqani Sektor',       email: 'sektor@furrafranc.com',   password: 'furrafranc', role: 'BUSINESS', clientName: 'Dyqani Sektor'        },
    { name: 'Dyqani 2',            email: 'dyqani2@furrafranc.com',  password: 'furrafranc', role: 'BUSINESS', clientName: 'Dyqani 2'             },
    { name: 'Xheviti',  email: 'xheviti@furrafranc.com',  password: 'Xheviti2024',  role: 'ADMIN' },
    { name: 'Xhulio',   email: 'xhulio@furrafranc.com',   password: 'Xhulio2024',   role: 'STAFF' },
    { name: 'Mateo',    email: 'mateo@furrafranc.com',    password: 'Mateo2024',    role: 'STAFF' },
    { name: 'Bashkimi', email: 'bashkimi@furrafranc.com', password: 'Bashkimi2024', role: 'STAFF' },
  ];

  for (const acc of accounts) {
    const exists = await prisma.user.findUnique({ where: { email: acc.email } });
    if (exists) { console.log('Skip (exists):', acc.email); continue; }
    const passwordHash = await bcrypt.hash(acc.password, 10);
    let clientId = undefined;
    if (acc.role === 'BUSINESS' && acc.clientName) {
      const client = await prisma.client.create({ data: { name: acc.clientName, staffId: adminId } });
      clientId = client.id;
    }
    await prisma.user.create({ data: { name: acc.name, email: acc.email, passwordHash, role: acc.role, ...(clientId && { clientId }) } });
    console.log('Created:', acc.email, '/', acc.password);
  }

  await prisma.\$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
"

echo "=== Done ==="
