# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy root workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages

# Copy show package.json
COPY backend/show/package.json ./backend/show/

# show, shared-nestjs, shared-types, shared-constants 의존성 설치
RUN pnpm install --frozen-lockfile \
    --filter @neticket/show... \
    --filter @neticket/shared-nestjs... \
    --filter @neticket/shared-types... \
    --filter @neticket/shared-constants...

# Stage 2: Builder
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/show/node_modules ./backend/show/node_modules
COPY --from=deps /app/packages ./packages

# Copy source files
COPY backend/show ./backend/show
COPY pnpm-workspace.yaml package.json ./

# Build application
WORKDIR /app/backend/show
RUN pnpm --filter @neticket/shared-nestjs build && \
    pnpm --filter @neticket/shared-types build && \
    pnpm --filter @neticket/shared-constants build
RUN pnpm build

# Stage 3: Production
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy built application and dependencies
COPY --from=builder --chown=nestjs:nodejs /app/backend/show/dist ./backend/show/dist
COPY --from=builder --chown=nestjs:nodejs /app/backend/show/package.json ./backend/show/package.json
COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nestjs:nodejs /app/backend/show/node_modules ./backend/show/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages

USER nestjs

EXPOSE 3001

WORKDIR /app/backend/show
CMD ["node", "dist/main.js"]
