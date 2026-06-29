FROM node:24-alpine AS app

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install pnpm
RUN corepack enable

# Copy dependency files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build arguments
# prisma generate / next build only need this var to resolve at config-load time;
# they don't actually connect to the DB. A placeholder is enough for the build.
# Override at build with --build-arg DATABASE_URL=... if a real connection is needed.
ARG DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public"
ENV DATABASE_URL=$DATABASE_URL

ARG APP_PORT=3000
ENV APP_PORT=$APP_PORT

# Build Next.js
RUN pnpm build

EXPOSE 3000

CMD ["sh", "-c", "pnpm exec next start -H 0.0.0.0 -p ${APP_PORT:-3000}"]