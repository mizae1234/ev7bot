# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Stage 2: Build application
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Provide dummy env vars for next build (server code imports env.ts at compile time)
# Real values are injected at runtime via docker-compose env
ENV MSSQL_HOST=build_placeholder \
    MSSQL_PORT=1433 \
    MSSQL_DATABASE=build_placeholder \
    MSSQL_USER=build_placeholder \
    MSSQL_PASSWORD=build_placeholder \
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/db \
    LINE_CHANNEL_SECRET=build_placeholder \
    LINE_CHANNEL_ACCESS_TOKEN=build_placeholder \
    NEXT_PUBLIC_APP_URL=http://localhost:3000 \
    GEMINI_API_KEY=build_placeholder \
    NEXT_PUBLIC_LINE_LIFF_ID=build_placeholder \
    CRON_SECRET=build_placeholder

# Build Next.js (standalone)
RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy prisma schema for runtime (seed, migrations)
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
