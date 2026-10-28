# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
COPY server/prisma ./server/prisma
RUN --mount=type=cache,target=/root/.npm npm ci --workspace=server

COPY server ./server
RUN npx prisma generate --schema=server/prisma/schema.prisma && npm run build --workspace=server

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --schema=server/prisma/schema.prisma && npm run start --workspace=server"]
