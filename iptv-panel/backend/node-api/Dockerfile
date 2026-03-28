FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache tini

# Dependencies stage
FROM base AS deps
COPY package.json ./
RUN npm install --omit=dev --frozen-lockfile && npm cache clean --force

# Production stage
FROM base AS production
ENV NODE_ENV=production

RUN mkdir -p /var/log/iptv && chown -R node:node /var/log/iptv

COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node src ./src

USER node

EXPOSE 8080

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
