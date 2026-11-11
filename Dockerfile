# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=cache,target=/root/.npm npm ci --cache /root/.npm

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY next.config.ts next-env.d.ts tsconfig.json postcss.config.mjs ./
COPY public ./public
COPY src ./src
ARG NEXT_PUBLIC_ASSETS_BASE_URL=""
ARG ASSETS_PROXY_URL=""
ARG API_PROXY_URL=""
ENV NEXT_PUBLIC_ASSETS_BASE_URL=$NEXT_PUBLIC_ASSETS_BASE_URL \
    ASSETS_PROXY_URL=$ASSETS_PROXY_URL \
    API_PROXY_URL=$API_PROXY_URL
ENV BUILD_STANDALONE=true
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --chown=node:node LICENSE THIRD_PARTY_NOTICES.md ./
COPY --chown=node:node docs/licenses ./docs/licenses
COPY --chown=node:node scripts/smoke.mjs ./scripts/smoke.mjs

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/', { signal: AbortSignal.timeout(4000) }).then(response => process.exit(response.status === 200 ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
