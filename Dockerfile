# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install ffmpeg (for video frame extraction) and yt-dlp (for YouTube video download)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 curl ca-certificates \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install --no-save --include=dev drizzle-kit@0.31.8

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/shared ./shared

EXPOSE 5000
CMD ["node", "dist/index.cjs"]
