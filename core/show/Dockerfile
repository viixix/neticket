# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy root workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages

# Copy show package.json
COPY core/show/package.json ./core/show/

# show, common, contracts 의존성 설치
RUN pnpm install --frozen-lockfile \
    --filter @neticket/show... \
    --filter @neticket/common... \
    --filter @neticket/contracts...

# Stage 2: Builder
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/core/show/node_modules ./core/show/node_modules
COPY --from=deps /app/packages ./packages

# Copy source files
COPY core/show ./core/show
COPY pnpm-workspace.yaml package.json ./

# Build application
WORKDIR /app/core/show
RUN pnpm --filter @neticket/common build && \
    pnpm --filter @neticket/contracts build
RUN pnpm build

# Stage 3: Production
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy built application and dependencies
COPY --from=builder --chown=nestjs:nodejs /app/core/show/dist ./core/show/dist
COPY --from=builder --chown=nestjs:nodejs /app/core/show/public ./core/show/public
COPY --from=builder --chown=nestjs:nodejs /app/core/show/package.json ./core/show/package.json
COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nestjs:nodejs /app/core/show/node_modules ./core/show/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages

USER nestjs

EXPOSE 3001

WORKDIR /app/core/show
CMD ["node", "dist/main.js"]
