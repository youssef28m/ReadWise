# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim

ARG TARGETARCH
ARG PIPER_VERSION=2023.11.14-2
ARG PIPER_VOICE=en_US-lessac-medium

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl espeak-ng \
  && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
  case "${TARGETARCH:-amd64}" in \
    amd64) piper_arch="x86_64" ;; \
    arm64) piper_arch="aarch64" ;; \
    *) echo "Unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
  esac; \
  curl -fsSL "https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/piper_linux_${piper_arch}.tar.gz" -o /tmp/piper.tar.gz; \
  tar -xzf /tmp/piper.tar.gz -C /opt; \
  rm /tmp/piper.tar.gz; \
  curl -fsSL "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/${PIPER_VOICE}.onnx" -o "/opt/piper/${PIPER_VOICE}.onnx"; \
  curl -fsSL "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/${PIPER_VOICE}.onnx.json" -o "/opt/piper/${PIPER_VOICE}.onnx.json"

ENV PIPER_BIN=/opt/piper/piper
ENV PIPER_MODEL=/opt/piper/en_US-lessac-medium.onnx

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
