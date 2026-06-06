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
if [ -d "$WEB" ]; then
  cp -r dist/* $WEB/
  echo "Copied to $WEB"
else
  echo "Serving from dist/ directly (no copy needed)"
fi

echo "=== Installing & building backend ==="
cd $APP/backend
npm install
npx prisma db push --accept-data-loss
npm run build

echo "=== Restarting backend ==="
pm2 restart furra-api || pm2 start dist/index.js --name furra-api

echo "=== Done ==="
