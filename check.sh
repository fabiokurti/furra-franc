#!/bin/bash
echo "=== PM2 status ==="
pm2 list

echo ""
echo "=== Backend logs (last 20) ==="
pm2 logs furra-api --lines 20 --nostream

echo ""
echo "=== Business accounts in DB ==="
cd /var/www/furra-franc/backend
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany({ where: { role: 'BUSINESS' }, select: { name: true, email: true } })
  .then(u => { u.forEach(x => console.log(x.email, '-', x.name)); p.\$disconnect(); })
  .catch(e => { console.error('DB error:', e.message); p.\$disconnect(); });
"

echo ""
echo "=== Test login sektor ==="
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sektor@furrafranc.com","password":"furrafranc"}' | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const r=JSON.parse(d);console.log(r.token?'LOGIN OK':'FAIL:',r.message||'');}catch{console.log('Raw:',d);}})"
