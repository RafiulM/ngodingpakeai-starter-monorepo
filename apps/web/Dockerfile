# Production image for the TanStack Start web app. Build from the repository
# root, passing the API's public origin (it is inlined into the browser bundle):
#
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://api.example.com -t my-web .
#
# At runtime, set API_INTERNAL_URL when the web server reaches the API over a
# private address (e.g. http://api:4000). See docs/deployment.md.

ARG NODE_VERSION=22-slim

FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.7 prune @starter/web --docker

FROM base AS deps
COPY --from=pruner /app/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS builder
COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json starter.config.json ./
ARG VITE_API_URL
RUN test -n "$VITE_API_URL" || { echo "Pass --build-arg VITE_API_URL=<the API's public origin>"; exit 1; }
ENV NODE_ENV=production \
    VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @starter/web run build

# --- Runner: Nitro's node-server output is self-contained -------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0
COPY --from=builder --chown=node:node /app/apps/web/.output ./.output
USER node
EXPOSE 3000

# Liveness only: a static asset, so an API outage does not restart the app.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD \
  node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/icon.svg').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
