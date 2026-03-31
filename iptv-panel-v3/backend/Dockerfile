FROM node:20-alpine AS builder

WORKDIR /app

# OpenSSL required by Prisma client generation
RUN apk add --no-cache openssl

# Copy prisma schema first (from project root context)
COPY prisma ./prisma

# Copy backend package files
COPY backend/package*.json ./

# Install ALL deps — need TypeScript + tsx + prisma CLI for build
RUN npm install

# Copy backend source files
COPY backend/src ./src
COPY backend/tsconfig.json ./

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript
RUN npm run build

# ────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init openssl

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

COPY backend/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production

EXPOSE 3001

ENTRYPOINT ["dumb-init", "./docker-entrypoint.sh"]
