#!/bin/sh
set -e

echo "==> Pushing database schema..."
node_modules/.bin/prisma db push --accept-data-loss

echo "==> Checking if database needs seeding..."
USER_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count()
  .then(n => { console.log(n); return p.\$disconnect(); })
  .catch(() => { console.log(0); });
" 2>/dev/null || echo "0")

if [ "$USER_COUNT" = "0" ]; then
  echo "==> Seeding database with demo data..."
  node_modules/.bin/tsx prisma/seed.ts
  echo "==> Seed complete."
else
  echo "==> Database already has ${USER_COUNT} users, skipping seed."
fi

echo "==> Starting IPTV Panel backend on port ${PORT:-3001}..."
exec node dist/index.js
