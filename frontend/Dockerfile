# Stage 1: build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace root + package configs for all packages
COPY package.json package-lock.json* ./
COPY packages/jads/package.json packages/jads/package.json
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: serve static files
FROM node:22-alpine AS runtime

RUN adduser -D -u 1000 appuser && npm install -g serve

WORKDIR /app
COPY --from=builder /app/dist ./dist

USER appuser
EXPOSE 80

CMD ["serve", "-s", "dist", "-l", "80"]
