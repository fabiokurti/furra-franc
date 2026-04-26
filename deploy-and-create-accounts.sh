#!/bin/bash
set -e

echo "=== Pulling latest code ==="
cd /root/furra-franc
git pull origin main

echo "=== Installing backend deps ==="
cd backend
npm install

echo "=== Pushing DB schema ==="
npx prisma db push --accept-data-loss

echo "=== Building frontend ==="
cd ../frontend
npm install
npm run build

echo "=== Copying frontend build ==="
cp -r dist/* /var/www/furrafranc/

echo "=== Restarting backend ==="
pm2 restart furra-backend || pm2 start dist/index.js --name furra-backend

echo "=== Creating production accounts ==="
cd /root/furra-franc/backend

node -e "
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find or create admin user to assign as staffId for clients
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  const adminId = admin.id;

  const accounts = [
    { name: 'Dyqani Cerm Sektor', email: 'cermsekt@furrafranc.com', password: 'Cerm2024', role: 'BUSINESS', clientName: 'Dyqani Cerm Sektor' },
    { name: 'Dyqani Cerm Siperme', email: 'cermsip@furrafranc.com', password: 'Cerm2024', role: 'BUSINESS', clientName: 'Dyqani Cerm Siperme' },
    { name: 'Xheviti',   email: 'xheviti@furrafranc.com',  password: 'Xheviti2024',  role: 'ADMIN'    },
    { name: 'Xhulio',    email: 'xhulio@furrafranc.com',   password: 'Xhulio2024',   role: 'STAFF'    },
    { name: 'Mateo',     email: 'mateo@furrafranc.com',    password: 'Mateo2024',    role: 'STAFF'    },
    { name: 'Bashkimi',  email: 'bashkimi@furrafranc.com', password: 'Bashkimi2024', role: 'STAFF'    },
  ];

  for (const acc of accounts) {
    const exists = await prisma.user.findUnique({ where: { email: acc.email } });
    if (exists) { console.log('Already exists:', acc.email); continue; }

    const passwordHash = await bcrypt.hash(acc.password, 10);
    let clientId = undefined;

    if (acc.role === 'BUSINESS' && acc.clientName) {
      const client = await prisma.client.create({ data: { name: acc.clientName, staffId: adminId } });
      clientId = client.id;
    }

    await prisma.user.create({ data: { name: acc.name, email: acc.email, passwordHash, role: acc.role, ...(clientId && { clientId }) } });
    console.log('Created:', acc.email, '/', acc.password, '(', acc.role, ')');
  }

  await prisma.\$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
"

echo "=== Done ==="
