#!/bin/bash
cd /var/www/furra-franc/backend
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function run() {
  for (const email of ['cermsekt@furrafranc.com', 'cermsip@furrafranc.com']) {
    const u = await p.user.findUnique({ where: { email }, select: { id: true, clientId: true } });
    if (!u) { console.log('Not found:', email); continue; }
    await p.user.delete({ where: { email } });
    if (u.clientId) await p.client.delete({ where: { id: u.clientId } }).catch(() => {});
    console.log('Deleted:', email);
  }
  await p.\$disconnect();
}
run().catch(e => { console.error(e.message); process.exit(1); });
"
